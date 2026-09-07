import "server-only";
import { getPrisma } from "@/lib/prisma";
import { ok, fail, handleServiceError, ServiceResult } from "./results";
import { BlobStorageProvider, StorageConfigurationError, StorageUnavailableError } from "./storage";
import { getStorageProvider } from "../storage/vercel-blob";
import { getTrustedOrigin } from "../auth/origin";
import { lockUploadRequestByHash, getEffectiveUploadRequestStatus, mapUploadRequestError } from "./upload-requests";
import { ReserveUploadFileInputSchema } from "./upload-schemas";
import {
  canonicalExtensionForStoredMime,
  detectMimeTypeFromBytes,
  extractImageDimensions,
  imageDimensionsExceedLimits,
  INSPECTION_PREFIX_BYTES,
  isAllowedMimeType,
  MAX_SVG_BYTES,
  MAX_RESERVATION_BYTES,
  sanitizeUploadFilename,
  validateSvgDocument,
} from "./file-validation";
import { hashUploadToken, isRawUploadToken } from "./upload-tokens";

/**
 * Upload file reservation, bounded authorization, and idempotent inspection
 * (upgrade plan section 6, "Preparation and Blob authorization" and
 * "Verification and callback behavior").
 *
 * - The reservation is an immutable UploadFile row: the same clientItemId
 *   with the same metadata returns the same fileId/path; different metadata
 *   for that ID is a validation error. The storage path is server-generated
 *   (`campaignos/uploads/<requestId>/<fileId>.<canonicalExtension>`); a
 *   supplied pathname or the filename extension is never trusted.
 * - Lifetime reservations per request are bounded by `3 * maxItems` slots
 *   and 1073741824 summed expected bytes, counting all historical rows
 *   (including rejected/discarded) so retries cannot reset the budget.
 * - Authorization is bounded: at most three per slot, each with a short
 *   expiry bounded by the request expiry.
 * - Inspection (verification) validates request state and file ownership,
 *   performs provider reads outside any database transaction, and never
 *   fetches a browser-provided Blob URL. A missing Blob leaves the file
 *   PENDING; deterministic format/size failures persist REJECTED with a
 *   fixed failure code; transient failures leave PENDING and return
 *   retryable unavailability.
 */

const AUTHORIZATION_WINDOW_MS = 600_000;
const MAX_AUTHORIZATIONS_PER_SLOT = 3;

/** Fixed failure codes persisted on REJECTED UploadFiles. */
export type UploadFileFailureCode =
  | "SIZE_MISMATCH"
  | "MIME_MISMATCH"
  | "FORMAT_NOT_ALLOWED"
  | "SVG_MALFORMED"
  | "DIMENSIONS_EXCEEDED";

export interface ReserveUploadFileResult {
  requestId: string;
  fileId: string;
  clientItemId: string;
  blobPathname: string;
  declaredMimeType: string;
  expectedByteSize: number;
}

export interface UploadAuthorizationResult {
  requestId: string;
  fileId: string;
  blobPathname: string;
  allowedContentTypes: [string];
  maximumSizeInBytes: number;
  validUntil: number;
  addRandomSuffix: false;
  allowOverwrite: false;
  callbackUrl: string;
  authorizationCount: number;
  authorizationExpiresAt: string;
}

export type UploadFileInspectionStatus =
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "ATTACHED"
  | "DISCARDED";

export interface UploadFileInspectionResult {
  fileId: string;
  status: UploadFileInspectionStatus;
  mutated: boolean;
  /** True when the failure is transient and verification may be retried. */
  retryable: boolean;
  mimeType?: string;
  byteSize?: number;
  width?: number | null;
  height?: number | null;
  failureCode?: UploadFileFailureCode;
}

