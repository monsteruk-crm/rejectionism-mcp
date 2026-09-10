import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { inspectAndVerifyUploadFile } from "@/lib/campaign/upload-files";
import { authenticateUploadRequest } from "@/lib/uploads/upload-auth";
import {
  errorJsonResponse,
  parseBoundedJsonBody,
  serviceErrorResponse,
  UPLOAD_SECURITY_HEADERS,
} from "@/lib/uploads/capability-auth";

/**
 * POST /api/uploads/verify
 * Idempotently inspects and verifies an uploaded file.
 * Max body size: 16 KB.
 */

const MAX_VERIFY_BODY_BYTES = 16_384;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateUploadRequest(req);
  if (!auth.ok) {
    return auth.response;
  }

  const parsed = await parseBoundedJsonBody<{ fileId?: string }>(req, MAX_VERIFY_BODY_BYTES);
  if (!parsed.ok) {
    return parsed.response;
  }

  if (!parsed.data.fileId || typeof parsed.data.fileId !== "string") {
    return errorJsonResponse("VALIDATION_ERROR", "fileId must be a non-empty string.", 400);
  }

  const result = await inspectAndVerifyUploadFile(auth.requestId, parsed.data.fileId);
  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json(
    {
      ok: true,
      fileId: result.data.fileId,
      status: result.data.status,
      mimeType: result.data.mimeType ?? null,
      byteSize: result.data.byteSize ?? null,
      width: result.data.width ?? null,
      height: result.data.height ?? null,
      failureCode: result.data.failureCode ?? null,
    },
    {
      status: 200,
      headers: UPLOAD_SECURITY_HEADERS,
    },
  );
}
