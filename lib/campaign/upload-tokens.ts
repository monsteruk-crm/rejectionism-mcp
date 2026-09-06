/**
 * Upload capability tokens and finalization payload hashing (upgrade plan
 * section 6, "Creation and token lifecycle" and "Finalization input and
 * hashing"; section 8, "Capability isolation and secret handling").
 *
 * - A raw token is exactly 32 cryptographically random bytes, base64url
 *   encoded without padding: 43 characters matching `^[A-Za-z0-9_-]{43}$`.
 * - Only the lowercase SHA-256 hex hash is ever persisted; raw tokens live
 *   only in the create/regenerate return value and the recipient's browser.
 * - Finalization payloads are hashed with a fixed property order so the hash
 *   depends on content, not on browser object property insertion order.
 *
 * This module is intentionally pure (no "server-only") so unit tests and
 * browser-safe modules can reuse it.
 */

export const UPLOAD_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isRawUploadToken(value: unknown): value is string {
  return typeof value === "string" && UPLOAD_TOKEN_PATTERN.test(value);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Generates a 43-character raw upload capability token. */
export function generateUploadToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * SHA-256 lowercase hex hash of the raw token — the only form ever stored
 * in `UploadRequest.tokenHash`.
 */
export function hashUploadToken(rawToken: string): Promise<string> {
  return sha256Hex(rawToken);
}

export interface FinalizeItemLike {
  clientItemId: string;
  type: "FILE" | "EXTERNAL_URL";
  fileId?: string;
  externalUrl?: string;
  name: string;
  kind: string;
  notes?: string | null;
  label?: string | null;
  variant?: string | null;
  format?: string | null;
}

/**
 * Builds the canonical finalization object with a fixed property order.
 * Item order is preserved; derived provider metadata (blob URLs, MIME,
 * byte sizes, dimensions, checksums) is never part of the hash.
 */
export function canonicalFinalizationPayload(
  submissionKey: string,
  items: FinalizeItemLike[],
): { submissionKey: string; items: Array<Record<string, unknown>> } {
  return {
    submissionKey,
    items: items.map((item) => {
      const base: Record<string, unknown> = {
        clientItemId: item.clientItemId,
        name: item.name,
        kind: item.kind,
        notes: item.notes === "" || item.notes === undefined ? null : (item.notes ?? null),
        label: item.label === "" || item.label === undefined ? null : (item.label ?? null),
        variant: item.variant === "" || item.variant === undefined ? null : (item.variant ?? null),
        format: item.format === "" || item.format === undefined ? null : (item.format ?? null),
      };
      if (item.type === "FILE") {
        return { ...base, type: "FILE", fileId: item.fileId };
      }
      return { ...base, type: "EXTERNAL_URL", externalUrl: item.externalUrl };
    }),
  };
}

/**
 * SHA-256 lowercase hex hash over UTF-8 JSON containing the submissionKey and
 * the ordered items with fixed property order. Excludes the capability token
 * and all derived provider metadata.
 */
export function hashFinalizationPayload(
  submissionKey: string,
  items: FinalizeItemLike[],
): Promise<string> {
  return sha256Hex(JSON.stringify(canonicalFinalizationPayload(submissionKey, items)));
}