export async function reserveUploadFileByRequestId(
  requestId: string,
  rawInput: unknown,
): Promise<ServiceResult<ReserveUploadFileResult>> {
  const parsed = ReserveUploadFileInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;
  const declaredMimeType = input.declaredMimeType;
  if (!isAllowedMimeType(declaredMimeType)) {
    return fail("VALIDATION_ERROR", "Declared MIME type is not an allowed format.");
  }

  try {
    const prisma = getPrisma();

    const reserved = await prisma.$transaction(
      async (tx) => {
        const locked = await tx.uploadRequest.findUnique({
          where: { id: requestId },
        });
        if (!locked) {
          throw new Error("NOT_FOUND");
        }

        const effective = getEffectiveUploadRequestStatus(locked.status, locked.expiresAt);
        if (effective === "SUBMITTED") {
          throw new Error("UPLOAD_ALREADY_SUBMITTED");
        }
        if (effective === "REVOKED") {
          throw new Error("UPLOAD_REVOKED");
        }
        if (effective === "EXPIRED") {
          throw new Error("UPLOAD_EXPIRED");
        }

        const existing = await tx.uploadFile.findUnique({
          where: {
            uploadRequestId_clientItemId: {
              uploadRequestId: locked.id,
              clientItemId: input.clientItemId,
            },
          },
        });

        const sanitizedFilename = sanitizeUploadFilename(input.sourceFilename);
        if (!sanitizedFilename) {
          throw new Error("INVALID_FILENAME");
        }

        if (existing) {
          if (
            existing.sourceFilename === sanitizedFilename &&
            existing.declaredMimeType === declaredMimeType &&
            Number(existing.expectedByteSize) === input.expectedByteSize
          ) {
            return {
              requestId: locked.id,
              fileId: existing.id,
              clientItemId: existing.clientItemId,
              blobPathname: existing.blobPathname,
              declaredMimeType: existing.declaredMimeType,
              expectedByteSize: Number(existing.expectedByteSize),
            };
          }
          throw new Error("RESERVATION_IMMUTABLE");
        }

        const slotCount = await tx.uploadFile.count({
          where: { uploadRequestId: locked.id },
        });
        if (slotCount >= 3 * locked.maxItems) {
          throw new Error("UPLOAD_LIMIT_EXCEEDED");
        }

        const byteSum = await tx.uploadFile.aggregate({
          _sum: { expectedByteSize: true },
          where: { uploadRequestId: locked.id },
        });
        const summedBytes = Number(byteSum._sum.expectedByteSize ?? 0);
        if (summedBytes + input.expectedByteSize > MAX_RESERVATION_BYTES) {
          throw new Error("UPLOAD_LIMIT_EXCEEDED");
        }

        const extension = canonicalExtensionForStoredMime(declaredMimeType);
        const created = await tx.uploadFile.create({
          data: {
            uploadRequestId: locked.id,
            clientItemId: input.clientItemId,
            status: "PENDING",
            sourceFilename: sanitizedFilename,
            declaredMimeType,
            expectedByteSize: BigInt(input.expectedByteSize),
            blobPathname: `campaignos/uploads/${locked.id}/${crypto.randomUUID()}.pending`,
          },
        });

        const blobPathname = `campaignos/uploads/${locked.id}/${created.id}.${extension}`;
        await tx.uploadFile.update({
          where: { id: created.id },
          data: { blobPathname },
        });

        return {
          requestId: locked.id,
          fileId: created.id,
          clientItemId: created.clientItemId,
          blobPathname,
          declaredMimeType,
          expectedByteSize: input.expectedByteSize,
        };
      },
      { maxWait: 15000, timeout: 60000 },
    );

    return ok(reserved);
  } catch (error) {
    return mapUploadFileError(error);
  }
}

/**
 * Reserves one immutable UploadFile slot for a valid OPEN request. The raw
 * capability token authorizes the call; the token itself is never persisted.
 */
