import "server-only";
import { getPrisma } from "@/lib/prisma";
import { ok, fail, handleServiceError, ServiceResult } from "./results";
import { getEffectiveUploadRequestStatus } from "./upload-requests";
import type { UploadAuthMode } from "@/lib/uploads/upload-auth";

export interface UploadFileStatusDto {
  id: string;
  clientItemId: string;
  status: "PENDING" | "VERIFIED" | "REJECTED" | "ATTACHED" | "DISCARDED";
  sourceFilename: string;
  declaredMimeType: string;
  expectedByteSize: number;
  byteSize: number | null;
  mimeType: string | null;
  failureCode: string | null;
}

export interface UploadStatusResult {
  requestId: string;
  status: "OPEN" | "SUBMITTED" | "REVOKED";
  effectiveStatus: "OPEN" | "SUBMITTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  maxItems: number;
  files: UploadFileStatusDto[];
  receipt: {
    submissionKey: string;
    submittedAt: string;
    itemCount: number;
    items?: Array<{
      clientItemId: string;
      name: string;
      assetId: string;
      revisionId: string;
      representationId: string;
    }>;
  } | null;
}

export async function getUploadRequestStatus(
  requestId: string,
  authMode: UploadAuthMode,
): Promise<ServiceResult<UploadStatusResult>> {
  try {
    const prisma = getPrisma();
    const request = await prisma.uploadRequest.findUnique({
      where: { id: requestId },
      include: {
        files: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!request) {
      return fail("NOT_FOUND", "Upload request not found.");
    }

    const effectiveStatus = getEffectiveUploadRequestStatus(
      request.status,
      request.expiresAt,
    );

    const files: UploadFileStatusDto[] = request.files.map((f) => ({
      id: f.id,
      clientItemId: f.clientItemId,
      status: f.status,
      sourceFilename: f.sourceFilename,
      declaredMimeType: f.declaredMimeType,
      expectedByteSize: Number(f.expectedByteSize),
      byteSize: f.byteSize !== null ? Number(f.byteSize) : null,
      mimeType: f.mimeType,
      failureCode: f.failureCode,
    }));

    let receiptData: UploadStatusResult["receipt"] = null;
    if (request.submissionReceipt) {
      const stored = request.submissionReceipt as any;
      receiptData = {
        submissionKey: stored.submissionKey ?? request.submissionKey ?? "",
        submittedAt: stored.submittedAt ?? (request.submittedAt ? request.submittedAt.toISOString() : ""),
        itemCount: stored.itemCount ?? files.filter((f) => f.status === "ATTACHED").length,
        ...(authMode === "ADMIN_INTERNAL" && stored.items ? { items: stored.items } : {}),
      };
    }

    return ok({
      requestId: request.id,
      status: request.status,
      effectiveStatus,
      expiresAt: request.expiresAt.toISOString(),
      maxItems: request.maxItems,
      files,
      receipt: receiptData,
    });
  } catch (error) {
    return handleServiceError(error);
  }
}
