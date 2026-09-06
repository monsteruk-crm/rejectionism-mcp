"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getConfiguredPassword, passwordMatches, LOGIN_INPUT_MAX_LENGTH } from "@/lib/auth/config";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { checkOrigin } from "@/lib/auth/origin";

/**
 * Login/logout Server Actions.
 *
 * - Same-origin enforcement runs before any input parsing.
 * - Password input length is limited before hashing; the value is never
 *   trimmed, echoed, or reflected into the UI.
 * - All failure modes surface the same generic feedback via /login?error=invalid.
 * - Successful login always redirects to /admin; no user-supplied returnTo.
 */

export async function loginAction(formData: FormData): Promise<void> {
  const headerStore = await headers();
  const originHeader = headerStore.get("origin");
  if (checkOrigin(originHeader, "action") === "rejected") {
    throw new Error("Cross-origin request rejected.");
  }

  const configured = getConfiguredPassword();
  const raw = formData.get("password");

  // Fail closed when authentication is not configured; identical generic
  // feedback avoids revealing configuration state.
  if (configured === null || typeof raw !== "string" || raw.length === 0) {
    redirect("/login?error=invalid");
  }

  if (raw.length > LOGIN_INPUT_MAX_LENGTH) {
    redirect("/login?error=invalid");
  }

  if (!passwordMatches(raw)) {
    redirect("/login?error=invalid");
  }

  const token = createSessionToken();
  if (token === null) {
    redirect("/login?error=invalid");
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(SESSION_TTL_SECONDS));

  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const headerStore = await headers();
  const originHeader = headerStore.get("origin");
  if (checkOrigin(originHeader, "action") === "rejected") {
    throw new Error("Cross-origin request rejected.");
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", sessionCookieOptions(0));

  redirect("/login");
}