export async function reserveUploadFile(
  rawToken: string,
  rawInput: unknown,
): Promise<ServiceResult<ReserveUploadFileResult>> {
  if (!isRawUploadToken(rawToken)) {
    return fail("VALIDATION_ERROR", "Malformed upload capability token.");
  }

  try {
    const prisma = getPrisma();
    const tokenHash = await hashUploadToken(rawToken);
    const request = await prisma.uploadRequest.findUnique({
      where: { tokenHash },
      select: { id: true },
    });
    if (!request) {
      return fail("NOT_FOUND", "Upload request not found.");
    }
    return reserveUploadFileByRequestId(request.id, rawInput);
  } catch (error) {
    return mapUploadFileError(error);
  }
}

export async function authorizeUploadFileTransferByRequestId(
  requestId: string,
  input: { fileId: string },
): Promise<ServiceResult<UploadAuthorizationResult>> {
  const trustedOrigin = getTrustedOrigin();
  if (trustedOrigin === null) {
    return fail(
      "AUTH_NOT_CONFIGURED",
      "A valid CAMPAIGNOS_BASE_URL is required to authorize uploads.",
    );
  }

  try {
    const prisma = getPrisma();

    const result = await prisma.$transaction(
      async (tx) => {
        const lockedRequest = await tx.uploadRequest.findUnique({
          where: { id: requestId },
        });
        if (!lockedRequest) {
          throw new Error("NOT_FOUND");
        }

        const effective = getEffectiveUploadRequestStatus(lockedRequest.status, lockedRequest.expiresAt);
        if (effective === "SUBMITTED") {
          throw new Error("UPLOAD_ALREADY_SUBMITTED");
        }
        if (effective === "REVOKED") {
          throw new Error("UPLOAD_REVOKED");
        }
        if (effective === "EXPIRED") {
          throw new Error("UPLOAD_EXPIRED");
        }

        const file = await tx.uploadFile.findUnique({
          where: { id: input.fileId },
        });
        if (!file || file.uploadRequestId !== lockedRequest.id) {
          throw new Error("FILE_NOT_FOUND");
        }

        if (file.status === "VERIFIED") {
          throw new Error("UPLOAD_NOT_READY");
        }
        if (file.status === "REJECTED") {
          throw new Error("UPLOAD_FILE_REJECTED");
        }
        if (file.status !== "PENDING") {
          throw new Error("FILE_NOT_AVAILABLE");
        }

        const expectedPath = `campaignos/uploads/${lockedRequest.id}/${file.id}.${canonicalExtensionForStoredMime(
          file.declaredMimeType,
        )}`;
        if (file.blobPathname !== expectedPath) {
          throw new Error("FILE_NOT_FOUND");
        }

        if (file.authorizationCount >= MAX_AUTHORIZATIONS_PER_SLOT) {
          throw new Error("UPLOAD_LIMIT_EXCEEDED");
        }

        const now = new Date();
        const authorizationExpiresAt = new Date(
          Math.min(now.getTime() + AUTHORIZATION_WINDOW_MS, lockedRequest.expiresAt.getTime()),
        );

        const updated = await tx.uploadFile.updateMany({
          where: {
            id: file.id,
            authorizationCount: { lt: MAX_AUTHORIZATIONS_PER_SLOT },
          },
          data: {
            authorizationCount: { increment: 1 },
            authorizationExpiresAt,
          },
        });
        if (updated.count === 0) {
          throw new Error("UPLOAD_LIMIT_EXCEEDED");
        }

        return {
          requestId: lockedRequest.id,
          fileId: file.id,
          blobPathname: file.blobPathname,
          allowedContentTypes: [file.declaredMimeType] as [string],
          maximumSizeInBytes: Number(file.expectedByteSize),
          validUntil: authorizationExpiresAt.getTime(),
          addRandomSuffix: false as const,
          allowOverwrite: false as const,
          callbackUrl: `${trustedOrigin}/api/uploads/blob`,
          authorizationCount: file.authorizationCount + 1,
          authorizationExpiresAt: authorizationExpiresAt.toISOString(),
        };
      },
      { maxWait: 15000, timeout: 60000 },
    );

    return ok(result);
  } catch (error) {
    return mapUploadFileError(error);
  }
}

