import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { finalizeUploadRequestByRequestId } from "@/lib/campaign/upload-finalization";
import { authenticateUploadRequest } from "@/lib/uploads/upload-auth";
import {
  parseBoundedJsonBody,
  serviceErrorResponse,
  UPLOAD_SECURITY_HEADERS,
} from "@/lib/uploads/capability-auth";

/**
 * POST /api/uploads/finalize
 * Atomically finalizes an upload request with identical-replay safety.
 * Max body size: 2 MB.
 */

const MAX_FINALIZE_BODY_BYTES = 2_097_152;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateUploadRequest(req);
  if (!auth.ok) {
    return auth.response;
  }

  const parsed = await parseBoundedJsonBody<unknown>(req, MAX_FINALIZE_BODY_BYTES);
  if (!parsed.ok) {
    return parsed.response;
  }

  const source = auth.authMode === "ADMIN_INTERNAL" ? "admin" : "public-upload";
  const result = await finalizeUploadRequestByRequestId(auth.requestId, parsed.data, source);
  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json(
    {
      ok: true,
      receipt: result.data.receipt,
    },
    {
      status: 200,
      headers: UPLOAD_SECURITY_HEADERS,
    },
  );
}
