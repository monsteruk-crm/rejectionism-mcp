import { z } from "zod";

/**
 * Browser-safe schemas for generic tags (upgrade plan section 4). The generic
 * entity selector intentionally covers only the original seven domain entity
 * types; UPLOAD_REQUEST, TAG, and ENTITY_RELATION are never taggable targets.
 */

export const ORIGINAL_ENTITY_TYPES = [
  "WORK_ITEM",
  "CANON_ENTRY",
  "DECISION",
  "ASSET",
  "WEBSITE",
  "CONTENT_ITEM",
  "CONTACT",
] as const;

export type OriginalEntityType = (typeof ORIGINAL_ENTITY_TYPES)[number];

export const OriginalEntityTypeSchema = z.enum(ORIGINAL_ENTITY_TYPES);

export const EntityIdSchema = z
  .string()
  .trim()
  .min(1, "Must not be empty.")
  .max(100, "Must not exceed 100 characters.");

export const EntityRefSchema = z
  .object({
    entityType: OriginalEntityTypeSchema,
    entityId: EntityIdSchema,
  })
  .strict();

export interface EntityRef {
  entityType: OriginalEntityType;
  entityId: string;
}

export const TagSlugSchema = z
  .string()
  .trim()
  .min(1, "Must not be empty.")
  .max(80, "Must not exceed 80 characters.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Must be a lowercase ASCII slug of a-z, 0-9, and single hyphens.");

export const TagDisplayNameSchema = z
  .string()
  .trim()
  .min(1, "Must not be empty.")
  .max(80, "Must not exceed 80 characters.");

/**
 * Fixed tag normalization (upgrade plan section 4): Unicode NFKD, remove
 * combining marks, trim, lowercase, replace each run outside ASCII a-z/0-9
 * with one hyphen, trim hyphens. Callers reject an empty or overlong result.
 */
export function normalizeTagSlug(raw: string): string {
  const decomposed = raw.normalize("NFKD");
  let withoutMarks = "";
  for (const character of decomposed) {
    if (/\p{M}/u.test(character)) {
      continue;
    }
    withoutMarks += character;
  }
  return withoutMarks
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export const ListTagsQuerySchema = z
  .object({
    search: z.string().trim().max(80).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict();

export const TagEntityInputSchema = z
  .object({
    entityType: OriginalEntityTypeSchema,
    entityId: EntityIdSchema,
    tag: TagDisplayNameSchema,
  })
  .strict();

export const UntagEntityInputSchema = z
  .object({
    entityType: OriginalEntityTypeSchema,
    entityId: EntityIdSchema,
    tagSlug: TagSlugSchema,
  })
  .strict();

export interface TagDto {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}