/**
 * Bounded authorization for one direct browser→Blob transfer (the service
 * behind the SDK's onBeforeGenerateToken callback).
 */
export async function authorizeUploadFileTransfer(
  rawToken: string,
  input: { fileId: string },
): Promise<ServiceResult<UploadAuthorizationResult>> {
  if (!isRawUploadToken(rawToken)) {
    return fail("VALIDATION_ERROR", "Malformed upload capability token.");
  }

  try {
    const prisma = getPrisma();
    const tokenHash = await hashUploadToken(rawToken);
    const request = await prisma.uploadRequest.findUnique({
      where: { tokenHash },
      select: { id: true },
    });
    if (!request) {
      return fail("NOT_FOUND", "Upload request not found.");
    }
    return authorizeUploadFileTransferByRequestId(request.id, input);
  } catch (error) {
    return mapUploadFileError(error);
  }
}

/**
 * Loads a reserved file for the SDK callback path. The caller has already
 * validated the provider signature and parsed the authenticated tokenPayload
 * (`{requestId,fileId}` exactly); this re-checks ownership and returns the
 * server-owned pathname the callback must match. Callback data never creates
 * an Asset and never marks the request SUBMITTED.
 */
export async function loadUploadFileForCallback(
  payload: { requestId: string; fileId: string },
): Promise<
  ServiceResult<{
    requestId: string;
    fileId: string;
    blobPathname: string;
    effectiveRequestStatus: "OPEN" | "SUBMITTED" | "REVOKED" | "EXPIRED";
    fileStatus: UploadFileInspectionStatus;
  }>
> {
  try {
    const prisma = getPrisma();
    const file = await prisma.uploadFile.findUnique({
      where: { id: payload.fileId },
      include: { uploadRequest: { select: { id: true, status: true, expiresAt: true } } },
    });
    if (!file || file.uploadRequest.id !== payload.requestId) {
      return fail("NOT_FOUND", "Upload file not found for this request.");
    }

    return ok({
      requestId: file.uploadRequest.id,
      fileId: file.id,
      blobPathname: file.blobPathname,
      effectiveRequestStatus: getEffectiveUploadRequestStatus(
        file.uploadRequest.status,
        file.uploadRequest.expiresAt,
      ),
      fileStatus: file.status,
    });
  } catch (error) {
    return handleServiceError(error);
  }
}

interface InspectionRow {
  request: {
    id: string;
    status: "OPEN" | "SUBMITTED" | "REVOKED";
    expiresAt: Date;
  };
  file: {
    id: string;
    status: "PENDING" | "VERIFIED" | "REJECTED" | "ATTACHED" | "DISCARDED";
    blobPathname: string;
    declaredMimeType: string;
    expectedByteSize: bigint;
  };
}

async function loadInspectionRow(
  tokenHash: string,
  fileId: string,
): Promise<InspectionRow | null> {
  const client = getPrisma();
  const request = await client.uploadRequest.findUnique({
    where: { tokenHash },
    select: { id: true, status: true, expiresAt: true },
  });
  if (!request) {
    return null;
  }
  // Ownership is enforced by scoping the file lookup to this request.
  const file = await client.uploadFile.findFirst({
    where: { id: fileId, uploadRequestId: request.id },
    select: {
      id: true,
      status: true,
      blobPathname: true,
      declaredMimeType: true,
      expectedByteSize: true,
    },
  });
  if (!file) {
    return null;
  }
  return {
    request: { id: request.id, status: request.status, expiresAt: request.expiresAt },
    file: {
      id: file.id,
      status: file.status,
      blobPathname: file.blobPathname,
      declaredMimeType: file.declaredMimeType,
      expectedByteSize: file.expectedByteSize,
    },
  };
}

function inspectionResult(row: InspectionRow, mutated: boolean): UploadFileInspectionResult {
  return { fileId: row.file.id, status: row.file.status, mutated, retryable: false };
}

