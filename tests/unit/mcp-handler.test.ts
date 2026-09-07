import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/server";
import { registerBootstrapTools } from "../../lib/mcp/bootstrap-tools";
import { registerCampaignTools } from "../../lib/mcp/campaign-tools";
import {
  EXPECTED_MCP_TOOLS,
  CANONICAL_SERVER_INFO,
  CANONICAL_INSTRUCTIONS,
} from "../../scripts/lib/mcp-contract.mjs";

vi.mock("server-only", () => ({}));

describe("lib/mcp/handler.ts & MCP Tool Registration", () => {
  it("registers exactly 47 unique CampaignOS tools matching the contract fixture", () => {
    const server = new McpServer(CANONICAL_SERVER_INFO, {
      instructions: CANONICAL_INSTRUCTIONS,
    });

    registerBootstrapTools(server);
    registerCampaignTools(server);

    // Access registered tools from private/internal server structure
    const registeredTools = Object.keys((server as any)._registeredTools || {});

    expect(registeredTools).toHaveLength(47);
    expect(new Set(registeredTools).size).toBe(47);

    const sortedRegistered = [...registeredTools].sort();
    const sortedExpected = [...EXPECTED_MCP_TOOLS].sort();

    expect(sortedRegistered).toEqual(sortedExpected);
  });

  it("echo and check_database have correct annotations", () => {
    const server = new McpServer(CANONICAL_SERVER_INFO);
    registerBootstrapTools(server);

    const registered = (server as any)._registeredTools;
    expect(registered["echo"]).toBeDefined();
    expect(registered["check_database"]).toBeDefined();
    expect(registered["echo"].annotations.readOnlyHint).toBe(true);
    expect(registered["echo"].annotations.openWorldHint).toBe(false);
    expect(registered["check_database"].annotations.openWorldHint).toBe(true);
  });
});
