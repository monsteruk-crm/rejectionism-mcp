import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { authenticateUploadRequest } from "@/lib/uploads/upload-auth";
import { getUploadRequestStatus } from "@/lib/campaign/upload-status";
import { serviceErrorResponse, UPLOAD_SECURITY_HEADERS } from "@/lib/uploads/capability-auth";

/**
 * GET /api/uploads/status
 * Retrieves request status, file reservations, and receipt without token query params.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  // Same-origin browser GET requests commonly omit Origin. Supplied origins
  // are still checked, while authentication remains mandatory.
  const auth = await authenticateUploadRequest(req, { allowMissingOrigin: true });
  if (!auth.ok) {
    return auth.response;
  }

  const result = await getUploadRequestStatus(auth.requestId, auth.authMode);
  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json(result.data, {
    status: 200,
    headers: UPLOAD_SECURITY_HEADERS,
  });
}