export async function inspectAndVerifyUploadFile(
  requestId: string,
  fileId: string,
  options: { provider?: BlobStorageProvider } = {},
): Promise<ServiceResult<UploadFileInspectionResult>> {
  const provider = options.provider ?? getStorageProvider();

  try {
    const prisma = getPrisma();

    const file = await prisma.uploadFile.findFirst({
      where: { id: fileId, uploadRequestId: requestId },
      include: { uploadRequest: { select: { id: true, status: true, expiresAt: true } } },
    });
    if (!file) {
      return fail("NOT_FOUND", "Upload file not found for this request.");
    }

    const effective = getEffectiveUploadRequestStatus(
      file.uploadRequest.status,
      file.uploadRequest.expiresAt,
    );

    if (file.status === "VERIFIED") {
      return ok({
        fileId: file.id,
        status: "VERIFIED",
        mutated: false,
        retryable: false,
        mimeType: file.mimeType ?? undefined,
        byteSize: file.byteSize !== null ? Number(file.byteSize) : undefined,
        width: file.width,
        height: file.height,
      });
    }

    if (effective !== "OPEN" || file.status !== "PENDING") {
      return ok({
        fileId: file.id,
        status: file.status,
        mutated: false,
        retryable: false,
        failureCode: file.failureCode as UploadFileFailureCode | undefined,
      });
    }

    // Provider reads outside database transaction
    const head = await provider.head(file.blobPathname);

    let failureCode: UploadFileFailureCode | null = null;
    let verifiedMimeType: string | null = null;
    let verifiedByteSize: number | null = null;
    let width: number | null = null;
    let height: number | null = null;
    let blobUrl: string | null = null;

    if (head === null) {
      return ok({
        fileId: file.id,
        status: "PENDING",
        mutated: false,
        retryable: true,
      });
    }

    blobUrl = head.url ?? null;

    if (head.size !== Number(file.expectedByteSize)) {
      failureCode = "SIZE_MISMATCH";
    } else if (file.declaredMimeType === "image/svg+xml") {
      const bytes = await provider.readSmallFile(file.blobPathname, MAX_SVG_BYTES);
      const svg = validateSvgDocument(bytes);
      if (svg.ok) {
        verifiedMimeType = file.declaredMimeType;
        verifiedByteSize = head.size;
      } else {
        failureCode = "SVG_MALFORMED";
      }
    } else {
      const prefix = await provider.readPrefix(file.blobPathname, INSPECTION_PREFIX_BYTES);
      const detected = await detectMimeTypeFromBytes(prefix);
      if (detected === null || !isAllowedMimeType(detected)) {
        failureCode = "FORMAT_NOT_ALLOWED";
      } else if (detected !== file.declaredMimeType) {
        failureCode = "MIME_MISMATCH";
      } else {
        verifiedMimeType = detected;
        verifiedByteSize = head.size;
        if (
          detected === "image/png" ||
          detected === "image/jpeg" ||
          detected === "image/gif" ||
          detected === "image/webp"
        ) {
          const dimensions = extractImageDimensions(prefix);
          if (dimensions && imageDimensionsExceedLimits(dimensions)) {
            failureCode = "DIMENSIONS_EXCEEDED";
            verifiedMimeType = null;
            verifiedByteSize = null;
          } else if (dimensions) {
            width = dimensions.width;
            height = dimensions.height;
          }
        }
      }
    }

    // Short terminal write transaction
    const result = await prisma.$transaction(
      async (tx) => {
        const currentRequest = await tx.uploadRequest.findUnique({
          where: { id: requestId },
          select: { id: true, status: true, expiresAt: true },
        });
        if (!currentRequest) {
          throw new Error("NOT_FOUND");
        }
        const currentEffective = getEffectiveUploadRequestStatus(
          currentRequest.status,
          currentRequest.expiresAt,
        );

        const currentFile = await tx.uploadFile.findUnique({
          where: { id: file.id },
          select: { id: true, status: true },
        });
        if (!currentFile) {
          throw new Error("FILE_NOT_FOUND");
        }

        if (currentEffective !== "OPEN" || currentFile.status !== "PENDING") {
          return { mutated: false, status: currentFile.status };
        }

        if (failureCode !== null) {
          await tx.uploadFile.update({
            where: { id: currentFile.id },
            data: { status: "REJECTED", failureCode, verifiedAt: new Date() },
          });
          return { mutated: true, status: "REJECTED" as const };
        }

        await tx.uploadFile.update({
          where: { id: currentFile.id },
          data: {
            status: "VERIFIED",
            mimeType: verifiedMimeType,
            byteSize: verifiedByteSize === null ? null : BigInt(verifiedByteSize),
            width,
            height,
            blobUrl,
            verifiedAt: new Date(),
            failureCode: null,
          },
        });
        return { mutated: true, status: "VERIFIED" as const };
      },
      { maxWait: 15000, timeout: 60000 },
    );

    return ok({
      fileId: file.id,
      status: result.status,
      mutated: result.mutated,
      retryable: false,
      ...(result.status === "VERIFIED"
        ? {
            mimeType: verifiedMimeType ?? undefined,
            byteSize: verifiedByteSize ?? undefined,
            width,
            height,
          }
        : {}),
      ...(result.status === "REJECTED" && failureCode !== null ? { failureCode } : {}),
    });
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      return fail("AUTH_NOT_CONFIGURED", error.message);
    }
    if (error instanceof StorageUnavailableError) {
      return fail("STORAGE_UNAVAILABLE", "Blob storage is temporarily unavailable; retry verification.");
    }
    return mapUploadFileError(error);
  }
}

