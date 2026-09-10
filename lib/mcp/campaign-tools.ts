import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  // Services
  getCampaignStatus,
  listWorkItems,
  getWorkItemById,
  createWorkItem,
  updateWorkItem,
  getCanon,
  createCanonEntry,
  updateCanonEntry,
  recordDecision,
  listDecisions,
  getDecisionById,
  listAssets,
  getAssetById,
  createAsset,
  updateAsset,
  addExternalAsset,
  createAssetRevision,
  addAssetRepresentation,
  setPrimaryAssetRepresentation,
  registerAsset,
  createUploadRequest,
  listUploadRequests,
  getUploadRequest,
  revokeUploadRequest,
  regenerateUploadRequest,
  listWebsites,
  getWebsiteById,
  createWebsite,
  updateWebsite,
  listContentItems,
  getContentItemById,
  createContentItem,
  updateContentItem,
  listContacts,
  getContactById,
  createContact,
  updateContact,
  listTags,
  tagEntity,
  untagEntity,
  getRelationships,
  linkEntities,
  unlinkEntities,
  searchCampaign,
  listActivity,
  rememberMemory,
  updateMemory,
  supersedeMemory,
  archiveMemory,
  getMemory,
  listMemories,
  recallMemories,
  getCampaignContext,
  getMemoryHealth,

  // Schemas
  NonEmptyString,
  CreateWorkItemInputSchema,
  UpdateWorkItemInputSchema,
  ListWorkItemsQuerySchema,
  GetCanonQuerySchema,
  CreateCanonEntryInputSchema,
  UpdateCanonEntryInputSchema,
  RecordDecisionInputSchema,
  ListDecisionsQuerySchema,
  ListAssetsQuerySchema,
  CreateAssetInputSchema,
  UpdateAssetInputSchema,
  RegisterAssetInputSchema,
  AddExternalAssetInputSchema,
  CreateAssetRevisionInputSchema,
  AddAssetRepresentationInputSchema,
  SetPrimaryAssetRepresentationInputSchema,
  CreateUploadRequestInputSchema,
  ListUploadRequestsQuerySchema,
  GetUploadRequestInputSchema,
  RevokeUploadRequestInputSchema,
  RegenerateUploadRequestInputSchema,
  ListWebsitesQuerySchema,
  CreateWebsiteInputSchema,
  UpdateWebsiteInputSchema,
  ListContentItemsQuerySchema,
  CreateContentItemInputSchema,
  UpdateContentItemInputSchema,
  ListContactsQuerySchema,
  GetContactInputSchema,
  CreateContactInputSchema,
  UpdateContactInputSchema,
  ListTagsQuerySchema,
  TagEntityInputSchema,
  UntagEntityInputSchema,
  GetRelationshipsQuerySchema,
  LinkEntitiesInputSchema,
  UnlinkEntitiesInputSchema,
  SearchQuerySchema,
  ListActivityQuerySchema,
  RememberMemoryInputSchema,
  UpdateMemoryInputSchema,
  SupersedeMemoryInputSchema,
  ArchiveMemoryInputSchema,
  GetMemoryInputSchema,
  ListMemoriesQuerySchema,
  RecallMemoriesInputSchema,
  GetContextInputSchema,
} from "@/lib/campaign";

import {
  ListWorkItemsOutputSchema,
  WorkItemDtoSchema,
  GetCanonOutputSchema,
  CanonEntryDtoSchema,
  ListDecisionsOutputSchema,
  DecisionDtoSchema,
  ListAssetsOutputSchema,
  AssetDetailDtoSchema,
  AssetRevisionCreatedOutputSchema,
  AssetRepresentationAddedOutputSchema,
  SetPrimaryRepresentationOutputSchema,
  ListUploadLinksOutputSchema,
  CreateUploadLinkOutputSchema,
  GetUploadLinkOutputSchema,
  RevokeUploadLinkOutputSchema,
  RegenerateUploadLinkOutputSchema,
  ListWebsitesOutputSchema,
  WebsiteDtoSchema,
  ListContentItemsOutputSchema,
  ContentItemDtoSchema,
  ListContactsOutputSchema,
  ContactDtoSchema,
  ListTagsOutputSchema,
  TagEntityOutputSchema,
  UntagEntityOutputSchema,
  GetRelationshipsOutputSchema,
  LinkEntitiesOutputSchema,
  UnlinkEntitiesOutputSchema,
  SearchOutputSchema,
  ActivityFeedOutputSchema,
  MemoryDtoSchema,
  MemoryDetailDtoSchema,
  ListMemoriesOutputSchema,
  RememberMemoryOutputSchema,
  UpdateMemoryOutputSchema,
  SupersedeMemoryOutputSchema,
  RecallOutputSchema,
  CampaignContextOutputSchema,
  MemoryHealthOutputSchema,
} from "./output-schemas";

