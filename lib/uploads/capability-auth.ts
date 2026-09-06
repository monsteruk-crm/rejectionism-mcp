import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { isRawUploadToken } from "@/lib/campaign/upload-tokens";
import { checkOrigin, getTrustedOrigin } from "@/lib/auth/origin";
import { ServiceError, ServiceErrorCode } from "@/lib/campaign/results";

/**
 * Route protection and JSON parsing helper for upload endpoints
 * (upgrade plan section 5, "Public upload and API boundaries"; section 8).
 *
 * - Capability authorization: `Authorization: Upload <token>`.
 * - Same-origin enforcement: rejects absent or mismatched Origin for browser calls.
 * - Streamed byte caps: enforces actual streamed byte count before full buffering.
 * - Fixed JSON error status mapping with safe generic errors.
 */

export const UPLOAD_SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
} as const;

export function mapServiceCodeToHttpStatus(code: ServiceErrorCode | string): number {
  switch (code) {
    case "VALIDATION_ERROR":
    case "UPLOAD_FILE_REJECTED":
    case "UPLOAD_LIMIT_EXCEEDED":
      return 422;
    case "NOT_FOUND":
      return 404;
    case "UPLOAD_EXPIRED":
    case "UPLOAD_REVOKED":
      return 410;
    case "UPLOAD_ALREADY_SUBMITTED":
    case "VERSION_CONFLICT":
    case "ALREADY_EXISTS":
    case "UPLOAD_NOT_READY":
      return 409;
    case "DATABASE_UNAVAILABLE":
    case "STORAGE_UNAVAILABLE":
    case "AUTH_NOT_CONFIGURED":
    case "CONFIGURATION_ERROR":
      return 503;
    case "INTERNAL_ERROR":
    default:
      return 500;
  }
}

export function errorJsonResponse(
  code: string,
  message: string,
  status: number,
  fieldErrors?: Record<string, string[]>,
): NextResponse {
  const body: { ok: false; error: { code: string; message: string; fieldErrors?: Record<string, string[]> } } = {
    ok: false,
    error: {
      code,
      message,
      ...(fieldErrors && Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
    },
  };
  return NextResponse.json(body, {
    status,
    headers: UPLOAD_SECURITY_HEADERS,
  });
}

export function serviceErrorResponse(error: ServiceError): NextResponse {
  const status = mapServiceCodeToHttpStatus(error.code);
  return errorJsonResponse(error.code, error.message, status, error.fieldErrors);
}

export interface CapabilityAuthResult {
  ok: true;
  token: string;
}

export type CapabilityAuthOutcome = CapabilityAuthResult | { ok: false; response: NextResponse };

export function extractUploadCapability(req: NextRequest): CapabilityAuthOutcome {
  // Origin check
  const originHeader = req.headers.get("origin");
  const originOutcome = checkOrigin(originHeader, "browser");
  if (originOutcome !== "allowed") {
    return {
      ok: false,
      response: errorJsonResponse("ORIGIN_REJECTED", "Cross-origin requests are rejected.", 403),
    };
  }

  // Authorization header: "Upload <43-character-token>"
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Upload ")) {
    return {
      ok: false,
      response: errorJsonResponse("INVALID_CAPABILITY", "Missing or malformed upload capability token.", 401),
    };
  }

  const token = authHeader.slice("Upload ".length).trim();
  if (!isRawUploadToken(token)) {
    return {
      ok: false,
      response: errorJsonResponse("INVALID_CAPABILITY", "Invalid upload capability token syntax.", 401),
    };
  }

  return { ok: true, token };
}

export type ParseJsonOutcome<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/**
 * Reads and parses JSON from the request stream with a strict byte cap.
 * Rejects non-JSON Content-Type (415), stream overflow (413), and malformed JSON (400).
 */
export async function parseBoundedJsonBody<T>(
  req: NextRequest,
  maxBytes: number,
): Promise<ParseJsonOutcome<T>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      ok: false,
      response: errorJsonResponse("UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.", 415),
    };
  }

  if (!req.body) {
    return {
      ok: false,
      response: errorJsonResponse("BAD_REQUEST", "Request body is empty.", 400),
    };
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel().catch(() => undefined);
          return {
            ok: false,
            response: errorJsonResponse("PAYLOAD_TOO_LARGE", `Request body exceeds maximum allowed size of ${maxBytes} bytes.`, 413),
          };
        }
        chunks.push(value);
      }
    }
  } catch {
    return {
      ok: false,
      response: errorJsonResponse("BAD_REQUEST", "Failed to read request body stream.", 400),
    };
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(combined);
  } catch {
    return {
      ok: false,
      response: errorJsonResponse("BAD_REQUEST", "Request body is not valid UTF-8.", 400),
    };
  }

  try {
    const parsed = JSON.parse(text) as T;
    return { ok: true, data: parsed };
  } catch {
    return {
      ok: false,
      response: errorJsonResponse("BAD_REQUEST", "Request body is not valid JSON.", 400),
    };
  }
}
