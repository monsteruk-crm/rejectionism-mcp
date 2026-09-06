import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/server";
import { registerBootstrapTools } from "@/lib/mcp/bootstrap-tools";
import { registerCampaignTools } from "@/lib/mcp/campaign-tools";

// Mock server-only modules
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));

describe("MCP Tool Contracts (Phase 9 Parity - 47 Tools)", () => {
  const EXPECTED_47_TOOLS = [
    // Diagnostics (2)
    "echo",
    "check_database",

    // Status & Overview (1)
    "campaign_get_status",

    // Work Items (4)
    "campaign_list_work_items",
    "campaign_get_work_item",
    "campaign_create_work_item",
    "campaign_update_work_item",

    // Canon (3)
    "campaign_get_canon",
    "campaign_create_canon",
    "campaign_update_canon",

    // Decisions (3)
    "campaign_list_decisions",
    "campaign_get_decision",
    "campaign_record_decision",

    // Visual Assets (8)
    "campaign_list_assets",
    "campaign_get_asset",
    "campaign_create_asset",
    "campaign_update_asset",
    "campaign_add_external_asset",
    "campaign_create_asset_revision",
    "campaign_add_asset_representation",
    "campaign_set_primary_asset_representation",

    // Legacy Asset Compatibility (1)
    "campaign_register_asset",

    // Upload Links (5)
    "campaign_create_upload_link",
    "campaign_list_upload_links",
    "campaign_get_upload_link",
    "campaign_revoke_upload_link",
    "campaign_regenerate_upload_link",

    // Websites (4)
    "campaign_list_websites",
    "campaign_get_website",
    "campaign_create_website",
    "campaign_update_website",

    // Content Items (4)
    "campaign_list_content",
    "campaign_get_content",
    "campaign_create_content",
    "campaign_update_content",

    // Contacts (4)
    "campaign_list_contacts",
    "campaign_get_contact",
    "campaign_create_contact",
    "campaign_update_contact",

    // Tags & Relations (6)
    "campaign_list_tags",
    "campaign_tag_entity",
    "campaign_untag_entity",
    "campaign_get_relationships",
    "campaign_link_entities",
    "campaign_unlink_entities",

    // Global Search (1)
    "campaign_search",

    // Activity Feed (1)
    "campaign_activity_feed",
  ];

  it("registers exactly 47 tools in Phase 9", () => {
    const server = new McpServer({ name: "test-server", version: "1.0.0" });
    registerBootstrapTools(server);
    registerCampaignTools(server);

    const registeredTools = Object.keys((server as any)._registeredTools || {});
    expect(registeredTools.length).toBe(47);
    expect(registeredTools.sort()).toEqual([...EXPECTED_47_TOOLS].sort());
  });

  it("ensures every tool has valid annotations and descriptions", () => {
    const server = new McpServer({ name: "test-server", version: "1.0.0" });
    registerBootstrapTools(server);
    registerCampaignTools(server);

    const toolsRecord = (server as any)._registeredTools as Record<
      string,
      {
        title?: string;
        description?: string;
        inputSchema?: any;
        outputSchema?: any;
        annotations?: {
          readOnlyHint?: boolean;
          destructiveHint?: boolean;
          idempotentHint?: boolean;
          openWorldHint?: boolean;
        };
      }
    >;

    for (const toolName of EXPECTED_47_TOOLS) {
      const tool = toolsRecord[toolName];
      expect(tool, `Tool ${toolName} should be registered`).toBeDefined();
      expect(tool.title, `Tool ${toolName} should have a title`).toBeDefined();
      expect(tool.description, `Tool ${toolName} should have a description`).toBeDefined();
      expect(tool.inputSchema, `Tool ${toolName} should have an input schema`).toBeDefined();
      expect(tool.outputSchema, `Tool ${toolName} should have an output schema`).toBeDefined();
      expect(tool.annotations, `Tool ${toolName} should have annotations`).toBeDefined();
      expect(typeof tool.annotations?.readOnlyHint).toBe("boolean");
      expect(typeof tool.annotations?.destructiveHint).toBe("boolean");
      expect(typeof tool.annotations?.idempotentHint).toBe("boolean");
      expect(typeof tool.annotations?.openWorldHint).toBe("boolean");
    }
  });

  it("validates specific tool annotations per Section 4 contract", () => {
    const server = new McpServer({ name: "test-server", version: "1.0.0" });
    registerBootstrapTools(server);
    registerCampaignTools(server);

    const tools = (server as any)._registeredTools;

    // echo
    expect(tools.echo.annotations).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });

    // campaign_revoke_upload_link (destructive write, idempotent)
    expect(tools.campaign_revoke_upload_link.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    });

    // campaign_regenerate_upload_link (destructive write, non-idempotent)
    expect(tools.campaign_regenerate_upload_link.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    });

    // campaign_tag_entity (idempotent write)
    expect(tools.campaign_tag_entity.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    });

    // campaign_untag_entity (destructive write, idempotent)
    expect(tools.campaign_untag_entity.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    });
  });
});
