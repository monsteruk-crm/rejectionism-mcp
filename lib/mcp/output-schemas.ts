import { z } from "zod";

/**
 * Output schemas for MCP tools (upgrade plan section 4).
 * Enforces structured types and ISO strings for dates.
 */

export const CommonPaginationOutput = {
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
};

// -------------------------------------------------------------
// Work Item Outputs
// -------------------------------------------------------------
export const WorkItemDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.string(),
  priority: z.number(),
  dueDate: z.string().nullable(),
  blockedReason: z.string().nullable(),
  evidenceUrl: z.string().nullable(),
  completionNote: z.string().nullable(),
  version: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ListWorkItemsOutputSchema = z.object({
  items: z.array(WorkItemDtoSchema),
  ...CommonPaginationOutput,
});

// -------------------------------------------------------------
// Canon & Decision Outputs
// -------------------------------------------------------------
export const CanonEntryDtoSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string(),
  category: z.string(),
  notes: z.string().nullable(),
  version: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const GetCanonOutputSchema = z.union([
  z.object({
    mode: z.literal("single"),
    entry: CanonEntryDtoSchema,
  }),
  z.object({
    mode: z.literal("collection"),
    items: z.array(CanonEntryDtoSchema),
    ...CommonPaginationOutput,
  }),
]);

export const DecisionDtoSchema = z.object({
  id: z.string(),
  subject: z.string(),
  decision: z.string(),
  rationale: z.string(),
  supersedesId: z.string().nullable(),
  supersededById: z.string().nullable(),
  decidedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  canonEntry: CanonEntryDtoSchema.nullable().optional(),
});

export const ListDecisionsOutputSchema = z.object({
  items: z.array(DecisionDtoSchema),
  ...CommonPaginationOutput,
});

// -------------------------------------------------------------
// Tag & Relation Outputs
// -------------------------------------------------------------
export const TagDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.string(),
});

export const ListTagsOutputSchema = z.object({
  items: z.array(TagDtoSchema),
  ...CommonPaginationOutput,
});

export const EntityRefSchema = z.object({
  entityType: z.string(),
  entityId: z.string(),
});

export const TagEntityOutputSchema = z.object({
  tag: TagDtoSchema,
  entity: EntityRefSchema,
  changed: z.boolean(),
});

export const UntagEntityOutputSchema = z.object({
  entity: EntityRefSchema,
  tagSlug: z.string(),
  changed: z.boolean(),
});

export const RelationDtoSchema = z.object({
  id: z.string(),
  from: EntityRefSchema,
  to: EntityRefSchema,
  relationType: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  fromTitle: z.string(),
  toTitle: z.string(),
  fromHref: z.string(),
  toHref: z.string(),
});

export const DirectedRelationDtoSchema = RelationDtoSchema.extend({
  direction: z.enum(["incoming", "outgoing"]),
});

export const GetRelationshipsOutputSchema = z.object({
  items: z.array(DirectedRelationDtoSchema),
  ...CommonPaginationOutput,
});

export const LinkEntitiesOutputSchema = z.object({
  relation: RelationDtoSchema,
  changed: z.boolean(),
});

export const UnlinkEntitiesOutputSchema = z.object({
  relationId: z.string(),
  changed: z.boolean(),
});

// -------------------------------------------------------------
// Asset & Upload Outputs
// -------------------------------------------------------------
export const RepresentationDtoSchema = z.object({
  id: z.string(),
  assetRevisionId: z.string(),
  storageType: z.enum(["BLOB", "EXTERNAL_URL"]),
  label: z.string().nullable(),
  notes: z.string().nullable(),
  variant: z.string().nullable(),
  format: z.string().nullable(),
  sourceFilename: z.string().nullable(),
  mimeType: z.string().nullable(),
  byteSize: z.number().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  checksumSha256: z.string().nullable(),
  blobUrl: z.string().nullable(),
  blobPathname: z.string().nullable(),
  externalUrl: z.string().nullable(),
  isPrimary: z.boolean(),
  createdAt: z.string(),
  openUrl: z.string().nullable(),
  downloadUrl: z.string().nullable(),
});