/**
 * Idempotent per-file inspection.
 */
export async function verifyUploadFile(
  rawToken: string,
  input: { fileId: string },
  options: { provider?: BlobStorageProvider } = {},
): Promise<ServiceResult<UploadFileInspectionResult>> {
  if (!isRawUploadToken(rawToken)) {
    return fail("VALIDATION_ERROR", "Malformed upload capability token.");
  }

  try {
    const prisma = getPrisma();
    const tokenHash = await hashUploadToken(rawToken);
    const request = await prisma.uploadRequest.findUnique({
      where: { tokenHash },
      select: { id: true },
    });
    if (!request) {
      return fail("NOT_FOUND", "Upload request not found.");
    }
    return inspectAndVerifyUploadFile(request.id, input.fileId, options);
  } catch (error) {
    return mapUploadFileError(error);
  }
}

function mapUploadFileError(error: unknown): ServiceResult<never> {
  const message = error instanceof Error ? error.message : "";

  if (
    message === "NOT_FOUND" ||
    message === "FILE_NOT_FOUND" ||
    message === "TARGET_NOT_FOUND"
  ) {
    return fail("NOT_FOUND", "Upload file or request not found.");
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
  if (message === "UPLOAD_LIMIT_EXCEEDED") {
    return fail(
      "UPLOAD_LIMIT_EXCEEDED",
      "The upload request's reservation or authorization budget is exhausted.",
    );
  }
  if (message === "UPLOAD_FILE_REJECTED") {
    return fail("UPLOAD_FILE_REJECTED", "The file was rejected during a previous inspection.");
  }
  if (message === "UPLOAD_NOT_READY") {
    return fail(
      "UPLOAD_NOT_READY",
      "The file is already uploaded and verified; its immutable path cannot be reused.",
    );
  }
  if (message === "FILE_NOT_AVAILABLE") {
    return fail("VALIDATION_ERROR", "The file is not available for this operation.");
  }
  if (message === "RESERVATION_IMMUTABLE") {
    return fail(
      "VALIDATION_ERROR",
      "This clientItemId is already reserved with different file metadata.",
    );
  }
  if (message === "INVALID_FILENAME") {
    return fail("VALIDATION_ERROR", "The supplied filename is not usable.");
  }
  return mapUploadRequestError(error);
}
