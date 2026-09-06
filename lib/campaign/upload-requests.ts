import "server-only";
import { getPrisma } from "@/lib/prisma";
import { ok, fail, handleServiceError, ServiceResult } from "./results";
import { createActivityTx } from "./activity";
import { getTrustedOrigin } from "../auth/origin";
import { generateUploadToken, hashUploadToken, isRawUploadToken } from "./upload-tokens";
import {
  CreateUploadRequestInputSchema,
  GetUploadRequestInputSchema,
  ListUploadRequestsQuerySchema,
  RegenerateUploadRequestInputSchema,
  RevokeUploadRequestInputSchema,
} from "./upload-schemas";
import type { MutationSource } from "./schemas";
import { Prisma } from "@/app/generated/prisma/client";

/**
 * Upload request lifecycle services (upgrade plan section 6, "Creation and
 * token lifecycle").
 *
 * - A raw capability token is generated as 32 random bytes base64url (43
 *   characters) and only its lowercase SHA-256 hash is persisted. The raw
 *   value exists only in the create/regenerate return value and the
 *   recipient's browser; it never reaches Activity, receipts, or admin reads.
 * - Targets are resolved inside the creation transaction: missing or
 *   mismatched targets and SUPERSEDED assets are rejected, and
 *   `targetAssetVersion` is captured from the current Asset version.
 * - Regeneration never resets an old row to OPEN: the old request is locked,
 *   confirmed without a replacement, revoked, and a new request with a new
 *   hash and current target version is created in the same transaction.
 * - Effective state priority: persisted SUBMITTED, then REVOKED, then EXPIRED
 *   when persisted OPEN and past expiry, otherwise OPEN.
 */

type Tx = Prisma.TransactionClient;

export type EffectiveUploadRequestStatus = "OPEN" | "SUBMITTED" | "REVOKED" | "EXPIRED";

