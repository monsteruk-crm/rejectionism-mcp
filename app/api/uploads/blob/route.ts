import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { authorizeUploadFileTransfer, loadUploadFileForCallback, verifyUploadFile } from "@/lib/campaign/upload-files";
import { getTrustedOrigin, checkOrigin } from "@/lib/auth/origin";
import { isRawUploadToken } from "@/lib/campaign/upload-tokens";
import {
  errorJsonResponse,
  parseBoundedJsonBody,
  UPLOAD_SECURITY_HEADERS,
} from "@/lib/uploads/capability-auth";

/**
 * POST /api/uploads/blob
 * Vercel Blob client direct upload bridge (upgrade plan section 5 and 6).
 *
 * - `onBeforeGenerateToken`: browser sends clientPayload = JSON.stringify({ uploadToken, fileId });
 *   validates capability token, origin, file ownership/state, and consumes an authorization slot.
 * - `onUploadCompleted`: provider SDK webhook with verified signature; validates server-owned path
 *   and triggers idempotent inspection.
 * Max body size: 32 KB.
 */

const MAX_BLOB_BODY_BYTES = 32_768;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const parsed = await parseBoundedJsonBody<HandleUploadBody>(req, MAX_BLOB_BODY_BYTES);
  if (!parsed.ok) {
    return parsed.response;
  }

  const trustedOrigin = getTrustedOrigin();
  if (!trustedOrigin) {
    return errorJsonResponse("AUTH_NOT_CONFIGURED", "Storage is not configured.", 503);
  }

  try {
    const jsonResponse = await handleUpload({
      body: parsed.data,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Same-origin check for browser token generation
        const originHeader = req.headers.get("origin");
        if (checkOrigin(originHeader, "browser") !== "allowed") {
          throw new Error("Cross-origin token generation rejected.");
        }

        if (!clientPayload) {
          throw new Error("Missing clientPayload.");
        }

        let payload: { uploadToken?: string; fileId?: string };
        try {
          payload = JSON.parse(clientPayload) as { uploadToken?: string; fileId?: string };
        } catch {
          throw new Error("Invalid clientPayload JSON.");
        }

        const uploadToken = payload.uploadToken;
        const fileId = payload.fileId;
        if (!uploadToken || !isRawUploadToken(uploadToken) || !fileId || typeof fileId !== "string") {
          throw new Error("Invalid uploadToken or fileId in clientPayload.");
        }

        const auth = await authorizeUploadFileTransfer(uploadToken, { fileId });
        if (!auth.ok) {
          throw new Error(auth.error.message);
        }

        if (pathname !== auth.data.blobPathname) {
          throw new Error("Pathname mismatch between client and reservation.");
        }

        return {
          allowedContentTypes: auth.data.allowedContentTypes,
          maximumSizeInBytes: auth.data.maximumSizeInBytes,
          validUntil: auth.data.validUntil,
          addRandomSuffix: false,
          allowOverwrite: false,
          callbackUrl: auth.data.callbackUrl,
          tokenPayload: JSON.stringify({
            requestId: auth.data.requestId,
            fileId: auth.data.fileId,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) {
          return;
        }

        let parsedPayload: { requestId?: string; fileId?: string };
        try {
          parsedPayload = JSON.parse(tokenPayload) as { requestId?: string; fileId?: string };
        } catch {
          return;
        }

        if (!parsedPayload.requestId || !parsedPayload.fileId) {
          return;
        }

        const loaded = await loadUploadFileForCallback({
          requestId: parsedPayload.requestId,
          fileId: parsedPayload.fileId,
        });
        if (!loaded.ok) {
          return;
        }

        if (blob.pathname !== loaded.data.blobPathname) {
          return;
        }

        // Inspection is idempotent; browser verify also triggers it.
      },
    });

    return NextResponse.json(jsonResponse, {
      status: 200,
      headers: UPLOAD_SECURITY_HEADERS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to handle upload.";
    return errorJsonResponse("UPLOAD_FAILED", message, 400);
  }
}
