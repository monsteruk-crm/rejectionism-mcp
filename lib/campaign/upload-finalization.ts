import "server-only";
import { getPrisma } from "@/lib/prisma";
import { ok, fail, handleServiceError, ServiceResult } from "./results";
import { createActivityTx } from "./activity";
import { lockUploadRequestByHash, mapUploadRequestError } from "./upload-requests";
import { nextRevisionNumberTx } from "./asset-revisions";
import { FinalizeUploadInputSchema, FinalizeUploadInput } from "./upload-schemas";
import { canonicalExtensionForStoredMime, MAX_SUBMISSION_BYTES } from "./file-validation";
import { hashFinalizationPayload, hashUploadToken, isRawUploadToken } from "./upload-tokens";
import type { MutationSource } from "./schemas";
import { Prisma } from "@/app/generated/prisma/client";

/**
 * Atomic finalization (upgrade plan section 6, "Atomic persistence and
 * races", "Failure and retry outcomes", and section 7 targeting modes).
 *
 * - Token syntax and strict input are validated before any lock. The
 *   request row is locked with a parameterized `SELECT ... FOR UPDATE` on
 *   the token hash; no SQL identifiers are interpolated.
 * - An already-SUBMITTED request replays its stored receipt only when both
 *   submissionKey and payload hash match exactly; any other replay is
 *   UPLOAD_ALREADY_SUBMITTED. Replay performs no writes.
 * - All storage I/O stays outside the transaction (finalization performs
 *   none), and no Blob is ever deleted on failure: a failed finalization
 *   leaves VERIFIED files staged and the request OPEN for an exact retry.
 * - Targeted modes CAS-update the parent Asset by its captured version and
 *   increment it once per finalization; untargeted submissions create one
 *   DRAFT Asset with revision 1 and one primary representation per item.
 * - Unique constraints (one primary per revision, one representation per
 *   uploadFileId, one revision number per asset) provide a second guard.
 */

type Tx = Prisma.TransactionClient;

interface ReceiptItem {
  clientItemId: string;
  name: string;
  kind: string;
  notes: string | null;
  assetId: string;
  revisionId: string;
  representationId: string;
}

interface StoredReceipt {
  submissionKey: string;
  submittedAt: string;
  itemCount: number;
  items: ReceiptItem[];
}

export interface PublicFinalizeReceipt {
  requestId: string;
  submissionKey: string;
  submittedAt: string;
  itemCount: number;
}

interface FinalizeContext {
  tx: Tx;
  request: {
    id: string;
    maxItems: number;
    targetAssetId: string | null;
    targetRevisionId: string | null;
    targetAssetVersion: number | null;
  };
  input: FinalizeUploadInput;
  submissionHash: string;
  now: Date;
  source: MutationSource;
}

interface RepresentationSourceData {
  storageType: "BLOB" | "EXTERNAL_URL";
  label: string | null;
  notes: string | null;
  variant: string | null;
  format: string | null;
  sourceFilename: string | null;
  mimeType: string | null;
  byteSize: bigint | null;
  width: number | null;
  height: number | null;
  blobUrl: string | null;
  blobPathname: string | null;
  externalUrl: string | null;
  isPrimary: boolean;
  uploadFileId: string | null;
  uploadRequestId: string;
}

type AssetStatusValue = "MISSING" | "DRAFT" | "NEEDS_WORK" | "APPROVED" | "SUPERSEDED";

/**
 * Applies the section 7 status transition for content added to an existing
 * Asset: DRAFT from MISSING, NEEDS_WORK from APPROVED, otherwise retained.
 */
function statusAfterContent(status: AssetStatusValue): AssetStatusValue {
  if (status === "MISSING") {
    return "DRAFT";
  }
  if (status === "APPROVED") {
    return "NEEDS_WORK";
  }
  return status;
}

interface FinalizeEntry {
  item: FinalizeUploadInput["items"][number];
  file: VerifiedFileData | null;
}

interface VerifiedFileData {
  id: string;
  sourceFilename: string;
  declaredMimeType: string;
  mimeType: string | null;
  byteSize: bigint | null;
  width: number | null;
  height: number | null;
  blobUrl: string | null;
  blobPathname: string;
}