import { toMcpToolResult } from "./tool-result";

const GetByIdInputSchema = z.object({ id: NonEmptyString(100) }).strict();

export function registerCampaignTools(server: McpServer) {
  // -----------------------------------------------------------
  // 1. Status & Overview
  // -----------------------------------------------------------
  server.registerTool(
    "campaign_get_status",
    {
      title: "Get Campaign Status",
      description:
        "Get a high-level operational overview of Rejectionism CampaignOS: counts by status, in-progress items, blocked items, next three priority work items, missing assets, website statuses, recent decisions, and latest activity.",
      inputSchema: z.object({}).strict(),
      outputSchema: z.record(z.string(), z.unknown()),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      const res = await getCampaignStatus();
      return toMcpToolResult(
        res as any,
        (data: any) =>
          `Campaign status retrieved: ${data.workItemCounts.TOTAL} total work items (${data.workItemCounts.IN_PROGRESS} in progress, ${data.workItemCounts.BLOCKED} blocked, ${data.workItemCounts.DONE} done).`,
      );
    },
  );

  // -----------------------------------------------------------
  // 2-5. Work Items
  // -----------------------------------------------------------
  server.registerTool(
    "campaign_list_work_items",
    {
      title: "List Work Items",
      description:
        "List and filter work items by status, minimum priority, due date, or text search in title/description.",
      inputSchema: ListWorkItemsQuerySchema,
      outputSchema: ListWorkItemsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await listWorkItems(args);
      return toMcpToolResult(
        res as any,
        (data: any) => `Retrieved ${data.items.length} of ${data.total} work items.`,
      );
    },
  );

  server.registerTool(
    "campaign_get_work_item",
    {
      title: "Get Work Item",
      description: "Retrieve complete details of a specific work item by ID.",
      inputSchema: GetByIdInputSchema,
      outputSchema: WorkItemDtoSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await getWorkItemById(args.id);
      return toMcpToolResult(
        res as any,
        (data: any) => `Retrieved work item "${data.title}" (Status: ${data.status}).`,
      );
    },
  );

  server.registerTool(
    "campaign_create_work_item",
    {
      title: "Create Work Item",
      description:
        "Create a new campaign work item. Moving to or creating in DONE status requires an evidenceUrl or a completionNote. Creating in BLOCKED status requires a blockedReason.",
      inputSchema: CreateWorkItemInputSchema,
      outputSchema: WorkItemDtoSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await createWorkItem(args, "mcp");
      return toMcpToolResult(
        res as any,
        (data: any) => `Work item created: "${data.title}" (ID: ${data.id}, Version: ${data.version}).`,
      );
    },
  );

  server.registerTool(
    "campaign_update_work_item",
    {
      title: "Update Work Item",
      description:
        "Update an existing work item with optimistic concurrency control (requires expectedVersion). Enforces evidence requirement when moving to DONE status.",
      inputSchema: UpdateWorkItemInputSchema,
      outputSchema: WorkItemDtoSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await updateWorkItem(args, "mcp");
      return toMcpToolResult(
        res as any,
        (data: any) =>
          `Work item updated: "${data.title}" (ID: ${data.id}, New Version: ${data.version}, Status: ${data.status}).`,
      );
    },
  );

  // -----------------------------------------------------------
  // 6-8. Canon
  // -----------------------------------------------------------
  server.registerTool(
    "campaign_get_canon",
    {
      title: "Get Canon Entries",
      description:
        "Retrieve authoritative campaign facts, slogans, roles, and papal names. Query a specific unique key, a category, or list all entries.",
      inputSchema: GetCanonQuerySchema,
      outputSchema: GetCanonOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await getCanon(args);
      return toMcpToolResult(res as any, (data: any) => {
        if (data.mode === "single") {
          return `Canon entry "${data.entry.key}": "${data.entry.value}" (Category: ${data.entry.category}).`;
        }
        return `Retrieved ${data.items.length} of ${data.total} canon entries.`;
      });
    },
  );

  server.registerTool(
    "campaign_create_canon",
    {
      title: "Create Canon Entry",
      description:
        "Create a new authoritative campaign canon fact, slogan, role, or papal name.",
      inputSchema: CreateCanonEntryInputSchema,
      outputSchema: CanonEntryDtoSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await createCanonEntry(args, "mcp");
      return toMcpToolResult(
        res as any,
        (data: any) => `Canon entry created: "${data.key}".`,
      );
    },
  );

  server.registerTool(
    "campaign_update_canon",
    {
      title: "Update Canon Entry",
      description:
        "Update the value, category, or notes of an existing canon entry using optimistic concurrency (requires expectedVersion). The unique key is immutable.",
      inputSchema: UpdateCanonEntryInputSchema,
      outputSchema: CanonEntryDtoSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await updateCanonEntry(args, "mcp");
      return toMcpToolResult(
        res as any,
        (data: any) => `Canon entry updated: "${data.key}" (New Version: ${data.version}).`,
      );
    },
  );

  // -----------------------------------------------------------
  // 9-11. Decisions
  // -----------------------------------------------------------
  server.registerTool(
    "campaign_list_decisions",
    {
      title: "List Decisions",
      description:
        "List all recorded campaign decisions in reverse chronological order with supersession lineage.",
      inputSchema: ListDecisionsQuerySchema,
      outputSchema: ListDecisionsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await listDecisions(args);
      return toMcpToolResult(
        res as any,
        (data: any) => `Retrieved ${data.items.length} of ${data.total} decisions.`,
      );
    },
  );

  server.registerTool(
    "campaign_get_decision",
    {
      title: "Get Decision",
      description: "Retrieve a specific recorded decision by ID.",
      inputSchema: GetByIdInputSchema,
      outputSchema: DecisionDtoSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await getDecisionById(args.id);
      return toMcpToolResult(
        res as any,
        (data: any) => `Retrieved decision: "${data.subject}".`,
      );
    },
  );

  server.registerTool(
    "campaign_record_decision",
    {
      title: "Record Decision",
      description:
        "Record an authoritative architectural, strategic, or campaign decision. Optionally supersede a previous decision (retaining full history) and optionally create or update an associated canon entry in the same atomic transaction.",
      inputSchema: RecordDecisionInputSchema,
      outputSchema: DecisionDtoSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await recordDecision(args, "mcp");
      return toMcpToolResult(
        res as any,
        (data: any) => `Decision recorded: "${data.subject}" (ID: ${data.id}).`,
      );
    },
  );

  // -----------------------------------------------------------
  // 12-19. Visual Assets
  // -----------------------------------------------------------
  server.registerTool(
    "campaign_list_assets",
    {
      title: "List Assets",
      description:
        "List and filter registered visual assets by workflow status, kind, search substring, storage type (BLOB / EXTERNAL_URL), or tag slugs.",
      inputSchema: ListAssetsQuerySchema,
      outputSchema: ListAssetsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await listAssets(args);
      return toMcpToolResult(
        res as any,
        (data: any) => `Retrieved ${data.items.length} of ${data.total} assets.`,
      );
    },
  );

  server.registerTool(
    "campaign_get_asset",
    {
      title: "Get Asset",
      description:
        "Retrieve complete details of a conceptual visual asset, including all historical revisions, file/link representations, tags, and entity relationships.",
      inputSchema: GetByIdInputSchema,
      outputSchema: AssetDetailDtoSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await getAssetById(args.id);
      return toMcpToolResult(
        res as any,
        (data: any) =>
          `Retrieved asset "${data.name}" (${data.revisions.length} revision(s), Status: ${data.status}).`,
      );
    },
  );

  server.registerTool(
    "campaign_create_asset",
    {
      title: "Create Asset Metadata",
      description:
        "Register a new conceptual visual asset with an initial empty revision 1. APPROVED status is invalid without an initial representation.",
      inputSchema: CreateAssetInputSchema,
      outputSchema: AssetDetailDtoSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await createAsset(args, "mcp");
      if (!res.ok) {
        return toMcpToolResult(res as any);
      }
      const detail = await getAssetById(res.data.id);
      return toMcpToolResult(
        detail as any,
        (data: any) => `Asset created: "${data.name}" (ID: ${data.id}).`,
      );
    },
  );

  server.registerTool(
    "campaign_update_asset",
    {
      title: "Update Asset Metadata",
      description:
        "Update conceptual asset metadata or workflow status using optimistic concurrency (requires expectedVersion).",
      inputSchema: UpdateAssetInputSchema,
      outputSchema: AssetDetailDtoSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await updateAsset(args, "mcp");
      if (!res.ok) {
        return toMcpToolResult(res as any);
      }
      const detail = await getAssetById(res.data.id);
      return toMcpToolResult(
        detail as any,
        (data: any) => `Asset updated: "${data.name}" (New Version: ${data.version}).`,
      );
    },
  );

  server.registerTool(
    "campaign_add_external_asset",
    {
      title: "Add External Asset",
      description:
        "Create a new visual asset, revision 1, and its primary external URL representation in one atomic transaction.",
      inputSchema: AddExternalAssetInputSchema,
      outputSchema: AssetDetailDtoSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await addExternalAsset(args, "mcp");
      return toMcpToolResult(
        res as any,
        (data: any) => `Created external asset: "${data.name}" (ID: ${data.id}).`,
      );
    },
  );

  server.registerTool(
    "campaign_create_asset_revision",
    {
      title: "Create Asset Revision",
      description:
        "Create the next sequential empty revision for an asset using optimistic concurrency (requires expectedVersion).",
      inputSchema: CreateAssetRevisionInputSchema,
      outputSchema: AssetRevisionCreatedOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await createAssetRevision(args, "mcp");
      return toMcpToolResult(
        res as any,
        (data: any) =>
          `Created revision ${data.revision.revisionNumber} for asset ${data.assetId}.`,
      );
    },
  );

  server.registerTool(
    "campaign_add_asset_representation",
    {
      title: "Add Asset Representation",
      description:
        "Append an external URL representation to an existing asset revision. The first representation on an empty revision becomes primary.",
      inputSchema: AddAssetRepresentationInputSchema,
      outputSchema: AssetRepresentationAddedOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await addAssetRepresentation(args, "mcp");
      return toMcpToolResult(
        res as any,
        (data: any) =>
          `Added representation to revision (Storage: ${data.representation.storageType}, Primary: ${data.representation.isPrimary}).`,
      );
    },
  );

  server.registerTool(
    "campaign_set_primary_asset_representation",
    {
      title: "Set Primary Asset Representation",
      description:
        "Atomically switch the primary representation of an asset revision using optimistic concurrency (requires expectedVersion).",
      inputSchema: SetPrimaryAssetRepresentationInputSchema,
      outputSchema: SetPrimaryRepresentationOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await setPrimaryAssetRepresentation(args, "mcp");
      return toMcpToolResult(
        res as any,
        (data: any) =>
          `Switched primary representation to ${data.primaryRepresentationId} (New Version: ${data.assetVersion}).`,
      );
    },
  );

  server.registerTool(
    "campaign_register_asset",
    {
      title: "Register or Update Asset (Legacy Compatibility)",
      description:
        "Register a new asset or update an existing asset using the legacy compatibility contract.",
      inputSchema: RegisterAssetInputSchema,
      outputSchema: z.record(z.string(), z.unknown()),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await registerAsset(args, "mcp");
      return toMcpToolResult(
        res as any,
        (data: any) =>
          `Asset registered/updated: "${data.name}" (ID: ${data.id}, Version: ${data.version}, Status: ${data.status}).`,
      );
    },
  );

  // -----------------------------------------------------------
  // 20-24. Upload Links
  // -----------------------------------------------------------
  server.registerTool(
    "campaign_create_upload_link",
    {
      title: "Create Upload Link",
      description:
        "Create a single-use capability upload link for external contributors or multi-file administrative uploads. Returns the raw capability URL exactly once.",
      inputSchema: CreateUploadRequestInputSchema,
      outputSchema: CreateUploadLinkOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await createUploadRequest(args, "mcp");
      if (!res.ok) {
        return toMcpToolResult(res as any);
      }
      return toMcpToolResult(
        {
          ok: true,
          data: {
            uploadRequest: res.data.uploadRequest,
            uploadUrl: res.data.uploadUrl,
          },
        } as any,
        (data: any) => `Upload link created: ${data.uploadUrl} (Expires: ${data.uploadRequest.expiresAt}).`,
      );
    },
  );

  server.registerTool(
    "campaign_list_upload_links",
    {
      title: "List Upload Links",
      description:
        "List upload links filtered by effective status (OPEN, SUBMITTED, REVOKED, EXPIRED) or target asset.",
      inputSchema: ListUploadRequestsQuerySchema,
      outputSchema: ListUploadLinksOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await listUploadRequests(args);
      return toMcpToolResult(
        res as any,
        (data: any) => `Retrieved ${data.items.length} of ${data.total} upload links.`,
      );
    },
  );

  server.registerTool(
    "campaign_get_upload_link",
    {
      title: "Get Upload Link",
      description:
        "Retrieve details of an upload link and its reserved/uploaded files. Does not expose raw tokens.",
      inputSchema: GetUploadRequestInputSchema,
      outputSchema: GetUploadLinkOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await getUploadRequest(args);
      return toMcpToolResult(
        res as any,
        (data: any) =>
          `Retrieved upload link "${data.request.title}" (Effective Status: ${data.request.effectiveStatus}, Files: ${data.files.length}).`,
      );
    },
  );

  server.registerTool(
    "campaign_revoke_upload_link",
    {
      title: "Revoke Upload Link",
      description:
        "Revoke an open upload link. Idempotent on already-revoked links; fails if already submitted.",
      inputSchema: RevokeUploadRequestInputSchema,
      outputSchema: RevokeUploadLinkOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await revokeUploadRequest(args, "mcp");
      if (!res.ok) {
        return toMcpToolResult(res as any);
      }
      const detail = await getUploadRequest({ id: res.data.id });
      if (!detail.ok) {
        return toMcpToolResult(detail as any);
      }
      return toMcpToolResult(
        {
          ok: true,
          data: {
            uploadRequest: detail.data.request,
            changed: !res.data.noop,
          },
        } as any,
        (data: any) => `Upload link revoked (Status: ${data.uploadRequest.status}).`,
      );
    },
  );

  server.registerTool(
    "campaign_regenerate_upload_link",
    {
      title: "Regenerate Upload Link",
      description:
        "Regenerate an open upload link with a fresh token and current target version snapshot, revoking the old link.",
      inputSchema: RegenerateUploadRequestInputSchema,
      outputSchema: RegenerateUploadLinkOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await regenerateUploadRequest(args, "mcp");
      if (!res.ok) {
        return toMcpToolResult(res as any);
      }
      return toMcpToolResult(
        {
          ok: true,
          data: {
            uploadRequest: res.data.uploadRequest,
            uploadUrl: res.data.uploadUrl,
            replacedRequestId: res.data.replacedId,
          },
        } as any,
        (data: any) => `Upload link regenerated: ${data.uploadUrl} (Replaced ID: ${data.replacedRequestId}).`,
      );
    },
  );

  // -----------------------------------------------------------
  // 25-27. Websites
  // -----------------------------------------------------------
  server.registerTool(
    "campaign_list_websites",
    {
      title: "List Websites",
      description:
        "List all registered campaign domains, their intended roles, known status, repositories, and deployment URLs.",
      inputSchema: ListWebsitesQuerySchema,
      outputSchema: ListWebsitesOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await listWebsites(args);
      return toMcpToolResult(
        res as any,
        (data: any) => `Retrieved ${data.items.length} of ${data.total} registered websites.`,
      );
    },
  );

  server.registerTool(
    "campaign_get_website",
    {
      title: "Get Website",
      description: "Retrieve details of a registered campaign domain by ID.",
      inputSchema: GetByIdInputSchema,
      outputSchema: WebsiteDtoSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await getWebsiteById(args.id);
      return toMcpToolResult(
        res as any,
        (data: any) => `Retrieved website "${data.domain}" (Status: ${data.status}).`,
      );
    },
  );

  server.registerTool(
    "campaign_create_website",
    {
      title: "Create Website",
      description: "Register a new campaign website or domain.",
      inputSchema: CreateWebsiteInputSchema,
      outputSchema: WebsiteDtoSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await createWebsite(args, "mcp");
      return toMcpToolResult(
        res as any,
        (data: any) => `Website registered: "${data.domain}" (ID: ${data.id}).`,
      );
    },
  );

  server.registerTool(
    "campaign_update_website",
    {
      title: "Update Website",
      description:
        "Update configuration, purpose, or status of a website using optimistic concurrency (requires expectedVersion). Domain name is immutable.",
      inputSchema: UpdateWebsiteInputSchema,
      outputSchema: WebsiteDtoSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await updateWebsite(args, "mcp");
      return toMcpToolResult(
        res as any,
        (data: any) => `Website updated: "${data.domain}" (New Version: ${data.version}).`,
      );
    },
  );

  // -----------------------------------------------------------
  // 28-31. Content Items
  // -----------------------------------------------------------
  server.registerTool(
    "campaign_list_content",
    {
      title: "List Content Items",
      description:
        "List and filter scheduled or published campaign content across channels.",
      inputSchema: ListContentItemsQuerySchema,
      outputSchema: ListContentItemsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await listContentItems(args);
      return toMcpToolResult(
        res as any,
        (data: any) => `Retrieved ${data.items.length} of ${data.total} content items.`,
      );
    },
  );

  server.registerTool(
    "campaign_get_content",
    {
      title: "Get Content Item",
      description: "Retrieve a specific content item by ID.",
      inputSchema: GetByIdInputSchema,
      outputSchema: ContentItemDtoSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await getContentItemById(args.id);
      return toMcpToolResult(
        res as any,
        (data: any) => `Retrieved content item "${data.title}" (Status: ${data.status}).`,
      );
    },
  );

  server.registerTool(
    "campaign_create_content",
    {
      title: "Create Content Item",
      description:
        "Create a new content item. SCHEDULED status requires a scheduledFor date; PUBLISHED status requires a publishedUrl.",
      inputSchema: CreateContentItemInputSchema,
      outputSchema: ContentItemDtoSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await createContentItem(args, "mcp");
      return toMcpToolResult(
        res as any,
        (data: any) => `Content item created: "${data.title}" (ID: ${data.id}).`,
      );
    },
  );

  server.registerTool(
    "campaign_update_content",
    {
      title: "Update Content Item",
      description:
        "Update an existing content item using optimistic concurrency (requires expectedVersion).",
      inputSchema: UpdateContentItemInputSchema,
      outputSchema: ContentItemDtoSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await updateContentItem(args, "mcp");
      return toMcpToolResult(
        res as any,
        (data: any) => `Content item updated: "${data.title}" (New Version: ${data.version}).`,
      );
    },
  );

  // -----------------------------------------------------------
  // 32-35. Contacts
  // -----------------------------------------------------------
  server.registerTool(
    "campaign_list_contacts",
    {
      title: "List Contacts",
      description:
        "List registered campaign contacts. Returns public summaries by default; set includePrivateFields to true to retrieve email and notes.",
      inputSchema: ListContactsQuerySchema,
      outputSchema: ListContactsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await listContacts(args);
      return toMcpToolResult(
        res as any,
        (data: any) => `Retrieved ${data.items.length} of ${data.total} contacts.`,
      );
    },
  );

  server.registerTool(
    "campaign_get_contact",
    {
      title: "Get Contact",
      description:
        "Retrieve contact details. Returns summary by default; set includePrivateFields to true to retrieve email and notes.",
      inputSchema: GetContactInputSchema,
      outputSchema: ContactDtoSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await getContactById(args.id, args.includePrivateFields);
      return toMcpToolResult(
        res as any,
        (data: any) => `Retrieved contact "${data.name}" (Status: ${data.status}).`,
      );
    },
  );

  server.registerTool(
    "campaign_create_contact",
    {
      title: "Create Contact",
      description:
        "Register a new campaign contact. Returns contact summary projection.",
      inputSchema: CreateContactInputSchema,
      outputSchema: ContactDtoSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await createContact(args, "mcp");
      return toMcpToolResult(
        res as any,
        (data: any) => `Contact created: "${data.name}" (ID: ${data.id}).`,
      );
    },
  );

  server.registerTool(
    "campaign_update_contact",
    {
      title: "Update Contact",
      description:
        "Update contact details using optimistic concurrency (requires expectedVersion). Returns contact summary projection.",
      inputSchema: UpdateContactInputSchema,
      outputSchema: ContactDtoSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await updateContact(args, "mcp");
      return toMcpToolResult(
        res as any,
        (data: any) => `Contact updated: "${data.name}" (New Version: ${data.version}).`,
      );
    },
  );

  // -----------------------------------------------------------
  // 36-41. Generic Tags & Directed Relationships
  // -----------------------------------------------------------
  server.registerTool(
    "campaign_list_tags",
    {
      title: "List Tags",
      description:
        "List existing normalized tag definitions with optional substring search on name/slug.",
      inputSchema: ListTagsQuerySchema,
      outputSchema: ListTagsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await listTags(args);
      return toMcpToolResult(
        res as any,
        (data: any) => `Retrieved ${data.items.length} of ${data.total} tags.`,
      );
    },
  );

  server.registerTool(
    "campaign_tag_entity",
    {
      title: "Tag Entity",
      description:
        "Attach a tag to any domain entity. Normalizes tag string to slug and creates tag definition if absent. Idempotent on existing attachments.",
      inputSchema: TagEntityInputSchema,
      outputSchema: TagEntityOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await tagEntity(args, "mcp");
      return toMcpToolResult(
        res as any,
        (data: any) =>
          `Tag #${data.tag.slug} ${data.changed ? "attached to" : "already on"} ${data.entity.entityType} ${data.entity.entityId}.`,
      );
    },
  );

  server.registerTool(
    "campaign_untag_entity",
    {
      title: "Untag Entity",
      description:
        "Remove a tag association from a domain entity. Nonexistent tag/membership returns unchanged without error.",
      inputSchema: UntagEntityInputSchema,
      outputSchema: UntagEntityOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await untagEntity(args, "mcp");
      return toMcpToolResult(
        res as any,
        (data: any) =>
          `Tag #${data.tagSlug} ${data.changed ? "detached from" : "was not attached to"} ${data.entity.entityType} ${data.entity.entityId}.`,
      );
    },
  );

  server.registerTool(
    "campaign_get_relationships",
    {
      title: "Get Relationships",
      description:
        "Retrieve incoming, outgoing, or combined directed relationships for any domain entity.",
      inputSchema: GetRelationshipsQuerySchema,
      outputSchema: GetRelationshipsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await getRelationships(args);
      return toMcpToolResult(
        res as any,
        (data: any) => `Retrieved ${data.items.length} of ${data.total} relationships.`,
      );
    },
  );

  server.registerTool(
    "campaign_link_entities",
    {
      title: "Link Entities",
      description:
        "Create a directed typed relationship (RELATES_TO, USES_ASSET, PART_OF) between two entities with optional immutable notes. Idempotent for identical edges.",
      inputSchema: LinkEntitiesInputSchema,
      outputSchema: LinkEntitiesOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await linkEntities(args, "mcp");
      return toMcpToolResult(
        res as any,
        (data: any) =>
          `Linked ${data.relation.from.entityType} -> ${data.relation.to.entityType} (${data.relation.relationType}, changed: ${data.changed}).`,
      );
    },
  );

  server.registerTool(
    "campaign_unlink_entities",
    {
      title: "Unlink Entities",
      description: "Remove an existing directed relationship by relation ID.",
      inputSchema: UnlinkEntitiesInputSchema,
      outputSchema: UnlinkEntitiesOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await unlinkEntities(args, "mcp");
      return toMcpToolResult(
        res as any,
        (data: any) => `Unlinked relation ${data.relationId} (changed: ${data.changed}).`,
      );
    },
  );

  // -----------------------------------------------------------
  // 42. Global Search
  // -----------------------------------------------------------
  server.registerTool(
    "campaign_search",
    {
      title: "Search CampaignOS",
      description:
        "Search across all eight CampaignOS registers (Work Items, Canon, Decisions, Assets, Websites, Content, Contacts, Memories) and tags using literal case-insensitive substring matching.",
      inputSchema: SearchQuerySchema,
      outputSchema: SearchOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await searchCampaign(args);
      return toMcpToolResult(
        res as any,
        (data: any) => `Found ${data.total} search result(s) across CampaignOS.`,
      );
    },
  );

  // -----------------------------------------------------------
  // 43. Activity Feed
  // -----------------------------------------------------------
  server.registerTool(
    "campaign_activity_feed",
    {
      title: "Get Activity Feed",
      description:
        "Retrieve the auditable activity feed of recent changes across work items, canon, decisions, assets, websites, contacts, content, and memories.",
      inputSchema: ListActivityQuerySchema,
      outputSchema: ActivityFeedOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await listActivity(args);
      return toMcpToolResult(
        res as any,
        (data: any) => `Retrieved ${data.items.length} recent activity entries.`,
      );
    },
  );

  // -----------------------------------------------------------
  // 44-51. Persistent CampaignMemory (ADR 0007, brief sections 4/6/7/8/9)
  // -----------------------------------------------------------
  server.registerTool(
    "campaign_remember",
    {
      title: "Remember Memory",
      description:
        "Persist a CampaignOS memory record. Detects duplicate or conflicting inputs via deterministic content hashing and stable-key ownership. Returns CREATED, DUPLICATE, ALREADY_CURRENT, or KEY_CONFLICT along with bounded nextActions. Does not invent or auto-merge authoritative knowledge.",
      inputSchema: RememberMemoryInputSchema,
      outputSchema: RememberMemoryOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await rememberMemory(args, "mcp");
      return toMcpToolResult((res as unknown) as Parameters<typeof toMcpToolResult>[0], (data: any) => {
        switch (data.outcome) {
          case "CREATED":
            return `Memory created: "${data.memory.title}" (ID: ${data.memory.id}).`;
          case "DUPLICATE":
            return `Memory not created: identical content already exists (existing ID: ${data.memory.id}).`;
          case "ALREADY_CURRENT":
            return `Memory unchanged: existing record already has identical content (ID: ${data.memory.id}).`;
          case "KEY_CONFLICT":
            return `Memory not created: key owner has different content (existing ID: ${data.memory.id}). No rows changed.`;
          default:
            return `Memory operation completed with outcome ${data.outcome}.`;
        }
      });
    },
  );

  server.registerTool(
    "campaign_update_memory",
    {
      title: "Update Memory",
      description:
        "Update an ACTIVE memory's metadata, importance, confidence, pin, source label/URL, expiry, or content with optimistic concurrency (requires expectedVersion). Duplicate-content detection still applies.",
      inputSchema: UpdateMemoryInputSchema,
      outputSchema: UpdateMemoryOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await updateMemory(args, "mcp");
      return toMcpToolResult(
        (res as unknown) as Parameters<typeof toMcpToolResult>[0],
        (data: any) =>
          `Memory updated: "${data.memory.title}" (Version: ${data.memory.version}, changed: ${data.changed}).`,
      );
    },
  );

  server.registerTool(
    "campaign_supersede_memory",
    {
      title: "Supersede Memory",
      description:
        "Atomically replace an ACTIVE or ARCHIVED memory with a new ACTIVE memory. Optionally copies predecessor tags and directed relationships to the successor. Predecessor becomes SUPERSEDED and retains full history. Requires expectedVersion on the predecessor.",
      inputSchema: SupersedeMemoryInputSchema,
      outputSchema: SupersedeMemoryOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await supersedeMemory(args, "mcp");
      return toMcpToolResult(
        (res as unknown) as Parameters<typeof toMcpToolResult>[0],
        (data: any) =>
          `Memory superseded: old "${data.supersededMemory.title}" replaced by new "${data.memory.title}" (Predecessor now SUPERSEDED).`,
      );
    },
  );

  server.registerTool(
    "campaign_archive_memory",
    {
      title: "Archive Memory",
      description:
        "Mark an ACTIVE memory as ARCHIVED with optimistic concurrency. Historical record remains stored and searchable; excluded from normal recall. Does not hard-delete.",
      inputSchema: ArchiveMemoryInputSchema,
      outputSchema: UpdateMemoryOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await archiveMemory(args, "mcp");
      return toMcpToolResult(
        (res as unknown) as Parameters<typeof toMcpToolResult>[0],
        (data: any) =>
          `Memory archived: "${data.memory.title}" (changed: ${data.changed}).`,
      );
    },
  );

  server.registerTool(
    "campaign_get_memory",
    {
      title: "Get Memory",
      description:
        "Retrieve full details of a single memory by ID or stable key, including its tags, directed relationships, predecessor, successor, and bounded content/pagination. Tracking accessCount/lastAccessedAt is on by default; set trackAccess false to read for editing without bumping counters.",
      inputSchema: GetMemoryInputSchema,
      outputSchema: MemoryDetailDtoSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await getMemory(args);
      return toMcpToolResult(
        (res as unknown) as Parameters<typeof toMcpToolResult>[0],
        (data: any) =>
          `Retrieved memory "${data.memory.title}" (Status: ${data.memory.status}, Version: ${data.memory.version}).`,
      );
    },
  );

  server.registerTool(
    "campaign_list_memories",
    {
      title: "List Memories",
      description:
        "List memories with filters (search, category, status, pinned, single tag, min importance, expiry) and bounded pagination. Sort by recently updated, importance, recently accessed, oldest, or relevance (requires non-empty search).",
      inputSchema: ListMemoriesQuerySchema,
      outputSchema: ListMemoriesOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await listMemories(args);
      return toMcpToolResult(
        (res as unknown) as Parameters<typeof toMcpToolResult>[0],
        (data: any) => `Retrieved ${data.items.length} of ${data.total} memories.`,
      );
    },
  );

  server.registerTool(
    "campaign_recall",
    {
      title: "Recall Memories",
      description:
        "Deterministic rank-based recall suitable for agent prompts at the start of substantial work. Combines exact-key, title, content, tag, and entity-context signals with bounded ambient pinned rows; returns relevanceScore and explicit relevanceReasons.",
      inputSchema: RecallMemoriesInputSchema,
      outputSchema: RecallOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await recallMemories(args);
      return toMcpToolResult(
        (res as unknown) as Parameters<typeof toMcpToolResult>[0],
        (data: any) => `Recalled ${data.items.length} of ${data.limit} requested memories.`,
      );
    },
  );

  server.registerTool(
    "campaign_get_context",
    {
      title: "Get Compact Context Pack",
      description:
        "Read-only bootstrap that returns a compact context pack (Canon, current Decisions, relevant Memories, unfinished Work Items, non-superseded Assets, deterministic authority warnings) for a task string. Memory never replaces Canon.",
      inputSchema: GetContextInputSchema,
      outputSchema: CampaignContextOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const res = await getCampaignContext(args);
      return toMcpToolResult(
        (res as unknown) as Parameters<typeof toMcpToolResult>[0],
        (data: any) =>
          `Compiled context: ${data.canon.length} canon, ${data.recentDecisions.length} decisions, ${data.memories.length} memories, ${data.relatedWorkItems.length} work items, ${data.relatedAssets.length} assets, ${data.authorityWarnings.length} authority review notices.`,
      );
    },
  );
}
