import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";

const args = process.argv.slice(2).filter((arg) => arg !== "--");

const origin =
  args.find((a) => a.startsWith("http://") || a.startsWith("https://")) ||
  "http://localhost:3000";

const pathArg = args.find((a) => a.startsWith("--path="));
const endpointPath = pathArg ? pathArg.split("=")[1] : "/api/mcp";
const allowWrites = args.includes("--test-writes");

async function main() {
  console.log(`=== Rejectionism CampaignOS MCP Smoke Test ===`);
  console.log(`Target origin:   ${origin}`);
  console.log(`Endpoint path:   ${endpointPath}`);
  console.log(`Test write ops:  ${allowWrites ? "ENABLED" : "DISABLED (read-only mode)"}`);

  const client = new Client({
    name: "rejectionism-mcp-smoke-client",
    version: "1.0.0",
  });

  const endpoint = new URL(endpointPath, `${origin}/`);
  const transport = new StreamableHTTPClientTransport(endpoint);

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
      "campaign_create_work_item",
      "campaign_update_work_item",
      "campaign_get_canon",
      "campaign_record_decision",
      "campaign_list_assets",
      "campaign_register_asset",
      "campaign_list_websites",
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
    if (echoResult.isError) {
      throw new Error(`'echo' tool returned an error: ${JSON.stringify(echoResult)}`);
    }
    console.log("   Echo passed:", echoResult.content?.[0]?.text);

    console.log("\n4. Testing 'check_database' tool...");
    const dbResult = await client.callTool({
      name: "check_database",
      arguments: {},
    });
    if (dbResult.isError) {
      console.warn("   Database check failed (database may be unreachable or unconfigured):", dbResult.content?.[0]?.text);
    } else {
      console.log("   Database check passed:", dbResult.content?.[0]?.text);
    }

    console.log("\n5. Testing 'campaign_get_status' tool...");
    const statusResult = await client.callTool({
      name: "campaign_get_status",
      arguments: {},
    });
    if (statusResult.isError) {
      console.warn("   campaign_get_status returned error (test mode may be disabled or DB unreachable):", statusResult.content?.[0]?.text);
    } else {
      console.log("   campaign_get_status passed:", statusResult.content?.[0]?.text);
    }

    console.log("\n6. Testing 'campaign_list_work_items' tool...");
    const workResult = await client.callTool({
      name: "campaign_list_work_items",
      arguments: { limit: 5 },
    });
    if (workResult.isError) {
      console.warn("   campaign_list_work_items returned error:", workResult.content?.[0]?.text);
    } else {
      console.log("   campaign_list_work_items passed:", workResult.content?.[0]?.text);
    }

    console.log("\n7. Testing 'campaign_get_canon' tool...");
    const canonResult = await client.callTool({
      name: "campaign_get_canon",
      arguments: { key: "movement.name" },
    });
    if (canonResult.isError) {
      console.warn("   campaign_get_canon returned error:", canonResult.content?.[0]?.text);
    } else {
      console.log("   campaign_get_canon passed:", canonResult.content?.[0]?.text);
    }

    if (allowWrites) {
      console.log("\n8. Testing write operation 'campaign_create_work_item'...");
      const createResult = await client.callTool({
        name: "campaign_create_work_item",
        arguments: {
          title: "Temporary Smoke Test Item",
          description: "Created by smoke test script to verify write flow.",
          status: "BACKLOG",
          priority: 5,
        },
      });

      if (createResult.isError) {
        throw new Error(`Write operation failed: ${createResult.content?.[0]?.text}`);
      }
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
