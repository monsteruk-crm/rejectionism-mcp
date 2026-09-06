import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./session";
import { bearerTokenMatches } from "./config";
import { checkOrigin } from "./origin";

/**
 * Authentication boundaries shared by every operational entry point.
 *
 * - Admin pages call `requireAdminPage()` before their first domain read.
 * - Every exported Admin Server Action calls `requireAdminAction()` before
 *   parsing input.
 * - MCP transport routes call `authenticateMcpRequest()` before the MCP handler.
 *
 * Layout protection alone is insufficient: RSC layouts and pages render in
 * parallel, so each boundary is guarded independently.
 */

export type McpAuthOutcome =
  | { ok: true }
  | { ok: false; response: NextResponse };

export function mcpUnauthorizedResponse(): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "AUTH_REQUIRED",
        message: "Authentication required. Supply a valid Bearer credential.",
      },
    },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Bearer realm="CampaignOS"',
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function hasAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const result = verifySessionToken(cookieValue);
  return result.valid;
}

/** Guard for admin RSC pages. Redirects to /login when no valid session exists. */
export async function requireAdminPage(): Promise<void> {
  if (!(await hasAdminSession())) {
    redirect("/login");
  }
}

/**
 * Guard for exported Server Actions. Throws a redirect to /login before any
 * input parsing or domain side effect can occur.
 */
export async function requireAdminAction(): Promise<void> {
  // Same-origin enforcement for the mutating browser boundary. Next.js retains
  // its own origin validation for Server Actions; this adds the shared guard.
  const headerStore = await headers();
  const originHeader = headerStore.get("origin");
  if (checkOrigin(originHeader, "action") === "rejected") {
    throw new Error("Cross-origin request rejected.");
  }

  if (!(await hasAdminSession())) {
    redirect("/login");
  }
}

/**
 * Transport-level MCP authentication. A session cookie does not authorize MCP
 * and an upload token does not authorize MCP; only the configured Bearer
 * credential passes. A supplied Origin must match the configured origin, while
 * non-browser clients may omit Origin entirely.
 */
export async function authenticateMcpRequest(
  request: { headers: { get(name: string): string | null } },
): Promise<McpAuthOutcome> {
  const originHeader = request.headers.get("origin");
  if (checkOrigin(originHeader, "mcp") === "rejected") {
    return { ok: false, response: mcpUnauthorizedResponse() };
  }

  const authorization = request.headers.get("authorization");
  if (authorization === null || !/^Bearer\s+/i.test(authorization)) {
    return { ok: false, response: mcpUnauthorizedResponse() };
  }

  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!bearerTokenMatches(token)) {
    return { ok: false, response: mcpUnauthorizedResponse() };
  }

  return { ok: true };
}
