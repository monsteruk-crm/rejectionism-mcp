import "server-only";

/**
 * Shared origin guard. The trusted origin is the validated CAMPAIGNOS_BASE_URL
 * environment value, never the untrusted Host or forwarded-host header.
 *
 * CAMPAIGNOS_BASE_URL must be an origin only: no credentials, no path other
 * than `/`, no query, no fragment. HTTPS is required in production; the
 * development default is http://localhost:3000. A configured loopback origin is
 * allowed only outside production.
 */

export const DEFAULT_BASE_URL = "http://localhost:3000";

export interface BaseUrlValidationResult {
  valid: boolean;
  origin?: string;
  reason?:
    | "missing"
    | "unparsed"
    | "has_credentials"
    | "has_path"
    | "has_query_or_fragment"
    | "insecure_production"
    | "loopback_in_production";
}

function isLoopbackHost(host: string): boolean {
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost")
  );
}

export function validateConfiguredBaseUrl(
  raw: string | undefined,
  isProduction: boolean = process.env.NODE_ENV === "production",
): BaseUrlValidationResult {
  if (typeof raw !== "string" || raw.length === 0) {
    if (isProduction) {
      return { valid: false, reason: "missing" };
    }
    return { valid: true, origin: DEFAULT_BASE_URL };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { valid: false, reason: "unparsed" };
  }

  if (parsed.username !== "" || parsed.password !== "") {
    return { valid: false, reason: "has_credentials" };
  }

  if (parsed.pathname !== "/" && parsed.pathname !== "") {
    return { valid: false, reason: "has_path" };
  }

  if (parsed.search !== "" || parsed.hash !== "") {
    return { valid: false, reason: "has_query_or_fragment" };
  }

  const isHttps = parsed.protocol === "https:";
  const isHttp = parsed.protocol === "http:";

  if (!isHttps && !isHttp) {
    return { valid: false, reason: "unparsed" };
  }

  if (isProduction && !isHttps) {
    if (isLoopbackHost(parsed.host)) {
      return { valid: false, reason: "loopback_in_production" };
    }
    return { valid: false, reason: "insecure_production" };
  }

  return { valid: true, origin: parsed.origin };
}

/**
 * Returns the trusted application origin, or null when the configuration is
 * missing or invalid (fail closed; callers must not derive links from Host).
 */
export function getTrustedOrigin(): string | null {
  const result = validateConfiguredBaseUrl(process.env.CAMPAIGNOS_BASE_URL);
  return result.valid ? (result.origin ?? null) : null;
}

export type OriginCheckOutcome = "allowed" | "rejected";

/**
 * Policy per boundary kind:
 * - "browser": cookie-authenticated custom endpoints. A missing Origin is as
 *   suspicious as a mismatched one; both are rejected.
 * - "action": Server Actions. Next.js already validates the origin; this guard
 *   additionally compares an explicit Origin header when present. An absent
 *   Origin is left to Next.js's own protection and is not rejected here, so
 *   same-origin HTML form posts keep working.
 * - "mcp": non-browser clients may omit Origin; a supplied Origin must equal
 *   the configured application origin.
 */
export function checkOrigin(
  originHeader: string | null | undefined,
  kind: "browser" | "action" | "mcp",
): OriginCheckOutcome {
  const trusted = getTrustedOrigin();
  if (trusted === null) {
    return "rejected";
  }

  const supplied = typeof originHeader === "string" ? originHeader.trim() : "";

  if (supplied === "") {
    return kind === "browser" ? "rejected" : "allowed";
  }

  let parsed: URL;
  try {
    parsed = new URL(supplied);
  } catch {
    return "rejected";
  }

  return parsed.origin === trusted ? "allowed" : "rejected";
}