async function createRevisionForSubmission(
  tx: Tx,
  context: FinalizeContext,
  params: {
    assetId: string;
    assetStatus: AssetStatusValue;
    expectedVersion: number;
    revisionId?: string; // targetRevision mode appends to an exact revision
  },
): Promise<{ revisionId: string; revisionNumber: number }> {
  let revisionId: string;
  let revisionNumber: number;

  if (params.revisionId !== undefined) {
    const revision = await tx.assetRevision.findUnique({
      where: { id: params.revisionId },
      select: { id: true, revisionNumber: true },
    });
    if (!revision) {
      throw new Error("TARGET_NOT_FOUND");
    }
    revisionId = revision.id;
    revisionNumber = revision.revisionNumber;
  } else {
    // Serialize writers on the parent before computing the next number.
    revisionNumber = await nextRevisionNumberTx(tx, params.assetId);
    const revision = await tx.assetRevision.create({
      data: {
        assetId: params.assetId,
        revisionNumber,
      },
    });
    revisionId = revision.id;
  }

  const statusAfter = statusAfterContent(params.assetStatus);
  if (statusAfter !== params.assetStatus) {
    await tx.asset.update({
      where: { id: params.assetId },
      data: { status: statusAfter },
    });
  }

  if (params.revisionId === undefined) {
    await createActivityTx(tx, {
      entityType: "ASSET",
      entityId: params.assetId,
      action: "ASSET_REVISION_CREATED",
      summary: `Created revision ${revisionNumber} for asset`,
      source: context.source,
      metadata: {
        revisionId,
        revisionNumber,
        viaUploadRequestId: context.request.id,
        oldVersion: params.expectedVersion,
        newVersion: params.expectedVersion + 1,
      },
    });
  }

  return { revisionId, revisionNumber };
}

async function createRepresentationForEntry(
  tx: Tx,
  context: FinalizeContext,
  params: {
    assetId: string;
    revisionId: string;
    entry: FinalizeEntry;
    isPrimary: boolean;
    expectedVersion: number;
  },
): Promise<string> {
  const { item, file } = params.entry;

  const data: RepresentationSourceData =
    item.type === "FILE" && file !== null
      ? {
          // BLOB: server inspection owns the technical format; user format
          // hints are ignored and the canonical extension is stored.
          storageType: "BLOB",
          label: item.label ?? item.name,
          notes: item.notes,
          variant: item.variant,
          format: canonicalExtensionForStoredMime(file.declaredMimeType),
          sourceFilename: file.sourceFilename,
          mimeType: file.mimeType,
          byteSize: file.byteSize,
          width: file.width,
          height: file.height,
          blobUrl: file.blobUrl,
          blobPathname: file.blobPathname,
          externalUrl: null,
          isPrimary: params.isPrimary,
          uploadFileId: file.id,
          uploadRequestId: context.request.id,
        }
      : {
          storageType: "EXTERNAL_URL",
          label: item.label ?? item.name,
          notes: item.notes,
          variant: item.variant,
          format: item.format ?? null,
          sourceFilename: null,
          mimeType: null,
          byteSize: null,
          width: null,
          height: null,
          blobUrl: null,
          blobPathname: null,
          externalUrl: item.type === "EXTERNAL_URL" ? item.externalUrl : null,
          isPrimary: params.isPrimary,
          uploadFileId: null,
          uploadRequestId: context.request.id,
        };

  const representation = await tx.assetRepresentation.create({
    data: {
      assetRevisionId: params.revisionId,
      ...data,
    },
  });

  await createActivityTx(tx, {
    entityType: "ASSET",
    entityId: params.assetId,
    action: "ASSET_REPRESENTATION_ADDED",
    summary: "Added uploaded representation to revision",
    source: context.source,
    metadata: {
      representationId: representation.id,
      revisionId: params.revisionId,
      storageType: data.storageType,
      isPrimary: data.isPrimary,
      uploadRequestId: context.request.id,
      uploadFileId: data.uploadFileId,
      oldVersion: params.expectedVersion,
      newVersion: params.expectedVersion + 1,
    },
  });

  return representation.id;
}