export interface UploadRequestDto {
  id: string;
  title: string;
  instructions: string;
  status: "OPEN" | "SUBMITTED" | "REVOKED";
  effectiveStatus: EffectiveUploadRequestStatus;
  expiresAt: string;
  maxItems: number;
  targetAssetId: string | null;
  targetRevisionId: string | null;
  targetAssetVersion: number | null;
  submissionKey: string | null;
  submittedAt: string | null;
  itemCount: number | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface UploadFileDto {
  id: string;
  clientItemId: string;
  status: "PENDING" | "VERIFIED" | "REJECTED" | "ATTACHED" | "DISCARDED";
  sourceFilename: string;
  declaredMimeType: string;
  expectedByteSize: number;
  blobPathname: string;
  mimeType: string | null;
  byteSize: number | null;
  width: number | null;
  height: number | null;
  verifiedAt: string | null;
  failureCode: string | null;
  authorizationCount: number;
  authorizationExpiresAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

const MS_PER_DAY = 86_400_000;

/** Computes the derived request status; EXPIRED is never persisted. */
export function getEffectiveUploadRequestStatus(
  status: "OPEN" | "SUBMITTED" | "REVOKED",
  expiresAt: Date,
  now: Date = new Date(),
): EffectiveUploadRequestStatus {
  if (status === "SUBMITTED") {
    return "SUBMITTED";
  }
  if (status === "REVOKED") {
    return "REVOKED";
  }
  return expiresAt.getTime() <= now.getTime() ? "EXPIRED" : "OPEN";
}

type UploadRequestRow = Prisma.UploadRequestGetPayload<object>;

function mapRequestToDto(row: UploadRequestRow): UploadRequestDto {
  const receipt = row.submissionReceipt as
    | { submissionKey?: string; submittedAt?: string; itemCount?: number }
    | null
    | undefined;

  return {
    id: row.id,
    title: row.title,
    instructions: row.instructions,
    status: row.status,
    effectiveStatus: getEffectiveUploadRequestStatus(row.status, row.expiresAt),
    expiresAt: row.expiresAt.toISOString(),
    maxItems: row.maxItems,
    targetAssetId: row.targetAssetId,
    targetRevisionId: row.targetRevisionId,
    targetAssetVersion: row.targetAssetVersion,
    submissionKey: receipt?.submissionKey ?? row.submissionKey ?? null,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    itemCount: receipt?.itemCount ?? null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapFileToDto(file: Prisma.UploadFileGetPayload<object>): UploadFileDto {
  return {
    id: file.id,
    clientItemId: file.clientItemId,
    status: file.status,
    sourceFilename: file.sourceFilename,
    declaredMimeType: file.declaredMimeType,
    expectedByteSize: Number(file.expectedByteSize),
    blobPathname: file.blobPathname,
    mimeType: file.mimeType,
    byteSize: file.byteSize === null ? null : Number(file.byteSize),
    width: file.width,
    height: file.height,
    verifiedAt: file.verifiedAt ? file.verifiedAt.toISOString() : null,
    failureCode: file.failureCode,
    authorizationCount: file.authorizationCount,
    authorizationExpiresAt: file.authorizationExpiresAt
      ? file.authorizationExpiresAt.toISOString()
      : null,
    deletedAt: file.deletedAt ? file.deletedAt.toISOString() : null,
    createdAt: file.createdAt.toISOString(),
  };
}

/** Row-lock helper: parameterized SELECT ... FOR UPDATE on the request row. */
export async function lockUploadRequestByHash(
  tx: Tx,
  tokenHash: string,
): Promise<UploadRequestRow | null> {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "UploadRequest" WHERE "tokenHash" = ${tokenHash} FOR UPDATE
  `;
  if (locked.length === 0) {
    return null;
  }
  return await tx.uploadRequest.findUnique({ where: { id: locked[0]!.id } });
}

/** Row-lock helper by primary key (revoke/regenerate/reservation paths). */
export async function lockUploadRequestById(
  tx: Tx,
  id: string,
): Promise<UploadRequestRow | null> {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "UploadRequest" WHERE "id" = ${id} FOR UPDATE
  `;
  if (locked.length === 0) {
    return null;
  }
  return await tx.uploadRequest.findUnique({ where: { id: locked[0]!.id } });
}

interface ResolvedUploadTarget {
  targetAssetId: string | null;
  targetRevisionId: string | null;
  targetAssetVersion: number | null;
}

/**
 * Resolves and validates the request target inside the caller's transaction.
 * A revision target persists its parent Asset ID as well.
 */
export async function resolveUploadTargetTx(
  tx: Tx,
  input: { targetAssetId: string | null | undefined; targetRevisionId: string | null | undefined },
): Promise<ResolvedUploadTarget> {
  let targetAssetId: string | null = input.targetAssetId ?? null;
  let targetRevisionId: string | null = input.targetRevisionId ?? null;
  let targetAssetVersion: number | null = null;

  if (targetRevisionId !== null) {
    const revision = await tx.assetRevision.findUnique({
      where: { id: targetRevisionId },
      select: { id: true, assetId: true, asset: { select: { id: true, status: true, version: true } } },
    });
    if (!revision) {
      throw new Error("TARGET_NOT_FOUND");
    }
    if (targetAssetId !== null && targetAssetId !== revision.assetId) {
      throw new Error("TARGET_MISMATCH");
    }
    if (revision.asset.status === "SUPERSEDED") {
      throw new Error("SUPERSEDED_REJECTED");
    }
    targetAssetId = revision.assetId;
    targetAssetVersion = revision.asset.version;
  } else if (targetAssetId !== null) {
    const asset = await tx.asset.findUnique({
      where: { id: targetAssetId },
      select: { id: true, status: true, version: true },
    });
    if (!asset) {
      throw new Error("TARGET_NOT_FOUND");
    }
    if (asset.status === "SUPERSEDED") {
      throw new Error("SUPERSEDED_REJECTED");
    }
    targetAssetVersion = asset.version;
  }

  return { targetAssetId, targetRevisionId, targetAssetVersion };
}

export async function createUploadRequest(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<{ id: string; uploadUrl: string; expiresAt: string }>> {
  const parsed = CreateUploadRequestInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;
  const trustedOrigin = getTrustedOrigin();
  if (trustedOrigin === null) {
    return fail(
      "AUTH_NOT_CONFIGURED",
      "A valid CAMPAIGNOS_BASE_URL is required to create upload links.",
    );
  }

  try {
    const prisma = getPrisma();

    // One captured server time defines createdAt and expiry together.
    const now = new Date();
    const rawToken = generateUploadToken();
    const tokenHash = await hashUploadToken(rawToken);
    const expiresAt = new Date(now.getTime() + input.expiresInDays * MS_PER_DAY);

    const created = await prisma.$transaction(
      async (tx) => {
        const target = await resolveUploadTargetTx(tx, {
          targetAssetId: input.targetAssetId,
          targetRevisionId: input.targetRevisionId,
        });

        const request = await tx.uploadRequest.create({
          data: {
            tokenHash,
            title: input.title,
            instructions: input.instructions,
            status: "OPEN",
            expiresAt,
            maxItems: input.maxItems,
            targetAssetId: target.targetAssetId,
            targetRevisionId: target.targetRevisionId,
            targetAssetVersion: target.targetAssetVersion,
            createdAt: now,
          },
        });

        await createActivityTx(tx, {
          entityType: "UPLOAD_REQUEST",
          entityId: request.id,
          action: "UPLOAD_LINK_CREATED",
          summary: "Created upload link",
          source,
          metadata: {
            title: input.title,
            maxItems: input.maxItems,
            expiresInDays: input.expiresInDays,
            targetAssetId: target.targetAssetId,
            targetRevisionId: target.targetRevisionId,
            targetAssetVersion: target.targetAssetVersion,
          },
        });

        return request;
      },
      { maxWait: 15000, timeout: 60000 },
    );

    // The raw token is returned exactly once, after a successful commit.
    return ok({
      id: created.id,
      uploadUrl: `${trustedOrigin}/upload/${rawToken}`,
      expiresAt: created.expiresAt.toISOString(),
    });
  } catch (error) {
    return mapUploadRequestError(error);
  }
}

export async function listUploadRequests(
  rawQuery: unknown = {},
): Promise<ServiceResult<{ items: UploadRequestDto[]; total: number; limit: number; offset: number }>> {
  const parsed = ListUploadRequestsQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const { status, limit, offset } = parsed.data;

  try {
    const prisma = getPrisma();
    const where: Prisma.UploadRequestWhereInput = status ? { status } : {};

    const [rows, total] = await Promise.all([
      prisma.uploadRequest.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
        skip: offset,
      }),
      prisma.uploadRequest.count({ where }),
    ]);

    return ok({
      items: rows.map(mapRequestToDto),
      total,
      limit,
      offset,
    });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function getPublicUploadRequest(
  rawToken: string,
): Promise<
  ServiceResult<{
    title: string;
    instructions: string;
    expiresAt: string;
    maxItems: number;
    targetingMode: "NEW_ASSETS" | "NEW_REVISION" | "APPEND_REPRESENTATIONS";
    status: EffectiveUploadRequestStatus;
    submissionReceipt?: {
      submissionKey: string;
      submittedAt: string;
      itemCount: number;
    } | null;
  }>
> {
  if (!isRawUploadToken(rawToken)) {
    return fail("NOT_FOUND", "Upload link not found.");
  }

  try {
    const prisma = getPrisma();
    const tokenHash = await hashUploadToken(rawToken);

    const request = await prisma.uploadRequest.findUnique({
      where: { tokenHash },
      select: {
        title: true,
        instructions: true,
        status: true,
        expiresAt: true,
        maxItems: true,
        targetAssetId: true,
        targetRevisionId: true,
        submissionReceipt: true,
      },
    });

    if (!request) {
      return fail("NOT_FOUND", "Upload link not found.");
    }

    const effectiveStatus = getEffectiveUploadRequestStatus(
      request.status,
      request.expiresAt,
    );

    let targetingMode: "NEW_ASSETS" | "NEW_REVISION" | "APPEND_REPRESENTATIONS" = "NEW_ASSETS";
    if (request.targetRevisionId) {
      targetingMode = "APPEND_REPRESENTATIONS";
    } else if (request.targetAssetId) {
      targetingMode = "NEW_REVISION";
    }

    const receipt = request.submissionReceipt as
      | { submissionKey?: string; submittedAt?: string; itemCount?: number }
      | null
      | undefined;

    return ok({
      title: request.title,
      instructions: request.instructions,
      expiresAt: request.expiresAt.toISOString(),
      maxItems: request.maxItems,
      targetingMode,
      status: effectiveStatus,
      submissionReceipt: receipt
        ? {
            submissionKey: receipt.submissionKey ?? "",
            submittedAt: receipt.submittedAt ?? "",
            itemCount: receipt.itemCount ?? 0,
          }
        : null,
    });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function getUploadRequest(
  rawInput: unknown,
): Promise<ServiceResult<{ request: UploadRequestDto; files: UploadFileDto[] }>> {
  const parsed = GetUploadRequestInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  try {
    const prisma = getPrisma();
    const request = await prisma.uploadRequest.findUnique({
      where: { id: parsed.data.id },
      include: { files: { orderBy: { createdAt: "asc" } } },
    });
    if (!request) {
      return fail("NOT_FOUND", `Upload request ${parsed.data.id} not found.`);
    }

    return ok({
      request: mapRequestToDto(request),
      files: request.files.map(mapFileToDto),
    });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function revokeUploadRequest(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<{ id: string; status: "REVOKED" | "SUBMITTED" }>> {
  const parsed = RevokeUploadRequestInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;

  try {
    const prisma = getPrisma();

    const result = await prisma.$transaction(
      async (tx) => {
        const locked = await lockUploadRequestById(tx, input.id);
        if (!locked) {
          throw new Error("NOT_FOUND");
        }
        if (locked.status === "SUBMITTED") {
          throw new Error("UPLOAD_ALREADY_SUBMITTED");
        }
        if (locked.status === "REVOKED") {
          // Idempotent repeat: no state change and no Activity.
          return { id: locked.id, status: "SUBMITTED" as const, noop: true };
        }

        await tx.uploadRequest.update({
          where: { id: locked.id },
          data: { status: "REVOKED", revokedAt: new Date() },
        });

        await createActivityTx(tx, {
          entityType: "UPLOAD_REQUEST",
          entityId: locked.id,
          action: "UPLOAD_LINK_REVOKED",
          summary: "Revoked upload link",
          source,
          metadata: null,
        });

        return { id: locked.id, status: "REVOKED" as const, noop: false };
      },
      { maxWait: 15000, timeout: 60000 },
    );

    return ok({ id: result.id, status: result.status });
  } catch (error) {
    return mapUploadRequestError(error, input.id);
  }
}

export async function regenerateUploadRequest(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<{ id: string; replacedId: string; uploadUrl: string; expiresAt: string }>> {
  const parsed = RegenerateUploadRequestInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;
  const trustedOrigin = getTrustedOrigin();
  if (trustedOrigin === null) {
    return fail(
      "AUTH_NOT_CONFIGURED",
      "A valid CAMPAIGNOS_BASE_URL is required to regenerate upload links.",
    );
  }

  try {
    const prisma = getPrisma();

    const rawToken = generateUploadToken();
    const tokenHash = await hashUploadToken(rawToken);

    const result = await prisma.$transaction(
      async (tx) => {
        const locked = await lockUploadRequestById(tx, input.id);
        if (!locked) {
          throw new Error("NOT_FOUND");
        }
        if (locked.status === "SUBMITTED") {
          throw new Error("UPLOAD_ALREADY_SUBMITTED");
        }
        const replacement = await tx.uploadRequest.findFirst({
          where: { replacesId: locked.id },
          select: { id: true },
        });
        if (replacement) {
          throw new Error("ALREADY_REGENERATED");
        }
        if (locked.status === "REVOKED") {
          throw new Error("UPLOAD_REVOKED");
        }
        if (locked.expiresAt.getTime() <= Date.now()) {
          throw new Error("UPLOAD_EXPIRED");
        }

        // Re-resolve targets with the current asset version; the old snapshot
        // is never reused.
        const target = await resolveUploadTargetTx(tx, {
          targetAssetId: locked.targetAssetId,
          targetRevisionId: locked.targetRevisionId,
        });

        const now = new Date();
        const created = await tx.uploadRequest.create({
          data: {
            tokenHash,
            title: locked.title,
            instructions: locked.instructions,
            status: "OPEN",
            expiresAt: new Date(now.getTime() + 7 * MS_PER_DAY),
            maxItems: locked.maxItems,
            targetAssetId: target.targetAssetId,
            targetRevisionId: target.targetRevisionId,
            targetAssetVersion: target.targetAssetVersion,
            replacesId: locked.id,
            createdAt: now,
          },
        });

        // Regeneration never resets the old row to OPEN: it is revoked here.
        await tx.uploadRequest.update({
          where: { id: locked.id },
          data: { status: "REVOKED", revokedAt: now },
        });

        await createActivityTx(tx, {
          entityType: "UPLOAD_REQUEST",
          entityId: locked.id,
          action: "UPLOAD_LINK_REVOKED",
          summary: "Revoked upload link via regeneration",
          source,
          metadata: { replacementId: created.id },
        });

        await createActivityTx(tx, {
          entityType: "UPLOAD_REQUEST",
          entityId: created.id,
          action: "UPLOAD_LINK_REGENERATED",
          summary: "Regenerated upload link",
          source,
          metadata: { replacedId: locked.id },
        });

        return created;
      },
      { maxWait: 15000, timeout: 60000 },
    );

    return ok({
      id: result.id,
      replacedId: input.id,
      uploadUrl: `${trustedOrigin}/upload/${rawToken}`,
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (error) {
    return mapUploadRequestError(error, input.id);
  }
}

export function mapUploadRequestError(error: unknown, requestId?: string): ServiceResult<never> {
  const message = error instanceof Error ? error.message : "";

  if (message === "NOT_FOUND" || message === "TARGET_NOT_FOUND") {
    return fail("NOT_FOUND", `Upload target not found.${requestId ? ` Request: ${requestId}.` : ""}`);
  }
  if (message === "TARGET_MISMATCH") {
    return fail(
      "VALIDATION_ERROR",
      "The supplied target asset and revision do not belong to the same asset.",
    );
  }
  if (message === "SUPERSEDED_REJECTED") {
    return fail(
      "VALIDATION_ERROR",
      "Asset is SUPERSEDED; upload requests targeting it are rejected until an explicit status update restores it.",
    );
  }
  if (message === "UPLOAD_ALREADY_SUBMITTED") {
    return fail("UPLOAD_ALREADY_SUBMITTED", "The upload request has already been submitted.");
  }
  if (message === "UPLOAD_REVOKED") {
    return fail("UPLOAD_REVOKED", "The upload request has been revoked.");
  }
  if (message === "UPLOAD_EXPIRED") {
    return fail("UPLOAD_EXPIRED", "The upload request has expired.");
  }
  if (message === "ALREADY_REGENERATED") {
    return fail("ALREADY_EXISTS", "This upload request has already been regenerated.");
  }
  if (message === "VERSION_CONFLICT") {
    return fail(
      "VERSION_CONFLICT",
      "The targeted asset was modified concurrently; regenerate the upload request to refresh the target.",
    );
  }
  if (message === "REQUEST_STATE_CHANGED") {
    return fail(
      "VERSION_CONFLICT",
      "The upload request changed state concurrently; the submission was not recorded.",
    );
  }
  if (message === "FILE_NOT_FOUND") {
    return fail("NOT_FOUND", "Upload file or request not found.");
  }
  if (message === "FILE_ITEM_MISMATCH") {
    return fail("VALIDATION_ERROR", "The file does not belong to the submitted client item.");
  }
  if (message === "UPLOAD_NOT_READY") {
    return fail(
      "UPLOAD_NOT_READY",
      "One or more selected files are not VERIFIED; finalize is disabled until every selected file is verified.",
    );
  }
  if (message === "UPLOAD_LIMIT_EXCEEDED") {
    return fail(
      "UPLOAD_LIMIT_EXCEEDED",
      "The submission exceeds the request's item or verified-byte limits.",
    );
  }
  if (message === "FILE_ALREADY_ATTACHED") {
    return fail("VALIDATION_ERROR", "The file is already attached to a representation.");
  }
  return handleServiceError(error);
}
