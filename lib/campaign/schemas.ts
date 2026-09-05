import "server-only";
import { z } from "zod";

// Base validators
export const NonEmptyString = (max: number) =>
  z.string().trim().min(1, "Must not be empty.").max(max, `Must not exceed ${max} characters.`);

export const OptionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must not exceed ${max} characters.`)
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined ? null : v));

export const AbsoluteUrlString = z
  .string()
  .trim()
  .max(2048, "URL must not exceed 2048 characters.")
  .refine(
    (val) => {
      if (!val) return false;
      try {
        const parsed = new URL(val);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Must be a valid absolute http:// or https:// URL." },
  );

export const OptionalAbsoluteUrlString = z
  .string()
  .trim()
  .max(2048, "URL must not exceed 2048 characters.")
  .optional()
  .nullable()
  .transform((v) => (v === "" || v === undefined ? null : v))
  .refine(
    (val) => {
      if (val === null || val === undefined) return true;
      try {
        const parsed = new URL(val);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Must be a valid absolute http:// or https:// URL." },
  );

export const DomainString = z
  .string()
  .trim()
  .toLowerCase()
  .max(200, "Domain must not exceed 200 characters.")
  .refine(
    (val) => {
      if (!val) return false;
      // Must not contain scheme, slashes, ports, or query
      if (
        val.includes("://") ||
        val.includes("/") ||
        val.includes(":") ||
        val.includes("?") ||
        val.includes("#") ||
        val.includes("@")
      ) {
        return false;
      }
      // Basic hostname validation (labels separated by dots)
      const domainRegex =
        /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
      return domainRegex.test(val);
    },
    { message: "Must be a valid lowercase domain name without scheme, port, or path." },
  );

export const IsoDateString = z
  .string()
  .trim()
  .refine(
    (val) => {
      if (!val) return false;
      const d = new Date(val);
      return !isNaN(d.getTime());
    },
    { message: "Must be a valid ISO-8601 date string." },
  )
  .transform((val) => new Date(val));

export const OptionalIsoDateString = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v === "" || v === undefined ? null : v))
  .refine(
    (val) => {
      if (val === null || val === undefined) return true;
      const d = new Date(val);
      return !isNaN(d.getTime());
    },
    { message: "Must be a valid ISO-8601 date string." },
  )
  .transform((val) => (val ? new Date(val) : null));

// Enums
export const WorkItemStatusSchema = z.enum(["BACKLOG", "NEXT", "IN_PROGRESS", "BLOCKED", "DONE"]);
export type WorkItemStatus = z.infer<typeof WorkItemStatusSchema>;

export const AssetStatusSchema = z.enum([
  "MISSING",
  "DRAFT",
  "NEEDS_WORK",
  "APPROVED",
  "SUPERSEDED",
]);
export type AssetStatus = z.infer<typeof AssetStatusSchema>;

export const WebsiteStatusSchema = z.enum([
  "PLANNED",
  "RESERVED",
  "IN_PROGRESS",
  "LIVE",
  "REDIRECT",
  "UNKNOWN",
]);
export type WebsiteStatus = z.infer<typeof WebsiteStatusSchema>;

export const ContentStatusSchema = z.enum(["DRAFT", "SCHEDULED", "PUBLISHED"]);
export type ContentStatus = z.infer<typeof ContentStatusSchema>;

export const EntityTypeSchema = z.enum([
  "WORK_ITEM",
  "CANON_ENTRY",
  "DECISION",
  "ASSET",
  "WEBSITE",
  "CONTACT",
  "CONTENT_ITEM",
]);
export type EntityType = z.infer<typeof EntityTypeSchema>;

export const MutationSourceSchema = z.enum(["admin", "mcp", "seed", "system"]);
export type MutationSource = z.infer<typeof MutationSourceSchema>;

// Pagination
export const PaginationQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict();
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

// -------------------------------------------------------------
// Work Item Schemas
// -------------------------------------------------------------
export const CreateWorkItemInputSchema = z
  .object({
    id: OptionalString(100),
    title: NonEmptyString(200),
    description: z.string().trim().max(20000).default(""),
    status: WorkItemStatusSchema.default("BACKLOG"),
    priority: z.coerce.number().int().min(0).max(100).default(0),
    dueDate: OptionalIsoDateString,
    blockedReason: OptionalString(20000),
    evidenceUrl: OptionalAbsoluteUrlString,
    completionNote: OptionalString(20000),
  })
  .strict();
export type CreateWorkItemInput = z.infer<typeof CreateWorkItemInputSchema>;

export const UpdateWorkItemChangesSchema = z
  .object({
    title: NonEmptyString(200).optional(),
    description: z.string().trim().max(20000).optional(),
    status: WorkItemStatusSchema.optional(),
    priority: z.coerce.number().int().min(0).max(100).optional(),
    dueDate: OptionalIsoDateString.optional(),
    blockedReason: OptionalString(20000).optional(),
    evidenceUrl: OptionalAbsoluteUrlString.optional(),
    completionNote: OptionalString(20000).optional(),
  })
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, {
    message: "At least one field must be provided in changes.",
  });

export const UpdateWorkItemInputSchema = z
  .object({
    id: NonEmptyString(100),
    expectedVersion: z.coerce.number().int().min(1),
    changes: UpdateWorkItemChangesSchema,
    completionNote: OptionalString(20000).optional(),
  })
  .strict();
export type UpdateWorkItemInput = z.infer<typeof UpdateWorkItemInputSchema>;

export const ListWorkItemsQuerySchema = z
  .object({
    status: WorkItemStatusSchema.optional(),
    minPriority: z.coerce.number().int().min(0).max(100).optional(),
    dueBefore: OptionalIsoDateString.optional(),
    search: z.string().trim().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict();
export type ListWorkItemsQuery = z.infer<typeof ListWorkItemsQuerySchema>;

// -------------------------------------------------------------
// Canon Schemas
// -------------------------------------------------------------
export const CreateCanonEntryInputSchema = z
  .object({
    id: OptionalString(100),
    key: NonEmptyString(200),
    value: NonEmptyString(20000),
    category: NonEmptyString(200),
    notes: OptionalString(20000),
  })
  .strict();
export type CreateCanonEntryInput = z.infer<typeof CreateCanonEntryInputSchema>;

export const UpdateCanonEntryChangesSchema = z
  .object({
    value: NonEmptyString(20000).optional(),
    category: NonEmptyString(200).optional(),
    notes: OptionalString(20000).optional(),
  })
  .strict()
  .refine((c) => Object.keys(c).length > 0, {
    message: "At least one field must be provided in changes.",
  });

export const UpdateCanonEntryInputSchema = z
  .object({
    id: NonEmptyString(100),
    expectedVersion: z.coerce.number().int().min(1),
    changes: UpdateCanonEntryChangesSchema,
  })
  .strict();
export type UpdateCanonEntryInput = z.infer<typeof UpdateCanonEntryInputSchema>;

export const GetCanonQuerySchema = z
  .object({
    key: z.string().trim().max(200).optional(),
    category: z.string().trim().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict()
  .refine((q) => !(q.key && q.category), { message: "Cannot specify both key and category." });
export type GetCanonQuery = z.infer<typeof GetCanonQuerySchema>;

// -------------------------------------------------------------
// Decision Schemas
// -------------------------------------------------------------
export const UpdateCanonModeSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("create"),
      key: NonEmptyString(200),
      value: NonEmptyString(20000),
      category: NonEmptyString(200),
      notes: OptionalString(20000),
    })
    .strict(),
  z
    .object({
      mode: z.literal("update"),
      key: NonEmptyString(200),
      value: NonEmptyString(20000),
      expectedVersion: z.coerce.number().int().min(1),
      category: OptionalString(200).optional(),
      notes: OptionalString(20000).optional(),
    })
    .strict(),
]);
export type UpdateCanonMode = z.infer<typeof UpdateCanonModeSchema>;

export const RecordDecisionInputSchema = z
  .object({
    id: OptionalString(100),
    subject: NonEmptyString(200),
    decision: NonEmptyString(20000),
    rationale: NonEmptyString(20000),
    supersedesId: OptionalString(100),
    decidedAt: OptionalIsoDateString,
    updateCanon: UpdateCanonModeSchema.optional(),
  })
  .strict();
export type RecordDecisionInput = z.infer<typeof RecordDecisionInputSchema>;

export const ListDecisionsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict();
export type ListDecisionsQuery = z.infer<typeof ListDecisionsQuerySchema>;

// -------------------------------------------------------------
// Asset Schemas
// -------------------------------------------------------------
export const CreateAssetInputSchema = z
  .object({
    id: OptionalString(100),
    name: NonEmptyString(200),
    kind: NonEmptyString(200),
    status: AssetStatusSchema.default("DRAFT"),
    sourceFilename: OptionalString(20000),
    url: OptionalAbsoluteUrlString,
    notes: OptionalString(20000),
  })
  .strict();
export type CreateAssetInput = z.infer<typeof CreateAssetInputSchema>;

export const UpdateAssetChangesSchema = z
  .object({
    name: NonEmptyString(200).optional(),
    kind: NonEmptyString(200).optional(),
    status: AssetStatusSchema.optional(),
    sourceFilename: OptionalString(20000).optional(),
    url: OptionalAbsoluteUrlString.optional(),
    notes: OptionalString(20000).optional(),
  })
  .strict()
  .refine((c) => Object.keys(c).length > 0, {
    message: "At least one field must be provided in changes.",
  });

export const UpdateAssetInputSchema = z
  .object({
    id: NonEmptyString(100),
    expectedVersion: z.coerce.number().int().min(1),
    changes: UpdateAssetChangesSchema,
  })
  .strict();
export type UpdateAssetInput = z.infer<typeof UpdateAssetInputSchema>;

export const RegisterAssetInputSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      id: OptionalString(100),
      name: NonEmptyString(200),
      kind: NonEmptyString(200),
      status: AssetStatusSchema.default("DRAFT"),
      sourceFilename: OptionalString(20000),
      url: OptionalAbsoluteUrlString,
      notes: OptionalString(20000),
    })
    .strict(),
  z
    .object({
      action: z.literal("update"),
      id: NonEmptyString(100),
      expectedVersion: z.coerce.number().int().min(1),
      changes: UpdateAssetChangesSchema,
    })
    .strict(),
]);
export type RegisterAssetInput = z.infer<typeof RegisterAssetInputSchema>;

export const ListAssetsQuerySchema = z
  .object({
    status: AssetStatusSchema.optional(),
    kind: z.string().trim().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict();
export type ListAssetsQuery = z.infer<typeof ListAssetsQuerySchema>;

// -------------------------------------------------------------
// Website Schemas
// -------------------------------------------------------------
export const CreateWebsiteInputSchema = z
  .object({
    id: OptionalString(100),
    name: NonEmptyString(200),
    domain: DomainString,
    purpose: NonEmptyString(20000),
    status: WebsiteStatusSchema.default("UNKNOWN"),
    repositoryUrl: OptionalAbsoluteUrlString,
    deploymentUrl: OptionalAbsoluteUrlString,
    notes: OptionalString(20000),
  })
  .strict();
export type CreateWebsiteInput = z.infer<typeof CreateWebsiteInputSchema>;

export const UpdateWebsiteChangesSchema = z
  .object({
    name: NonEmptyString(200).optional(),
    purpose: NonEmptyString(20000).optional(),
    status: WebsiteStatusSchema.optional(),
    repositoryUrl: OptionalAbsoluteUrlString.optional(),
    deploymentUrl: OptionalAbsoluteUrlString.optional(),
    notes: OptionalString(20000).optional(),
  })
  .strict()
  .refine((c) => Object.keys(c).length > 0, {
    message: "At least one field must be provided in changes.",
  });

export const UpdateWebsiteInputSchema = z
  .object({
    id: NonEmptyString(100),
    expectedVersion: z.coerce.number().int().min(1),
    changes: UpdateWebsiteChangesSchema,
  })
  .strict();
export type UpdateWebsiteInput = z.infer<typeof UpdateWebsiteInputSchema>;

export const ListWebsitesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict();
export type ListWebsitesQuery = z.infer<typeof ListWebsitesQuerySchema>;

// -------------------------------------------------------------
// Contact Schemas
// -------------------------------------------------------------
export const CreateContactInputSchema = z
  .object({
    id: OptionalString(100),
    name: NonEmptyString(200),
    organization: OptionalString(200),
    role: OptionalString(200),
    email: z
      .string()
      .trim()
      .email("Must be a valid email address.")
      .max(200)
      .optional()
      .nullable()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    status: NonEmptyString(200).default("PROSPECT"),
    notes: OptionalString(20000),
  })
  .strict();
export type CreateContactInput = z.infer<typeof CreateContactInputSchema>;

export const UpdateContactChangesSchema = z
  .object({
    name: NonEmptyString(200).optional(),
    organization: OptionalString(200).optional(),
    role: OptionalString(200).optional(),
    email: z
      .string()
      .trim()
      .email("Must be a valid email address.")
      .max(200)
      .optional()
      .nullable()
      .transform((v) => (v === "" || v === undefined ? null : v))
      .optional(),
    status: NonEmptyString(200).optional(),
    notes: OptionalString(20000).optional(),
  })
  .strict()
  .refine((c) => Object.keys(c).length > 0, {
    message: "At least one field must be provided in changes.",
  });

export const UpdateContactInputSchema = z
  .object({
    id: NonEmptyString(100),
    expectedVersion: z.coerce.number().int().min(1),
    changes: UpdateContactChangesSchema,
  })
  .strict();
export type UpdateContactInput = z.infer<typeof UpdateContactInputSchema>;

export const ListContactsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict();
export type ListContactsQuery = z.infer<typeof ListContactsQuerySchema>;

// -------------------------------------------------------------
// Content Item Schemas
// -------------------------------------------------------------
export const CreateContentItemInputSchema = z
  .object({
    id: OptionalString(100),
    title: NonEmptyString(200),
    format: NonEmptyString(200),
    channel: NonEmptyString(200),
    status: ContentStatusSchema.default("DRAFT"),
    scheduledFor: OptionalIsoDateString,
    publishedUrl: OptionalAbsoluteUrlString,
    notes: OptionalString(20000),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.status === "SCHEDULED" && !data.scheduledFor) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scheduledFor date is required when status is SCHEDULED.",
        path: ["scheduledFor"],
      });
    }
    if (data.status === "PUBLISHED" && !data.publishedUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "publishedUrl is required when status is PUBLISHED.",
        path: ["publishedUrl"],
      });
    }
  });
export type CreateContentItemInput = z.infer<typeof CreateContentItemInputSchema>;

export const UpdateContentItemChangesSchema = z
  .object({
    title: NonEmptyString(200).optional(),
    format: NonEmptyString(200).optional(),
    channel: NonEmptyString(200).optional(),
    status: ContentStatusSchema.optional(),
    scheduledFor: OptionalIsoDateString.optional(),
    publishedUrl: OptionalAbsoluteUrlString.optional(),
    notes: OptionalString(20000).optional(),
  })
  .strict()
  .refine((c) => Object.keys(c).length > 0, {
    message: "At least one field must be provided in changes.",
  });

export const UpdateContentItemInputSchema = z
  .object({
    id: NonEmptyString(100),
    expectedVersion: z.coerce.number().int().min(1),
    changes: UpdateContentItemChangesSchema,
  })
  .strict();
export type UpdateContentItemInput = z.infer<typeof UpdateContentItemInputSchema>;

export const ListContentItemsQuerySchema = z
  .object({
    status: ContentStatusSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict();
export type ListContentItemsQuery = z.infer<typeof ListContentItemsQuerySchema>;

// -------------------------------------------------------------
// Activity Schemas
// -------------------------------------------------------------
export const ListActivityQuerySchema = z
  .object({
    entityType: EntityTypeSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type ListActivityQuery = z.infer<typeof ListActivityQuerySchema>;
