import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getConfiguredPassword } from "./config";

/**
 * Stateless admin session tokens carried in the `campaignos_session` cookie.
 *
 * Cookie value: `v1.<base64url(JSON payload)>.<base64url(HMAC-SHA256 signature)>`
 * Payload is exactly `{ v: 1, iat, exp, nonce }` with epoch-second integers and
 * a base64url-encoded random 16-byte nonce.
 *
 * The signing key is derived with
 * `HMAC-SHA256(key=CAMPAIGNOS_PASSWORD, message="campaignos:admin-session:v1")`
 * and signs the `v1.<payload>` string. Password rotation therefore invalidates
 * every existing session cookie.
 */

export const SESSION_COOKIE_NAME = "campaignos_session";
export const SESSION_TTL_SECONDS = 604800; // 7 days
export const SESSION_MAX_CLOCK_SKEW_SECONDS = 60;
const SIGNING_CONTEXT = "campaignos:admin-session:v1";
const COOKIE_MAX_LENGTH = 2048;

const NONCE_BYTES = 16;

export interface SessionPayload {
  v: 1;
  iat: number;
  exp: number;
  nonce: string;
}

function getSigningKey(): Buffer | null {
  const password = getConfiguredPassword();
  if (password === null) {
    return null;
  }

  return createHmac("sha256", password).update(SIGNING_CONTEXT).digest();
}

function encodeBase64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function canonicalizePayload(payload: SessionPayload): string {
  // Fixed property order so the signed bytes are deterministic.
  return JSON.stringify({
    v: payload.v,
    iat: payload.iat,
    exp: payload.exp,
    nonce: payload.nonce,
  });
}

export function createSessionToken(now: number = Math.floor(Date.now() / 1000)): string | null {
  const signingKey = getSigningKey();
  if (signingKey === null) {
    return null;
  }

  const payload: SessionPayload = {
    v: 1,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    nonce: encodeBase64url(randomBytes(NONCE_BYTES)),
  };

  if (payload.exp !== payload.iat + SESSION_TTL_SECONDS) {
    return null;
  }

  const payloadB64 = encodeBase64url(canonicalizePayload(payload));
  const signature = createHmac("sha256", signingKey).update(`v1.${payloadB64}`).digest();

  return `v1.${payloadB64}.${encodeBase64url(signature)}`;
}

export interface SessionValidationResult {
  valid: boolean;
  reason?:
    | "unconfigured"
    | "malformed"
    | "oversized"
    | "bad_payload"
    | "expired"
    | "future_iat"
    | "bad_signature";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidPayloadShape(value: unknown): value is SessionPayload {
  if (!isPlainObject(value)) {
    return false;
  }

  const keys = Object.keys(value).sort();
  if (keys.length !== 4 || keys.join(",") !== "exp,iat,nonce,v") {
    return false;
  }

  if (value.v !== 1) {
    return false;
  }

  if (!Number.isInteger(value.iat) || !Number.isInteger(value.exp)) {
    return false;
  }

  if (
    typeof value.nonce !== "string" ||
    value.nonce.length === 0 ||
    !/^[A-Za-z0-9_-]+$/.test(value.nonce)
  ) {
    return false;
  }

  return true;
}

export function verifySessionToken(
  cookieValue: string | undefined | null,
  now: number = Math.floor(Date.now() / 1000),
): SessionValidationResult {
  if (typeof cookieValue !== "string" || cookieValue.length === 0) {
    return { valid: false, reason: "malformed" };
  }

  if (cookieValue.length > COOKIE_MAX_LENGTH) {
    return { valid: false, reason: "oversized" };
  }

  const signingKey = getSigningKey();
  if (signingKey === null) {
    return { valid: false, reason: "unconfigured" };
  }

  const parts = cookieValue.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    return { valid: false, reason: "malformed" };
  }

  const [, payloadB64, signatureB64] = parts;

  const payloadBytes = safeBase64UrlDecode(payloadB64);
  const signatureBytes = safeBase64UrlDecode(signatureB64);
  if (payloadBytes === null || signatureBytes === null) {
    return { valid: false, reason: "malformed" };
  }

  // Signature must be a 32-byte SHA-256 HMAC output.
  if (signatureBytes.length !== 32) {
    return { valid: false, reason: "malformed" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadBytes.toString("utf8"));
  } catch {
    return { valid: false, reason: "bad_payload" };
  }

  if (!isValidPayloadShape(parsed)) {
    return { valid: false, reason: "bad_payload" };
  }

  const payload = parsed;

  if (payload.exp !== payload.iat + SESSION_TTL_SECONDS) {
    return { valid: false, reason: "bad_payload" };
  }

  if (payload.iat > now + SESSION_MAX_CLOCK_SKEW_SECONDS) {
    return { valid: false, reason: "future_iat" };
  }

  if (now >= payload.exp) {
    return { valid: false, reason: "expired" };
  }

  const expectedSignature = createHmac("sha256", signingKey)
    .update(`v1.${payloadB64}`)
    .digest();

  if (!timingSafeEqual(signatureBytes, expectedSignature)) {
    return { valid: false, reason: "bad_signature" };
  }

  return { valid: true };
}

function safeBase64UrlDecode(value: string): Buffer | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(value)) {
    return null;
  }

  try {
    const decoded = Buffer.from(value, "base64url");
    // Buffer.from does not throw on invalid input; re-encode to confirm lossless decoding.
    if (encodeBase64url(decoded) !== value) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAgeSeconds: number = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
