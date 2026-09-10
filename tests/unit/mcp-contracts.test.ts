import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/server";
import { registerBootstrapTools } from "@/lib/mcp/bootstrap-tools";
import { registerCampaignTools } from "@/lib/mcp/campaign-tools";
import { EXPECTED_MCP_TOOLS } from "../../scripts/lib/mcp-contract.mjs";

// Mock server-only modules
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));

describe("MCP Tool Contracts (CampaignOS Tools)", () => {
  it("registers exactly the expected tools from the contract fixture", () => {
    const server = new McpServer({ name: "test-server", version: "1.0.0" });
    registerBootstrapTools(server);
    registerCampaignTools(server);

    const registeredTools = Object.keys((server as any)._registeredTools || {});
    expect(registeredTools.length).toBe(EXPECTED_MCP_TOOLS.length);
    expect(new Set(registeredTools).size).toBe(EXPECTED_MCP_TOOLS.length);
    expect(registeredTools.sort()).toEqual([...EXPECTED_MCP_TOOLS].sort());
  });

  it("includes all 8 CampaignMemory tools in the registered inventory", () => {
    const server = new McpServer({ name: "test-server", version: "1.0.0" });
    registerBootstrapTools(server);
    registerCampaignTools(server);

    const registeredTools = Object.keys((server as any)._registeredTools || {});
    const MEMORY_TOOLS = [
      "campaign_remember",
      "campaign_update_memory",
      "campaign_supersede_memory",
      "campaign_archive_memory",
      "campaign_get_memory",
      "campaign_list_memories",
      "campaign_recall",
      "campaign_get_context",
    ];
    for (const tool of MEMORY_TOOLS) {
      expect(registeredTools).toContain(tool);
    }
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

    for (const toolName of EXPECTED_MCP_TOOLS) {
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

    // campaign_remember (non-read-only, non-destructive, idempotent)
    expect(tools.campaign_remember.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    });

    // campaign_get_context (read-only, non-destructive, idempotent)
    expect(tools.campaign_get_context.annotations).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    });
  });
});
