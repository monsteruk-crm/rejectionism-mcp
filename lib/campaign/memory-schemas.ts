import { z } from "zod";
import {
  MemoryCategorySchema,
  MemorySortSchema,
  MemorySourceTypeFilterSchema,
  MemoryStatusSchema,
} from "./schemas";
import type {
  MemoryCategory,
  MemorySort,
  MemorySourceTypeFilter,
  MemoryStatus,
} from "./schemas";
export type { MemoryCategory, MemorySort, MemorySourceTypeFilter, MemoryStatus };
import {
  CampaignEntityTypeSchema,
  EntityIdSchema,
  EntityRefSchema,
  TagDisplayNameSchema,
  TagSlugSchema,
  type EntityRef,
} from "./tag-schemas";
import {
  EntityRelationTypeSchema,
  type EntityRelationType,
} from "./relation-schemas";

/**
 * Browser-safe CampaignMemory input and DTO schemas (ADR 0007, brief sections
 * 4, 6, 8). No server-only imports; no Prisma or node:crypto. Hash computation
 * lives in server-only `memory-hash.ts` so the schema layer stays portable.
 */

// ------------------------------------------------------------
// Shared primitive schemas used across memory tool inputs
// ------------------------------------------------------------

export const MemoryTitleSchema = z
  .string()
  .trim()
  .min(1, "title must not be empty.")
  .max(200, "title must not exceed 200 characters.");

export const MemoryContentSchema = z
  .string()
  .trim()
  .min(1, "content must not be empty.")
  .max(20000, "content must not exceed 20000 characters.");

export const MemoryKeySchema = z
  .string()
  .trim()
  .min(1, "key must not be empty.")
  .max(200, "key must not exceed 200 characters.")
  .regex(
    /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/,
    "key must be lowercase alphanumerics separated by ., _, or -.",
  );

export const MemoryImportanceSchema = z.coerce
  .number()
  .int()
  .min(0, "importance must be between 0 and 100.")
  .max(100, "importance must be between 0 and 100.");

export const MemoryConfidenceSchema = z.coerce
  .number()
  .int()
  .min(0, "confidence must be between 0 and 100.")
  .max(100, "confidence must be between 0 and 100.");

export const MemorySourceLabelSchema = z
  .string()
  .trim()
  .min(1)
  .max(200);

export const MemorySourceUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((v) => {
    try {
      const parsed = new URL(v);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
      if (parsed.username || parsed.password) return false;
      return true;
    } catch {
      return false;
    }
  }, "sourceUrl must be a valid http(s) URL without username or password.");

export const MemoryExpirySchema = z
  .string()
  .trim()
  .refine((val) => {
    if (val.length === 0) return false;
    const parsed = new Date(val);
    if (Number.isNaN(parsed.getTime())) return false;
    // Require explicit time-component normalization: bare YYYY-MM-DD is not
    // permitted; either an offset or Z must be present to avoid date-only
    // ambiguity. Most ISO-8601 datetime strings include 'T'.
    if (!/T/.test(val)) return false;
    // Reject rolling forward of a date that resolves to "Invalid Date".
    return !Number.isNaN(parsed.getTime());
  }, "expiresAt must be a full ISO-8601 datetime with timezone (e.g. 2026-10-01T12:00:00Z).")
  .transform((val) => new Date(val).toISOString());

export const MemoryExpectedVersionSchema = z.coerce
  .number()
  .int()
  .min(1, "expectedVersion must be a positive integer.");

export const MemoryTagNamesSchema = z
  .array(TagDisplayNameSchema)
  .max(10, "at most 10 tags are allowed per request.")
  .transform((tags) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const tag of tags) {
      const slug = normalizeMemoryTagSlugClient(tag);
      if (!slug) continue;
      if (seen.has(slug)) continue;
      seen.add(slug);
      out.push(tag);
    }
    return out;
  });