async function loadVerifiedFile(
  tx: Tx,
  context: FinalizeContext,
  item: Extract<FinalizeUploadInput["items"][number], { type: "FILE" }>,
): Promise<VerifiedFileData> {
  const file = await tx.uploadFile.findUnique({
    where: { id: item.fileId },
    include: {
      // Guard: no representation may already use this file.
      representation: { select: { id: true } },
    },
  });

  if (!file || file.uploadRequestId !== context.request.id) {
    // Never disclose files owned by other requests.
    throw new Error("FILE_NOT_FOUND");
  }
  if (file.clientItemId !== item.clientItemId) {
    throw new Error("FILE_ITEM_MISMATCH");
  }
  if (file.status === "VERIFIED") {
    if (file.representation) {
      throw new Error("FILE_ALREADY_ATTACHED");
    }
    return {
      id: file.id,
      sourceFilename: file.sourceFilename,
      declaredMimeType: file.declaredMimeType,
      mimeType: file.mimeType,
      byteSize: file.byteSize,
      width: file.width,
      height: file.height,
      blobUrl: file.blobUrl,
      blobPathname: file.blobPathname,
    };
  }
  // PENDING/REJECTED/DISCARDED can never be finalized.
  throw new Error("UPLOAD_NOT_READY");
}

async function runFinalization(context: FinalizeContext): Promise<StoredReceipt> {
  const { tx, request, input, submissionHash, now, source } = context;
  const items = input.items;

  // FILE items must reference this request's VERIFIED files, matching the
  // clientItemId, with no representation already attached.
  const entries: FinalizeEntry[] = [];
  let totalVerifiedBytes = 0;

  for (const item of items) {
    if (item.type === "FILE") {
      const file = await loadVerifiedFile(tx, context, item);
      totalVerifiedBytes += Number(file.byteSize ?? 0);
      entries.push({ item, file });
    } else {
      entries.push({ item, file: null });
    }
  }

  if (totalVerifiedBytes > MAX_SUBMISSION_BYTES) {
    throw new Error("UPLOAD_LIMIT_EXCEEDED");
  }

  const receiptItems: ReceiptItem[] = [];

  if (request.targetRevisionId !== null) {
    // ---- targetRevision mode: append to the exact revision ----
    const revision = await tx.assetRevision.findUnique({
      where: { id: request.targetRevisionId },
      include: { asset: { select: { id: true, status: true, version: true } } },
    });
    if (!revision || revision.assetId !== request.targetAssetId) {
      throw new Error("TARGET_NOT_FOUND");
    }
    const asset = revision.asset;
    if (asset.status === "SUPERSEDED") {
      throw new Error("SUPERSEDED_REJECTED");
    }

    // The captured version drives the CAS so any intervening Asset mutation
    // fails; a null snapshot (impossible through our services) falls back to
    // the current row version.
    const expectedVersion = request.targetAssetVersion ?? asset.version;
    const cas = await tx.asset.updateMany({
      where: { id: asset.id, version: expectedVersion },
      data: { version: expectedVersion + 1 },
    });
    if (cas.count === 0) {
      throw new Error("VERSION_CONFLICT");
    }

    const existingCount = await tx.assetRepresentation.count({
      where: { assetRevisionId: revision.id },
    });
    // The first added item becomes primary only if no representation existed;
    // an existing primary is always preserved.
    let isPrimary = existingCount === 0;

    await createRevisionForSubmission(tx, context, {
      assetId: asset.id,
      assetStatus: asset.status,
      expectedVersion,
      revisionId: revision.id,
    });

    for (const entry of entries) {
      const representationId = await createRepresentationForEntry(tx, context, {
        assetId: asset.id,
        revisionId: revision.id,
        entry,
        isPrimary,
        expectedVersion,
      });
      isPrimary = false;
      receiptItems.push({
        clientItemId: entry.item.clientItemId,
        name: entry.item.name,
        kind: entry.item.kind,
        notes: entry.item.notes,
        assetId: asset.id,
        revisionId: revision.id,
        representationId,
      });
    }
  } else if (request.targetAssetId !== null) {
    // ---- targetAsset-only mode: one new revision with all items ----
    const asset = await tx.asset.findUnique({
      where: { id: request.targetAssetId },
      select: { id: true, status: true, version: true },
    });
    if (!asset) {
      throw new Error("TARGET_NOT_FOUND");
    }
    if (asset.status === "SUPERSEDED") {
      throw new Error("SUPERSEDED_REJECTED");
    }

    // The captured version drives the CAS so any intervening Asset mutation
    // fails; a null snapshot (impossible through our services) falls back to
    // the current row version.
    const expectedVersion = request.targetAssetVersion ?? asset.version;
    const cas = await tx.asset.updateMany({
      where: { id: asset.id, version: expectedVersion },
      data: { version: expectedVersion + 1 },
    });
    if (cas.count === 0) {
      throw new Error("VERSION_CONFLICT");
    }

    const { revisionId } = await createRevisionForSubmission(tx, context, {
      assetId: asset.id,
      assetStatus: asset.status,
      expectedVersion,
    });

    let isPrimary = true;
    for (const entry of entries) {
      const representationId = await createRepresentationForEntry(tx, context, {
        assetId: asset.id,
        revisionId,
        entry,
        isPrimary,
        expectedVersion,
      });
      isPrimary = false;
      receiptItems.push({
        clientItemId: entry.item.clientItemId,
        name: entry.item.name,
        kind: entry.item.kind,
        notes: entry.item.notes,
        assetId: asset.id,
        revisionId,
        representationId,
      });
    }
  } else {
    // ---- No target: one DRAFT Asset with revision 1 per item ----
    for (const entry of entries) {
      const asset = await tx.asset.create({
        data: {
          name: entry.item.name,
          kind: entry.item.kind,
          status: "DRAFT",
          notes: entry.item.notes,
          version: 1,
        },
      });

      const revision = await tx.assetRevision.create({
        data: {
          assetId: asset.id,
          revisionNumber: 1,
        },
      });

      await createActivityTx(tx, {
        entityType: "ASSET",
        entityId: asset.id,
        action: "ASSET_REVISION_CREATED",
        summary: "Created revision 1 for asset",
        source,
        metadata: {
          revisionId: revision.id,
          revisionNumber: 1,
          viaUploadRequestId: request.id,
          oldVersion: 1,
          newVersion: 1,
        },
      });

      const representationId = await createRepresentationForEntry(tx, context, {
        assetId: asset.id,
        revisionId: revision.id,
        entry,
        isPrimary: true,
        expectedVersion: 1,
      });

      receiptItems.push({
        clientItemId: entry.item.clientItemId,
        name: entry.item.name,
        kind: entry.item.kind,
        notes: entry.item.notes,
        assetId: asset.id,
        revisionId: revision.id,
        representationId,
      });
    }
  }

  // Transition selected files VERIFIED → ATTACHED in the same transaction.
  for (const entry of entries) {
    if (entry.file !== null) {
      await tx.uploadFile.update({
        where: { id: entry.file.id },
        data: { status: "ATTACHED" },
      });
    }
  }

  const submittedAt = now.toISOString();
  const receipt: StoredReceipt = {
    submissionKey: input.submissionKey,
    submittedAt,
    itemCount: items.length,
    items: receiptItems,
  };

  // Conditional OPEN → SUBMITTED transition; the request row lock plus this
  // predicate serialize competing submissions.
  const transition = await tx.uploadRequest.updateMany({
    where: { id: request.id, status: "OPEN" },
    data: {
      status: "SUBMITTED",
      submittedAt: now,
      submissionKey: input.submissionKey,
      submissionHash,
      submissionReceipt: receipt as unknown as Prisma.InputJsonObject,
    },
  });
  if (transition.count === 0) {
    throw new Error("REQUEST_STATE_CHANGED");
  }

  // Minimal audit summary: IDs, counts, and versions only — never
  // filenames, notes content, URLs, or token material.
  await createActivityTx(tx, {
    entityType: "UPLOAD_REQUEST",
    entityId: request.id,
    action: "UPLOAD_SUBMITTED",
    summary: "Upload request finalized",
    source,
    metadata: {
      submissionKey: input.submissionKey,
      itemCount: items.length,
      targetedAssetIds: Array.from(new Set(receiptItems.map((item) => item.assetId))),
    },
  });

  return receipt;
}

