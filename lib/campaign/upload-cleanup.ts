import "server-only";
import { getPrisma } from "@/lib/prisma";
import type { BlobStorageProvider } from "./storage";
import { getStorageProvider } from "../storage/vercel-blob";

/**
 * Explicit abandoned-file cleanup (upgrade plan section 6, "Abandoned file
 * cleanup").
 *
 * - Candidates are unreferenced UploadFiles whose request is terminal
 *   (SUBMITTED/REVOKED) or expired, and whose latest authorization deadline
 *   (or createdAt when null) and terminal/expiry time are both at least 24
 *   hours old. Previously DISCARDED files with a null deletedAt are
 *   re-selected so a failed provider delete is retried by the next run.
 * - In a transaction the request row and then the file row are locked, the
 *   file is confirmed unreferenced and non-ATTACHED, and its status is set
 *   to DISCARDED. The transaction commits BEFORE the provider delete of the
 *   exact recorded pathname; deletedAt is set only after a successful (or
 *   trivially missing) delete. On provider failure the row stays DISCARDED
 *   with a null deletedAt for the next run.
 * - ATTACHED files, representations, request receipts, and arbitrary store
 *   prefixes are never deleted. No queue, cron job, or worker exists; this
 *   service is exposed only through the cleanup CLI.
 */

const RETENTION_MS = 24 * 60 * 60 * 1000;

export interface CleanupCandidate {
  id: string;
  blobPathname: string;
  requestStatus: "OPEN" | "SUBMITTED" | "REVOKED";
  fileStatus: "PENDING" | "VERIFIED" | "REJECTED" | "ATTACHED" | "DISCARDED";
  expectedByteSize: number;
  reason: string;
}

export interface DiscardOutcome {
  id: string;
  blobPathname: string;
  /** True when this run flipped the row to DISCARDED. */
  discardedNow: boolean;
  /** True when the provider delete succeeded (or the object was missing). */
  deleted: boolean;
}

export interface CleanupSummary {
  candidates: CleanupCandidate[];
  dryRun: boolean;
  discardedCount: number;
  deletedCount: number;
  failedCount: number;
  totalCandidateBytes: number;
}

/**
 * Selects cleanup candidates. Purely a read; no locks are taken.
 */
export async function selectDiscardableUploadFiles(
  options: { now?: Date; limit?: number; requestId?: string } = {},
): Promise<CleanupCandidate[]> {
  const prisma = getPrisma();
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - RETENTION_MS);

  const whereClause: any = {
    deletedAt: null,
    representation: { is: null },
    OR: [
      // Previously discarded with a failed/missed provider delete: retry.
      { status: "DISCARDED" },
      {
        status: { in: ["PENDING", "VERIFIED", "REJECTED"] },
        uploadRequest: {
          OR: [
            { status: "SUBMITTED", submittedAt: { lte: cutoff } },
            { status: "REVOKED", revokedAt: { lte: cutoff } },
            { status: "OPEN", expiresAt: { lte: cutoff } },
          ],
        },
        OR: [
          { authorizationExpiresAt: { lte: cutoff } },
          { authorizationExpiresAt: null, createdAt: { lte: cutoff } },
        ],
      },
    ],
  };

  if (options.requestId) {
    whereClause.uploadRequestId = options.requestId;
  }

  const files = await prisma.uploadFile.findMany({
    where: whereClause,
    select: {
      id: true,
      blobPathname: true,
      status: true,
      expectedByteSize: true,
      uploadRequest: { select: { status: true, expiresAt: true, submittedAt: true, revokedAt: true } },
    },
    orderBy: { createdAt: "asc" },
    take: options.limit ?? 100,
  });

  return files.map((file) => {
    let reason = "expired_retention_elapsed";
    if (file.status === "DISCARDED") {
      reason = "retry_unconfirmed_provider_deletion";
    } else if (file.uploadRequest.status === "REVOKED") {
      reason = "revoked_request_aged";
    } else if (file.uploadRequest.status === "SUBMITTED") {
      reason = "submitted_unattached_aged";
    }

    return {
      id: file.id,
      blobPathname: file.blobPathname,
      requestStatus: file.uploadRequest.status,
      fileStatus: file.status,
      expectedByteSize: Number(file.expectedByteSize),
      reason,
    };
  });
}

