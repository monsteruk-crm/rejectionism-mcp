import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { isRawUploadToken, hashUploadToken } from "@/lib/campaign/upload-tokens";
import { checkOrigin } from "@/lib/auth/origin";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";
import { errorJsonResponse, UPLOAD_SECURITY_HEADERS } from "./capability-auth";

export type UploadAuthMode = "CONTRIBUTOR" | "ADMIN_INTERNAL";

export interface AuthorizedUploadContext {
  ok: true;
  requestId: string;
  authMode: UploadAuthMode;
  token?: string; // Present only for contributor
}

export type UploadAuthOutcome = AuthorizedUploadContext | { ok: false; response: NextResponse };

/**
 * Authenticates requests to the upload control plane (/api/uploads/*).
 * Accepts either:
 * 1. `Authorization: Upload <token>` (External contributor capability)
 * 2. Admin session cookie + `X-CampaignOS-Upload-Request-Id: <id>` (Internal admin upload)
 *
 * Enforces origin checks and rejects ambiguous simultaneous identifiers.
 */
export async function authenticateUploadRequest(req: NextRequest): Promise<UploadAuthOutcome> {
  const originHeader = req.headers.get("origin");
  const originOutcome = checkOrigin(originHeader, "browser");
  if (originOutcome !== "allowed") {
    return {
      ok: false,
      response: errorJsonResponse("ORIGIN_REJECTED", "Cross-origin requests are rejected.", 403),
    };
  }

  const authHeader = req.headers.get("authorization");
  const internalHeader = req.headers.get("x-campaignos-upload-request-id");

  const hasUploadAuth = Boolean(authHeader && authHeader.startsWith("Upload "));
  const hasInternalId = Boolean(internalHeader && internalHeader.trim().length > 0);

  // Reject ambiguous simultaneous identifiers
  if (hasUploadAuth && hasInternalId) {
    return {
      ok: false,
      response: errorJsonResponse(
        "INVALID_AUTH",
        "Cannot combine capability authorization and internal upload request header.",
        400,
      ),
    };
  }

  // 1. Contributor capability path
  if (hasUploadAuth) {
    const token = authHeader!.slice("Upload ".length).trim();
    if (!isRawUploadToken(token)) {
      return {
        ok: false,
        response: errorJsonResponse("INVALID_CAPABILITY", "Invalid upload capability token syntax.", 401),
      };
    }

    try {
      const prisma = getPrisma();
      const tokenHash = await hashUploadToken(token);
      const request = await prisma.uploadRequest.findUnique({
        where: { tokenHash },
        select: { id: true, purpose: true },
      });

      if (!request) {
        return {
          ok: false,
          response: errorJsonResponse("NOT_FOUND", "Upload request not found.", 404),
        };
      }

      if (request.purpose === "ADMIN_INTERNAL") {
        return {
          ok: false,
          response: errorJsonResponse(
            "FORBIDDEN",
            "Capability tokens cannot operate on internal upload sessions.",
            403,
          ),
        };
      }

      return {
        ok: true,
        requestId: request.id,
        authMode: "CONTRIBUTOR",
        token,
      };
    } catch {
      return {
        ok: false,
        response: errorJsonResponse("DATABASE_UNAVAILABLE", "Database unavailable.", 503),
      };
    }
  }

  // 2. Admin internal session path
  if (hasInternalId) {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
    const sessionCookie = match ? match[1] : undefined;

    if (!sessionCookie || !verifySessionToken(sessionCookie).valid) {
      return {
        ok: false,
        response: errorJsonResponse("AUTH_REQUIRED", "Admin session required for internal upload.", 401),
      };
    }

    const requestId = internalHeader!.trim();
    try {
      const prisma = getPrisma();
      const request = await prisma.uploadRequest.findUnique({
        where: { id: requestId },
        select: { id: true, purpose: true },
      });

      if (!request) {
        return {
          ok: false,
          response: errorJsonResponse("NOT_FOUND", "Internal upload session not found.", 404),
        };
      }

      if (request.purpose !== "ADMIN_INTERNAL") {
        return {
          ok: false,
          response: errorJsonResponse(
            "FORBIDDEN",
            "Internal upload headers cannot operate on contributor links.",
            403,
          ),
        };
      }

      return {
        ok: true,
        requestId: request.id,
        authMode: "ADMIN_INTERNAL",
      };
    } catch {
      return {
        ok: false,
        response: errorJsonResponse("DATABASE_UNAVAILABLE", "Database unavailable.", 503),
      };
    }
  }

  return {
    ok: false,
    response: errorJsonResponse(
      "AUTH_REQUIRED",
      "Upload authorization required via capability token or admin session.",
      401,
    ),
  };
}