export async function finalizeUploadRequestByRequestId(
  requestId: string,
  rawInput: unknown,
  source: MutationSource = "public-upload",
): Promise<ServiceResult<{ receipt: PublicFinalizeReceipt }>> {
  const parsed = FinalizeUploadInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;

  try {
    const prisma = getPrisma();
    const submissionHash = await hashFinalizationPayload(input.submissionKey, input.items);
    const now = new Date();

    const outcome = await prisma.$transaction(
      async (tx) => {
        const locked = await tx.uploadRequest.findUnique({
          where: { id: requestId },
        });
        if (!locked) {
          throw new Error("NOT_FOUND");
        }

        if (locked.status === "SUBMITTED") {
          if (locked.submissionKey === input.submissionKey && locked.submissionHash === submissionHash) {
            // Identical-request replay: return the stored receipt without writes
            const stored = locked.submissionReceipt as StoredReceipt | null;
            if (!stored) {
              throw new Error("INTERNAL_ERROR");
            }
            return { requestId: locked.id, replay: true as const, receipt: stored };
          }
          throw new Error("UPLOAD_ALREADY_SUBMITTED");
        }
        if (locked.status === "REVOKED") {
          throw new Error("UPLOAD_REVOKED");
        }
        if (locked.expiresAt.getTime() <= now.getTime()) {
          throw new Error("UPLOAD_EXPIRED");
        }

        if (input.items.length > locked.maxItems) {
          throw new Error("UPLOAD_LIMIT_EXCEEDED");
        }

        if (locked.targetAssetId !== null || locked.targetRevisionId !== null) {
          const targetAsset = locked.targetAssetId
            ? await tx.asset.findUnique({
                where: { id: locked.targetAssetId },
                select: { id: true, status: true },
              })
            : null;
          if (locked.targetAssetId !== null && !targetAsset) {
            throw new Error("TARGET_NOT_FOUND");
          }
          if (targetAsset?.status === "SUPERSEDED") {
            throw new Error("SUPERSEDED_REJECTED");
          }
          if (locked.targetRevisionId !== null) {
            const revision = await tx.assetRevision.findUnique({
              where: { id: locked.targetRevisionId },
              select: { id: true, assetId: true },
            });
            if (!revision || revision.assetId !== locked.targetAssetId) {
              throw new Error("TARGET_NOT_FOUND");
            }
          }
        }

        const receipt = await runFinalization({
          tx,
          request: {
            id: locked.id,
            maxItems: locked.maxItems,
            targetAssetId: locked.targetAssetId,
            targetRevisionId: locked.targetRevisionId,
            targetAssetVersion: locked.targetAssetVersion,
          },
          input,
          submissionHash,
          now,
          source,
        });

        return { requestId: locked.id, replay: false as const, receipt };
      },
      { maxWait: 15000, timeout: 60000 },
    );

    return ok({
      receipt: {
        requestId: outcome.requestId,
        submissionKey: outcome.receipt.submissionKey,
        submittedAt: outcome.receipt.submittedAt,
        itemCount: outcome.receipt.itemCount,
      },
    });
  } catch (error) {
    return mapUploadRequestError(error);
  }
}

export async function finalizeUploadRequest(
  rawToken: string,
  rawInput: unknown,
  source: MutationSource = "public-upload",
): Promise<ServiceResult<{ receipt: PublicFinalizeReceipt }>> {
  if (!isRawUploadToken(rawToken)) {
    return fail("VALIDATION_ERROR", "Malformed upload capability token.");
  }

  try {
    const prisma = getPrisma();
    const tokenHash = await hashUploadToken(rawToken);
    const request = await prisma.uploadRequest.findFirst({
      where: { tokenHash, purpose: "CONTRIBUTOR" },
      select: { id: true },
    });
    if (!request) {
      return fail("NOT_FOUND", "Upload request not found.");
    }
    return finalizeUploadRequestByRequestId(request.id, rawInput, source);
  } catch (error) {
    return mapUploadRequestError(error);
  }
}