const MemoryEntityRefSchema = z
  .object({
    entity: EntityRefSchema,
    direction: z.enum(["outgoing", "incoming"]).default("outgoing"),
    relationType: EntityRelationTypeSchema,
    notes: z
      .string()
      .trim()
      .max(20000)
      .optional()
      .nullable()
      .transform((v) => (v === "" || v === undefined ? null : v)),
  })
  .strict();

export const MemoryRelationshipsSchema = z
  .array(MemoryEntityRefSchema)
  .max(20, "at most 20 relationships per request.")
  .transform((items) => {
    const seen = new Set<string>();
    const out: MemoryRelationshipDto[] = [];
    for (const item of items) {
      const key = `${item.entity.entityType}:${item.entity.entityId}:${item.direction}:${item.relationType}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        entity: { entityType: item.entity.entityType, entityId: item.entity.entityId },
        direction: item.direction,
        relationType: item.relationType,
        notes: item.notes ?? null,
      });
    }
    return out;
  });

export const MemoryEntityContextSchema = z
  .array(EntityRefSchema)
  .max(10, "at most 10 entity context references.")
  .transform((refs) => {
    const seen = new Set<string>();
    const out: EntityRef[] = [];
    for (const ref of refs) {
      const key = `${ref.entityType}:${ref.entityId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(ref);
    }
    return out;
  });

// ------------------------------------------------------------
// Tool input schemas
// ------------------------------------------------------------

export const RememberMemoryInputSchema = z
  .object({
    title: MemoryTitleSchema,
    content: MemoryContentSchema,
    category: MemoryCategorySchema,
    key: MemoryKeySchema.optional(),
    importance: MemoryImportanceSchema.default(50),
    confidence: MemoryConfidenceSchema.default(100),
    pinned: z.boolean().default(false),
    sourceLabel: MemorySourceLabelSchema.optional().nullable(),
    sourceUrl: MemorySourceUrlSchema.optional().nullable(),
    expiresAt: MemoryExpirySchema.optional().nullable(),
    tags: MemoryTagNamesSchema.optional(),
    relationships: MemoryRelationshipsSchema.optional(),
  })
  .strict()
  .transform((data) => ({
    ...data,
    sourceLabel: data.sourceLabel ?? null,
    sourceUrl: data.sourceUrl ?? null,
    expiresAt: data.expiresAt ?? null,
    tags: data.tags ?? [],
    relationships: data.relationships ?? [],
  }));
export type RememberMemoryInput = z.infer<typeof RememberMemoryInputSchema>;

export const UpdateMemoryChangesSchema = z
  .object({
    key: MemoryKeySchema.optional().nullable(),
    title: MemoryTitleSchema.optional(),
    content: MemoryContentSchema.optional(),
    category: MemoryCategorySchema.optional(),
    importance: MemoryImportanceSchema.optional(),
    confidence: MemoryConfidenceSchema.optional(),
    pinned: z.boolean().optional(),
    sourceLabel: MemorySourceLabelSchema.optional().nullable(),
    sourceUrl: MemorySourceUrlSchema.optional().nullable(),
    expiresAt: MemoryExpirySchema.optional().nullable(),
  })
  .strict()
  .refine((c) => Object.keys(c).length > 0, {
    message: "At least one field must be provided in changes.",
  });

export const UpdateMemoryInputSchema = z
  .object({
    id: EntityIdSchema,
    expectedVersion: MemoryExpectedVersionSchema,
    changes: UpdateMemoryChangesSchema,
  })
  .strict();
export type UpdateMemoryInput = z.infer<typeof UpdateMemoryInputSchema>;

export const SupersedeMemoryInputSchema = z
  .object({
    supersedesId: EntityIdSchema,
    expectedVersion: MemoryExpectedVersionSchema,
    copyConnections: z.boolean().default(true),
    newMemory: z
      .object({
        title: MemoryTitleSchema,
        content: MemoryContentSchema,
        category: MemoryCategorySchema,
        key: MemoryKeySchema.optional().nullable(),
        importance: MemoryImportanceSchema.default(50),
        confidence: MemoryConfidenceSchema.default(100),
        pinned: z.boolean().default(false),
        sourceLabel: MemorySourceLabelSchema.optional().nullable(),
        sourceUrl: MemorySourceUrlSchema.optional().nullable(),
        expiresAt: MemoryExpirySchema.optional().nullable(),
        tags: MemoryTagNamesSchema.optional(),
        relationships: MemoryRelationshipsSchema.optional(),
      })
      .strict()
      .transform((d) => ({
        ...d,
        key: d.key ?? null,
        sourceLabel: d.sourceLabel ?? null,
        sourceUrl: d.sourceUrl ?? null,
        expiresAt: d.expiresAt ?? null,
        tags: d.tags ?? [],
        relationships: d.relationships ?? [],
      })),
  })
  .strict();
export type SupersedeMemoryInput = z.infer<typeof SupersedeMemoryInputSchema>;

export const ArchiveMemoryInputSchema = z
  .object({
    id: EntityIdSchema,
    expectedVersion: MemoryExpectedVersionSchema,
  })
  .strict();
export type ArchiveMemoryInput = z.infer<typeof ArchiveMemoryInputSchema>;

export const GetMemoryInputSchema = z
  .object({
    id: EntityIdSchema.optional(),
    key: MemoryKeySchema.optional(),
    trackAccess: z.boolean().default(true),
    tagOffset: z.coerce.number().int().min(0).max(10000).default(0),
    relationshipOffset: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict()
  .refine((q) => Boolean(q.id) !== Boolean(q.key), {
    message: "Provide exactly one of id or key.",
  });
export type GetMemoryInput = z.infer<typeof GetMemoryInputSchema>;

export const ListMemoriesQuerySchema = z
  .object({
    search: z.string().trim().max(500).optional(),
    category: MemoryCategorySchema.optional(),
    status: MemorySourceTypeFilterSchema.default("ACTIVE"),
    pinned: z.boolean().optional(),
    tag: TagSlugSchema.optional(),
    minImportance: MemoryImportanceSchema.optional(),
    includeExpired: z.boolean().default(false),
    expiredOnly: z.boolean().default(false),
    sort: MemorySortSchema.default("UPDATED_DESC"),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict()
  .superRefine((q, ctx) => {
    if (q.expiredOnly && !q.includeExpired) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "expiredOnly requires includeExpired to be true.",
        path: ["expiredOnly"],
      });
    }
    if (q.sort === "RELEVANCE" && (!q.search || q.search.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "RELEVANCE sort requires a non-empty search.",
        path: ["sort"],
      });
    }
  });
export type ListMemoriesQuery = z.infer<typeof ListMemoriesQuerySchema>;

export interface RecallInput {
  query: string;
}

export const RecallMemoriesInputSchema = z
  .object({
    query: z.string().trim().max(500),
    categories: z
      .array(MemoryCategorySchema)
      .max(11)
      .optional()
      .transform((arr) => (arr ? Array.from(new Set(arr)) : undefined)),
    tags: z
      .array(TagSlugSchema)
      .max(10)
      .optional()
      .transform((arr) => (arr ? Array.from(new Set(arr)) : undefined)),
    entityContext: MemoryEntityContextSchema.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    includePinned: z.boolean().default(true),
    includeExpired: z.boolean().default(false),
    trackAccess: z.boolean().default(true),
  })
  .strict();
export type RecallMemoriesInput = z.infer<typeof RecallMemoriesInputSchema>;

export const GetContextInputSchema = z
  .object({
    task: z
      .string()
      .trim()
      .min(1, "task must not be empty.")
      .max(500, "task must not exceed 500 characters."),
    entityContext: MemoryEntityContextSchema.optional(),
    maxMemories: z.coerce.number().int().min(1).max(20).default(12),
  })
  .strict();
export type GetContextInput = z.infer<typeof GetContextInputSchema>;

// ------------------------------------------------------------
// DTO types (shared with MCP/Admin)
// ------------------------------------------------------------

export interface MemoryDto {
  id: string;
  key: string | null;
  title: string;
  content: string;
  contentHash: string;
  category: MemoryCategory;
  status: MemoryStatus;
  importance: number;
  confidence: number;
  pinned: boolean;
  sourceType: "HUMAN" | "MCP" | "ADMIN" | "IMPORT" | "SYSTEM";
  sourceLabel: string | null;
  sourceUrl: string | null;
  version: number;
  accessCount: number;
  lastAccessedAt: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  supersededById: string | null;
  supersedesId: string | null;
  createdAt: string;
  updatedAt: string;
  href: string;
}

export interface MemorySummaryDto extends Omit<MemoryDto, "content"> {
  contentExcerpt: string;
  sortedTagSlugs: string[];
  tagsTotal: number;
}

export interface MemoryDetailDto {
  memory: MemoryDto;
  tags: { id: string; name: string; slug: string; createdAt: string }[];
  tagsTotal: number;
  tagLimit: number;
  tagOffset: number;
  relationships: {
    id: string;
    from: EntityRef;
    to: EntityRef;
    direction: "incoming" | "outgoing";
    relationType: EntityRelationType;
    notes: string | null;
    createdAt: string;
    fromTitle: string;
    toTitle: string;
    fromHref: string;
    toHref: string;
  }[];
  relationshipsTotal: number;
  relationshipLimit: number;
  relationshipOffset: number;
  supersedes: MemorySummaryDto | null;
  supersededBy: MemorySummaryDto | null;
}

export interface MemoryListOutputDto {
  items: MemorySummaryDto[];
  total: number;
  limit: number;
  offset: number;
}

export type MemoryRememberOutcome =
  | "CREATED"
  | "DUPLICATE"
  | "ALREADY_CURRENT"
  | "KEY_CONFLICT";

export interface MemoryNextAction {
  tool: "campaign_get_memory" | "campaign_update_memory" | "campaign_supersede_memory" | "cancel";
}

export interface MemoryRememberOutputDto {
  outcome: MemoryRememberOutcome;
  memory: MemoryDto;
  nextActions: MemoryNextAction[];
}

export interface MemoryUpdateOutputDto {
  memory: MemoryDto;
  changed: boolean;
}

export interface MemorySupersedeOutputDto {
  memory: MemoryDto;
  supersededMemory: MemoryDto;
}

export interface RecalledMemoryDto {
  id: string;
  key: string | null;
  title: string;
  content: string;
  contentTruncated: boolean;
  category: MemoryCategory;
  status: MemoryStatus;
  isExpired: boolean;
  importance: number;
  confidence: number;
  pinned: boolean;
  version: number;
  expiresAt: string | null;
  sourceType: "HUMAN" | "MCP" | "ADMIN" | "IMPORT" | "SYSTEM";
  sourceLabel: string | null;
  sourceUrl: string | null;
  updatedAt: string;
  sortedTagSlugs: string[];
  tagsTotal: number;
  href: string;
  relevanceScore: number;
  relevanceReasons: string[];
}

export interface RecallOutputDto {
  items: RecalledMemoryDto[];
  limit: number;
  queryTokens: string[];
  queryTokensTruncated: boolean;
}

export interface MemoryRelationshipDto {
  entity: EntityRef;
  direction: "outgoing" | "incoming";
  relationType: EntityRelationType;
  notes: string | null;
}

// Re-export helpers used by client UI code.

function normalizeMemoryTagSlugClient(raw: string): string {
  // Mirrors normalizeTagSlug behaviour; intentionally reimplemented locally
  // because tag-schemas is browser-safe but uses a mark-removal path that the
  // memory UI does not need.
  return raw
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}
