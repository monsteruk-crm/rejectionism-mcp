import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { z } from "zod";

const args = process.argv.slice(2).filter((arg) => arg !== "--");

const origin =
  args.find((a) => a.startsWith("http://") || a.startsWith("https://")) || "http://localhost:3000";

const pathArg = args.find((a) => a.startsWith("--path="));
const endpointPath = pathArg ? pathArg.split("=")[1] : "/api/mcp";
const allowWrites = args.includes("--test-writes");
const disposableDatabase = args.includes("--disposable-database");

// The credential is read from the environment only. It is never accepted as a
// command-line value, and request headers are never printed.
const campaignPassword = process.env.CAMPAIGNOS_PASSWORD;
if (typeof campaignPassword !== "string" || campaignPassword.length === 0) {
  console.error("CAMPAIGNOS_PASSWORD must be set in the environment for the smoke client.");
  process.exit(1);
}

const textContentSchema = z
  .array(z.object({ type: z.literal("text"), text: z.string().min(1) }).passthrough())
  .min(1);

const requiredResultSchemas = {
  echo: z.object({ message: z.literal("Smoke test ping") }).strict(),
  check_database: z
    .object({
      status: z.literal("ok"),
      result: z.literal(1),
      latencyMs: z.number().int().nonnegative(),
    })
    .strict(),
  campaign_get_status: z.object({ workItemCounts: z.record(z.string(), z.number()) }).passthrough(),
  campaign_list_work_items: z
    .object({
      items: z.array(z.object({ id: z.string() }).passthrough()),
      total: z.number().int().nonnegative(),
    })
    .passthrough(),
  campaign_get_canon: z.discriminatedUnion("mode", [
    z
      .object({
        mode: z.literal("single"),
        entry: z.object({ key: z.literal("movement.name") }).passthrough(),
      })
      .passthrough(),
    z.object({ mode: z.literal("collection"), items: z.array(z.unknown()) }).passthrough(),
  ]),
};

function assertSuccessfulResult(toolName, result) {
  if (result.isError) {
    throw new Error(`${toolName} returned an error: ${JSON.stringify(result.content)}`);
  }

  textContentSchema.parse(result.content);
  requiredResultSchemas[toolName].parse(result.structuredContent);
}

