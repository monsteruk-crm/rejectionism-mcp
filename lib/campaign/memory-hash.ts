import "server-only";
import { createHash } from "node:crypto";

/**
 * Server-only content hashing for CampaignMemory (ADR 0007, brief section 4).
 *
 * The hash is computed over a deterministic JSON-serialized tuple
 *   [normalize(category), normalize(title), normalize(content)]
 * which guarantees that:
 *   - whitespace trimming and lowercase folding are honored;
 *   - internal whitespace is collapsed to a single " ";
 *   - internal case differences still produce the same hash;
 *   - leading/trailing whitespace differences do not produce new rows.
 *
 * Crucially, the hash deliberately EXCLUDES: key, provenance, importance,
 * confidence, pin, expiry, tags, relations. Two memories that share category,
 * title, and content (modulo whitespace and case) collide on hash even if they
 * differ on metadata. That is the point — exact-duplicate detection focuses on
 * the durable meaning, not operator-set knobs.
 */

export function normalizeMemoryText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/gu, " ");
}

export function computeMemoryContentHash(
  category: string,
  title: string,
  content: string,
): string {
  const tuple = JSON.stringify([
    normalizeMemoryText(category),
    normalizeMemoryText(title),
    normalizeMemoryText(content),
  ]);
  return createHash("sha256").update(tuple, "utf8").digest("hex");
}

export function normalizeMemoryKey(raw: string): string {
  return raw.trim().toLowerCase();
}