/**
 * Discards one candidate file and deletes its provider object. The database
 * transaction commits before the provider delete; a missing provider object
 * counts as successfully deleted.
 */
export async function discardUploadFile(
  fileId: string,
  options: { provider?: BlobStorageProvider } = {},
): Promise<
  | { ok: true; outcome: DiscardOutcome }
  | { ok: false; error: "NOT_FOUND" | "FILE_ATTACHED" | "STORAGE_UNAVAILABLE" }
> {
  const prisma = getPrisma();
  const provider = options.provider ?? getStorageProvider();

  let discardedNow = false;
  let blobPathname: string | null = null;

  try {
    await prisma.$transaction(
      async (tx) => {
        const file = await tx.uploadFile.findUnique({
          where: { id: fileId },
          select: { id: true, uploadRequestId: true, blobPathname: true, status: true },
        });
        if (!file) {
          throw new Error("NOT_FOUND");
        }

        // Lock the request row first, then the file row.
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "UploadRequest" WHERE "id" = ${file.uploadRequestId} FOR UPDATE
        `;
        const lockedFile = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "UploadFile" WHERE "id" = ${file.id} FOR UPDATE
        `;
        if (lockedFile.length === 0) {
          throw new Error("NOT_FOUND");
        }

        // Confirm no representation uses the file at discard time.
        const referencing = await tx.assetRepresentation.findFirst({
          where: { uploadFileId: file.id },
          select: { id: true },
        });
        if (referencing) {
          throw new Error("FILE_ATTACHED");
        }

        blobPathname = file.blobPathname;

        if (file.status === "DISCARDED") {
          // Re-selection for a failed delete retry; no status change.
          return;
        }
        if (file.status === "ATTACHED") {
          throw new Error("FILE_ATTACHED");
        }

        await tx.uploadFile.update({
          where: { id: file.id },
          data: { status: "DISCARDED" },
        });
        discardedNow = true;
      },
      { maxWait: 15000, timeout: 60000 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND") {
      return { ok: false, error: "NOT_FOUND" };
    }
    if (message === "FILE_ATTACHED") {
      return { ok: false, error: "FILE_ATTACHED" };
    }
    return { ok: false, error: "STORAGE_UNAVAILABLE" };
  }

  if (blobPathname === null) {
    return { ok: false, error: "NOT_FOUND" };
  }

  // Provider delete happens strictly after the discard commit. A missing
  // object is success; a provider failure leaves DISCARDED with a null
  // deletedAt so the next run retries.
  let deleted = false;
  try {
    await provider.delete(blobPathname);
    deleted = true;
  } catch {
    deleted = false;
  }

  if (deleted) {
    await prisma.uploadFile.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    });
  }

  return {
    ok: true,
    outcome: {
      id: fileId,
      blobPathname,
      discardedNow,
      deleted,
    },
  };
}

/**
 * Full cleanup pass. `apply: false` (the default) only reports candidates;
 * `apply: true` discards and deletes them.
 */
export async function runUploadCleanup(
  options: { apply?: boolean; provider?: BlobStorageProvider; limit?: number; now?: Date; requestId?: string } = {},
): Promise<CleanupSummary> {
  const apply = options.apply ?? false;
  const provider = options.provider ?? getStorageProvider();

  const candidates = await selectDiscardableUploadFiles({
    limit: options.limit,
    now: options.now,
    requestId: options.requestId,
  });

  const totalCandidateBytes = candidates.reduce((sum, c) => sum + c.expectedByteSize, 0);

  if (!apply) {
    return {
      candidates,
      dryRun: true,
      discardedCount: 0,
      deletedCount: 0,
      failedCount: 0,
      totalCandidateBytes,
    };
  }

  let discardedCount = 0;
  let deletedCount = 0;
  let failedCount = 0;

  for (const candidate of candidates) {
    const result = await discardUploadFile(candidate.id, { provider });
    if (result.ok) {
      if (result.outcome.discardedNow) {
        discardedCount += 1;
      }
      if (result.outcome.deleted) {
        deletedCount += 1;
      } else {
        failedCount += 1;
      }
    } else if (result.error === "STORAGE_UNAVAILABLE") {
      failedCount += 1;
    }
  }

  return {
    candidates,
    dryRun: false,
    discardedCount,
    deletedCount,
    failedCount,
    totalCandidateBytes,
  };
}
