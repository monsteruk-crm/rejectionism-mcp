import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { reserveUploadFile } from "@/lib/campaign/upload-files";
import {
  extractUploadCapability,
  parseBoundedJsonBody,
  serviceErrorResponse,
  UPLOAD_SECURITY_HEADERS,
} from "@/lib/uploads/capability-auth";

/**
 * POST /api/uploads/prepare
 * Reserves an immutable UploadFile slot for a valid capability token.
 * Max body size: 16 KB.
 */

const MAX_PREPARE_BODY_BYTES = 16_384;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = extractUploadCapability(req);
  if (!auth.ok) {
    return auth.response;
  }

  const parsed = await parseBoundedJsonBody<unknown>(req, MAX_PREPARE_BODY_BYTES);
  if (!parsed.ok) {
    return parsed.response;
  }

  const result = await reserveUploadFile(auth.token, parsed.data);
  if (!result.ok) {
    return serviceErrorResponse(result.error);
  }

  return NextResponse.json(
    {
      ok: true,
      fileId: result.data.fileId,
      blobPathname: result.data.blobPathname,
      clientItemId: result.data.clientItemId,
    },
    {
      status: 200,
      headers: UPLOAD_SECURITY_HEADERS,
    },
  );
}