async function main() {
  console.log(`=== Rejectionism CampaignOS MCP Smoke Test ===`);
  console.log(`Target origin:   ${origin}`);
  console.log(`Endpoint path:   ${endpointPath}`);
  console.log(`Test write ops:  ${allowWrites ? "ENABLED" : "DISABLED (read-only mode)"}`);

  if (allowWrites && !disposableDatabase) {
    throw new Error(
      "--test-writes requires --disposable-database so smoke records cannot pollute persistent data.",
    );
  }

  const client = new Client({
    name: "rejectionism-mcp-smoke-client",
    version: "1.0.0",
  });

  const endpoint = new URL(endpointPath, `${origin}/`);
  const transport = new StreamableHTTPClientTransport(endpoint, {
    requestInit: {
      headers: {
        Authorization: `Bearer ${campaignPassword}`,
      },
    },
  });

  try {
    console.log(`\n1. Connecting to ${endpoint.toString()}...`);
    await client.connect(transport);
    console.log("   Connected successfully.");

    console.log("\n2. Listing available tools...");
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);
    console.log(`   Registered tools (${toolNames.length}):`, toolNames.join(", "));

    // Verify bootstrap tools
    if (!toolNames.includes("echo")) {
      throw new Error("Required tool 'echo' is missing.");
    }
    if (!toolNames.includes("check_database")) {
      throw new Error("Required tool 'check_database' is missing.");
    }

    // Verify campaign tools
    const expectedCampaignTools = [
      "campaign_get_status",
      "campaign_list_work_items",
      "campaign_get_work_item",
      "campaign_create_work_item",
      "campaign_update_work_item",
      "campaign_get_canon",
      "campaign_create_canon",
      "campaign_update_canon",
      "campaign_list_decisions",
      "campaign_get_decision",
      "campaign_record_decision",
      "campaign_list_assets",
      "campaign_get_asset",
      "campaign_create_asset",
      "campaign_update_asset",
      "campaign_add_external_asset",
      "campaign_create_asset_revision",
      "campaign_add_asset_representation",
      "campaign_set_primary_asset_representation",
      "campaign_register_asset",
      "campaign_create_upload_link",
      "campaign_list_upload_links",
      "campaign_get_upload_link",
      "campaign_revoke_upload_link",
      "campaign_regenerate_upload_link",
      "campaign_list_websites",
      "campaign_get_website",
      "campaign_create_website",
      "campaign_update_website",
      "campaign_list_content",
      "campaign_get_content",
      "campaign_create_content",
      "campaign_update_content",
      "campaign_list_contacts",
      "campaign_get_contact",
      "campaign_create_contact",
      "campaign_update_contact",
      "campaign_list_tags",
      "campaign_tag_entity",
      "campaign_untag_entity",
      "campaign_get_relationships",
      "campaign_link_entities",
      "campaign_unlink_entities",
      "campaign_activity_feed",
    ];

    for (const toolName of expectedCampaignTools) {
      if (!toolNames.includes(toolName)) {
        throw new Error(`Required CampaignOS tool '${toolName}' is missing.`);
      }
    }

    console.log("\n3. Testing 'echo' tool...");
    const echoResult = await client.callTool({
      name: "echo",
      arguments: { message: "Smoke test ping" },
    });
    assertSuccessfulResult("echo", echoResult);
    console.log("   Echo passed:", echoResult.content?.[0]?.text);

    console.log("\n4. Testing 'check_database' tool...");
    const dbResult = await client.callTool({
      name: "check_database",
      arguments: {},
    });
    assertSuccessfulResult("check_database", dbResult);
    console.log("   Database check passed:", dbResult.content?.[0]?.text);

    console.log("\n5. Testing 'campaign_get_status' tool...");
    const statusResult = await client.callTool({
      name: "campaign_get_status",
      arguments: {},
    });
    assertSuccessfulResult("campaign_get_status", statusResult);
    console.log("   campaign_get_status passed:", statusResult.content?.[0]?.text);

    console.log("\n6. Testing 'campaign_list_work_items' tool...");
    const workResult = await client.callTool({
      name: "campaign_list_work_items",
      arguments: { limit: 5 },
    });
    assertSuccessfulResult("campaign_list_work_items", workResult);
    console.log("   campaign_list_work_items passed:", workResult.content?.[0]?.text);

    console.log("\n7. Testing 'campaign_get_canon' tool...");
    const canonResult = await client.callTool({
      name: "campaign_get_canon",
      arguments: { key: "movement.name" },
    });
    assertSuccessfulResult("campaign_get_canon", canonResult);
    console.log("   campaign_get_canon passed:", canonResult.content?.[0]?.text);

    if (allowWrites) {
      console.log("\n8. Testing write operation 'campaign_create_work_item'...");
      const createResult = await client.callTool({
        name: "campaign_create_work_item",
        arguments: {
          id: `smoke-${crypto.randomUUID()}`,
          title: "Temporary Smoke Test Item",
          description: "Created by smoke test script to verify write flow.",
          status: "BACKLOG",
          priority: 5,
        },
      });

      if (createResult.isError) {
        throw new Error(`Write operation failed: ${createResult.content?.[0]?.text}`);
      }
      textContentSchema.parse(createResult.content);
      z.object({ id: z.string(), version: z.literal(1) })
        .passthrough()
        .parse(createResult.structuredContent);
      console.log("   Write operation passed:", createResult.content?.[0]?.text);
    }

    console.log("\nAll smoke test assertions completed successfully.");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("\nSmoke test failed with error:", error.message || error);
  process.exitCode = 1;
});