export const RevisionDtoSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  revisionNumber: z.number(),
  label: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  representations: z.array(RepresentationDtoSchema),
});

export const AssetDetailDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  status: z.string(),
  sourceFilename: z.string().nullable(),
  url: z.string().nullable(),
  notes: z.string().nullable(),
  version: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  revisions: z.array(RevisionDtoSchema),
  latestRevisionNumber: z.number().nullable(),
  primaryRepresentationId: z.string().nullable(),
  tags: z.array(TagDtoSchema),
  relationships: z.array(RelationDtoSchema),
  legacyReferenceWarning: z.boolean(),
});

export const AssetListDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  status: z.string(),
  sourceFilename: z.string().nullable(),
  url: z.string().nullable(),
  notes: z.string().nullable(),
  version: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  revisionCount: z.number(),
  latestRevisionNumber: z.number().nullable(),
  primaryRepresentation: RepresentationDtoSchema.nullable(),
  storageTypes: z.array(z.enum(["BLOB", "EXTERNAL_URL"])),
  tags: z.array(z.string()),
  legacyReferenceWarning: z.boolean(),
});

export const ListAssetsOutputSchema = z.object({
  items: z.array(AssetListDtoSchema),
  ...CommonPaginationOutput,
});

export const AssetRevisionCreatedOutputSchema = z.object({
  assetId: z.string(),
  assetVersion: z.number(),
  revision: RevisionDtoSchema,
});

export const AssetRepresentationAddedOutputSchema = z.object({
  assetId: z.string(),
  assetVersion: z.number(),
  representation: RepresentationDtoSchema,
});

export const SetPrimaryRepresentationOutputSchema = z.object({
  assetId: z.string(),
  assetVersion: z.number(),
  assetRevisionId: z.string(),
  primaryRepresentationId: z.string(),
});

