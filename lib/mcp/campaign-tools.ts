import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  getCampaignStatus,
  listWorkItems,
  createWorkItem,
  updateWorkItem,
  getCanon,
  recordDecision,
  listAssets,
  registerAsset,
  listWebsites,
  listActivity,
  CreateWorkItemInputSchema,
  UpdateWorkItemInputSchema,
  ListWorkItemsQuerySchema,
  GetCanonQuerySchema,
  RecordDecisionInputSchema,
  ListAssetsQuerySchema,
  RegisterAssetInputSchema,
  ListWebsitesQuerySchema,
  ListActivityQuerySchema,
} from "@/lib/campaign";
import { toMcpToolResult } from "./tool-result";

export function registerCampaignTools(server: McpServer) {
  // 1. campaign_get_status
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

  // 2. campaign_list_work_items
  server.registerTool(
    "campaign_list_work_items",
    {
      title: "List Work Items",
      description:
        "List and filter work items by status, minimum priority, due date, or text search in title/description.",
      inputSchema: ListWorkItemsQuerySchema,
      outputSchema: z.record(z.string(), z.unknown()),
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

  // 3. campaign_create_work_item
  server.registerTool(
    "campaign_create_work_item",
    {
      title: "Create Work Item",
      description:
        "Create a new campaign work item. Note: moving to or creating in DONE status requires an evidenceUrl or a completionNote. Creating in BLOCKED status requires a blockedReason.",
      inputSchema: CreateWorkItemInputSchema,
      outputSchema: z.record(z.string(), z.unknown()),
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

  // 4. campaign_update_work_item
  server.registerTool(
    "campaign_update_work_item",
    {
      title: "Update Work Item",
      description:
        "Update an existing work item with optimistic concurrency control. You must provide expectedVersion. Enforces evidence requirement when moving to DONE status.",
      inputSchema: UpdateWorkItemInputSchema,
      outputSchema: z.record(z.string(), z.unknown()),
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
        (data: any) => `Work item updated: "${data.title}" (ID: ${data.id}, New Version: ${data.version}, Status: ${data.status}).`,
      );
    },
  );

  // 5. campaign_get_canon
  server.registerTool(
    "campaign_get_canon",
    {
      title: "Get Canon Entries",
      description:
        "Retrieve authoritative campaign facts, slogans, roles, and papal names. Query a specific unique key, a category, or list all entries.",
      inputSchema: GetCanonQuerySchema,
      outputSchema: z.record(z.string(), z.unknown()),
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

  // 6. campaign_record_decision
  server.registerTool(
    "campaign_record_decision",
    {
      title: "Record Decision",
      description:
        "Record an authoritative architectural, strategic, or campaign decision. Optionally supersede a previous decision (retaining full history) and optionally create or update an associated canon entry in the same atomic transaction.",
      inputSchema: RecordDecisionInputSchema,
      outputSchema: z.record(z.string(), z.unknown()),
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

  // 7. campaign_list_assets
  server.registerTool(
    "campaign_list_assets",
    {
      title: "List Assets",
      description:
        "List and filter registered visual assets by workflow status (MISSING, DRAFT, NEEDS_WORK, APPROVED, SUPERSEDED) or kind.",
      inputSchema: ListAssetsQuerySchema,
      outputSchema: z.record(z.string(), z.unknown()),
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

  // 8. campaign_register_asset
  server.registerTool(
    "campaign_register_asset",
    {
      title: "Register or Update Asset",
      description:
        "Register a new asset metadata record or update an existing asset using optimistic concurrency (requires expectedVersion). Does not upload binary files.",
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
        (data: any) => `Asset registered/updated: "${data.name}" (ID: ${data.id}, Version: ${data.version}, Status: ${data.status}).`,
      );
    },
  );

  // 9. campaign_list_websites
  server.registerTool(
    "campaign_list_websites",
    {
      title: "List Websites",
      description:
        "List all registered campaign domains, their intended roles, known status, repositories, and outstanding deployment gaps.",
      inputSchema: ListWebsitesQuerySchema,
      outputSchema: z.record(z.string(), z.unknown()),
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

  // 10. campaign_activity_feed
  server.registerTool(
    "campaign_activity_feed",
    {
      title: "Get Activity Feed",
      description:
        "Retrieve the auditable activity feed of recent changes across work items, canon, decisions, assets, websites, contacts, and content.",
      inputSchema: ListActivityQuerySchema,
      outputSchema: z.record(z.string(), z.unknown()),
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
}