export const UploadRequestDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  instructions: z.string(),
  status: z.enum(["OPEN", "SUBMITTED", "REVOKED"]),
  effectiveStatus: z.enum(["OPEN", "SUBMITTED", "REVOKED", "EXPIRED"]),
  expiresAt: z.string(),
  maxItems: z.number(),
  targetAssetId: z.string().nullable(),
  targetRevisionId: z.string().nullable(),
  targetAssetVersion: z.number().nullable(),
  submissionKey: z.string().nullable(),
  submittedAt: z.string().nullable(),
  itemCount: z.number().nullable(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const CreateUploadLinkOutputSchema = z.object({
  uploadRequest: UploadRequestDtoSchema,
  uploadUrl: z.string(),
});

export const ListUploadLinksOutputSchema = z.object({
  items: z.array(UploadRequestDtoSchema),
  ...CommonPaginationOutput,
});

export const UploadFileDtoSchema = z.object({
  id: z.string(),
  clientItemId: z.string(),
  status: z.string(),
  sourceFilename: z.string(),
  declaredMimeType: z.string(),
  expectedByteSize: z.number(),
  blobPathname: z.string(),
  mimeType: z.string().nullable(),
  byteSize: z.number().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  verifiedAt: z.string().nullable(),
  failureCode: z.string().nullable(),
  authorizationCount: z.number(),
  authorizationExpiresAt: z.string().nullable(),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const GetUploadLinkOutputSchema = z.object({
  request: UploadRequestDtoSchema,
  files: z.array(UploadFileDtoSchema),
});

export const RevokeUploadLinkOutputSchema = z.object({
  uploadRequest: UploadRequestDtoSchema,
  changed: z.boolean(),
});

export const RegenerateUploadLinkOutputSchema = z.object({
  uploadRequest: UploadRequestDtoSchema,
  uploadUrl: z.string(),
  replacedRequestId: z.string(),
});

// -------------------------------------------------------------
// Website, Content, Contact Outputs
// -------------------------------------------------------------
export const WebsiteDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string(),
  purpose: z.string(),
  status: z.string(),
  repositoryUrl: z.string().nullable(),
  deploymentUrl: z.string().nullable(),
  notes: z.string().nullable(),
  version: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ListWebsitesOutputSchema = z.object({
  items: z.array(WebsiteDtoSchema),
  ...CommonPaginationOutput,
});

export const ContentItemDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  format: z.string(),
  channel: z.string(),
  status: z.string(),
  scheduledFor: z.string().nullable(),
  publishedUrl: z.string().nullable(),
  notes: z.string().nullable(),
  version: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ListContentItemsOutputSchema = z.object({
  items: z.array(ContentItemDtoSchema),
  ...CommonPaginationOutput,
});

export const ContactDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  organization: z.string().nullable(),
  role: z.string().nullable(),
  email: z.string().nullable().optional(),
  status: z.string(),
  notes: z.string().nullable().optional(),
  version: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ListContactsOutputSchema = z.object({
  items: z.array(ContactDtoSchema),
  ...CommonPaginationOutput,
});

// -------------------------------------------------------------
// Search Output
// -------------------------------------------------------------
export const SearchResultDtoSchema = z.object({
  entityType: z.enum([
    "WORK_ITEM",
    "CANON_ENTRY",
    "DECISION",
    "ASSET",
    "WEBSITE",
    "CONTENT_ITEM",
    "CONTACT",
    "CAMPAIGN_MEMORY",
  ]),
  id: z.string(),
  title: z.string(),
  snippet: z.string(),
  status: z.string().nullable(),
  tags: z.array(z.string()),
  updatedAt: z.string(),
  href: z.string(),
});

export const SearchOutputSchema = z.object({
  items: z.array(SearchResultDtoSchema),
  ...CommonPaginationOutput,
});

// -------------------------------------------------------------
// Activity Feed Output
// -------------------------------------------------------------
export const ActivityFeedOutputSchema = z.object({
  items: z.array(z.record(z.string(), z.unknown())),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

// -------------------------------------------------------------
// Memory Outputs (ADR 0007, brief sections 4, 8, 9)
// -------------------------------------------------------------
export const MemoryDtoSchema = z.object({
  id: z.string(),
  key: z.string().nullable(),
  title: z.string(),
  content: z.string(),
  contentHash: z.string(),
  category: z.enum([
    "PREFERENCE",
    "CONTEXT",
    "INSTRUCTION",
    "LESSON",
    "PERSON",
    "PROJECT",
    "STYLE",
    "PROCESS",
    "TECHNICAL",
    "REFERENCE",
    "OTHER",
  ]),
  status: z.enum(["ACTIVE", "SUPERSEDED", "ARCHIVED"]),
  importance: z.number(),
  confidence: z.number(),
  pinned: z.boolean(),
  sourceType: z.enum(["HUMAN", "MCP", "ADMIN", "IMPORT", "SYSTEM"]),
  sourceLabel: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  version: z.number(),
  accessCount: z.number(),
  lastAccessedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  isExpired: z.boolean(),
  supersededById: z.string().nullable(),
  supersedesId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  href: z.string(),
});

export const MemorySummaryDtoSchema = MemoryDtoSchema.omit({ content: true }).extend({
  contentExcerpt: z.string(),
  sortedTagSlugs: z.array(z.string()),
  tagsTotal: z.number(),
});

export const MemoryTagDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.string(),
});

export const MemoryRelationshipDtoSchema = z.object({
  id: z.string(),
  from: EntityRefSchema,
  to: EntityRefSchema,
  direction: z.enum(["incoming", "outgoing"]),
  relationType: z.enum(["RELATES_TO", "USES_ASSET", "PART_OF"]),
  notes: z.string().nullable(),
  createdAt: z.string(),
  fromTitle: z.string(),
  toTitle: z.string(),
  fromHref: z.string(),
  toHref: z.string(),
});

export const MemoryDetailDtoSchema = z.object({
  memory: MemoryDtoSchema,
  tags: z.array(MemoryTagDtoSchema),
  tagsTotal: z.number(),
  tagLimit: z.number(),
  tagOffset: z.number(),
  relationships: z.array(MemoryRelationshipDtoSchema),
  relationshipsTotal: z.number(),
  relationshipLimit: z.number(),
  relationshipOffset: z.number(),
  supersedes: MemorySummaryDtoSchema.nullable(),
  supersededBy: MemorySummaryDtoSchema.nullable(),
});

export const ListMemoriesOutputSchema = z.object({
  items: z.array(MemorySummaryDtoSchema),
  ...CommonPaginationOutput,
});

export const MemoryNextActionSchema = z.object({
  tool: z.enum([
    "campaign_get_memory",
    "campaign_update_memory",
    "campaign_supersede_memory",
    "cancel",
  ]),
});

export const RememberMemoryOutputSchema = z.object({
  outcome: z.enum(["CREATED", "DUPLICATE", "ALREADY_CURRENT", "KEY_CONFLICT"]),
  memory: MemoryDtoSchema,
  nextActions: z.array(MemoryNextActionSchema),
});

export const UpdateMemoryOutputSchema = z.object({
  memory: MemoryDtoSchema,
  changed: z.boolean(),
});

export const SupersedeMemoryOutputSchema = z.object({
  memory: MemoryDtoSchema,
  supersededMemory: MemoryDtoSchema,
});

export const RecalledMemoryDtoSchema = z.object({
  id: z.string(),
  key: z.string().nullable(),
  title: z.string(),
  content: z.string(),
  contentTruncated: z.boolean(),
  category: z.enum([
    "PREFERENCE",
    "CONTEXT",
    "INSTRUCTION",
    "LESSON",
    "PERSON",
    "PROJECT",
    "STYLE",
    "PROCESS",
    "TECHNICAL",
    "REFERENCE",
    "OTHER",
  ]),
  status: z.enum(["ACTIVE", "SUPERSEDED", "ARCHIVED"]),
  isExpired: z.boolean(),
  importance: z.number(),
  confidence: z.number(),
  pinned: z.boolean(),
  version: z.number(),
  expiresAt: z.string().nullable(),
  sourceType: z.enum(["HUMAN", "MCP", "ADMIN", "IMPORT", "SYSTEM"]),
  sourceLabel: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  updatedAt: z.string(),
  sortedTagSlugs: z.array(z.string()),
  tagsTotal: z.number(),
  href: z.string(),
  relevanceScore: z.number(),
  relevanceReasons: z.array(z.string()),
});

export const RecallOutputSchema = z.object({
  items: z.array(RecalledMemoryDtoSchema),
  limit: z.number(),
  queryTokens: z.array(z.string()),
  queryTokensTruncated: z.boolean(),
});

export const MemoryHealthOutputSchema = z.object({
  active: z.number(),
  pinned: z.number(),
  superseded: z.number(),
  archived: z.number(),
  expired: z.number(),
  possibleExactDuplicates: z.number(),
});

export const CampaignContextOutputSchema = z.object({
  task: z.string(),
  authorityOrder: z.array(z.string()),
  authorityNotice: z.string(),
  canon: z.array(z.record(z.string(), z.unknown())),
  canonTruncated: z.boolean(),
  recentDecisions: z.array(z.record(z.string(), z.unknown())),
  recentDecisionsTruncated: z.boolean(),
  memories: z.array(z.record(z.string(), z.unknown())),
  memoriesTruncated: z.boolean(),
  relatedWorkItems: z.array(z.record(z.string(), z.unknown())),
  relatedWorkItemsTruncated: z.boolean(),
  relatedAssets: z.array(z.record(z.string(), z.unknown())),
  relatedAssetsTruncated: z.boolean(),
  authorityWarnings: z.array(z.record(z.string(), z.unknown())),
  authorityWarningsTruncated: z.boolean(),
  truncatedSections: z.array(z.string()),
});
