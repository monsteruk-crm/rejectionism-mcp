import "./lib/environment.mjs";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { z } from "zod";
import { EXPECTED_MCP_TOOLS } from "./lib/mcp-contract.mjs";

const args = process.argv.slice(2).filter((arg) => arg !== "--");

const origin =
  args.find((a) => a.startsWith("http://") || a.startsWith("https://")) || "http://localhost:3000";

const pathArg = args.find((a) => a.startsWith("--path="));
const endpointPath = pathArg ? pathArg.split("=")[1] : "/api/mcp";
const allowWrites = args.includes("--test-writes");
const disposableDatabase = args.includes("--disposable-database");

const campaignPassword = process.env.CAMPAIGNOS_PASSWORD;
if (typeof campaignPassword !== "string" || campaignPassword.length === 0) {
  console.error("CAMPAIGNOS_PASSWORD must be set in the environment for the smoke client.");
  process.exit(1);
}

const textContentSchema = z
  .array(z.object({ type: z.literal("text"), text: z.string().min(1) }).passthrough())
  .min(1);

const paginationSchema = {
  total: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
};

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
      ...paginationSchema,
    })
    .passthrough(),
  campaign_get_canon: z.discriminatedUnion("mode", [
    z
      .object({
        mode: z.literal("single"),
        entry: z.object({ key: z.string() }).passthrough(),
      })
      .passthrough(),
    z
      .object({
        mode: z.literal("collection"),
        items: z.array(z.unknown()),
        ...paginationSchema,
      })
      .passthrough(),
  ]),
  campaign_list_decisions: z
    .object({
      items: z.array(z.object({ id: z.string() }).passthrough()),
      ...paginationSchema,
    })
    .passthrough(),
  campaign_list_assets: z
    .object({
      items: z.array(z.object({ id: z.string() }).passthrough()),
      ...paginationSchema,
    })
    .passthrough(),
  campaign_list_upload_links: z
    .object({
      items: z.array(z.object({ id: z.string() }).passthrough()),
      ...paginationSchema,
    })
    .passthrough(),
  campaign_list_websites: z
    .object({
      items: z.array(z.object({ id: z.string() }).passthrough()),
      ...paginationSchema,
    })
    .passthrough(),
  campaign_list_content: z
    .object({
      items: z.array(z.object({ id: z.string() }).passthrough()),
      ...paginationSchema,
    })
    .passthrough(),
  campaign_list_contacts: z
    .object({
      items: z.array(z.object({ id: z.string() }).passthrough()),
      ...paginationSchema,
    })
    .passthrough(),
  campaign_list_tags: z
    .object({
      items: z.array(z.object({ id: z.string(), slug: z.string() }).passthrough()),
      ...paginationSchema,
    })
    .passthrough(),
  campaign_search: z
    .object({
      items: z.array(z.object({ id: z.string(), entityType: z.string() }).passthrough()),
      ...paginationSchema,
    })
    .passthrough(),
  campaign_activity_feed: z
    .object({
      items: z.array(z.record(z.string(), z.unknown())),
      total: z.number().int().nonnegative(),
      limit: z.number().int().nonnegative(),
      offset: z.number().int().nonnegative(),
    })
    .passthrough(),
};

function validateToolResult(toolName, result) {
  if (result.isError) {
    throw new Error(`${toolName} returned an error: ${JSON.stringify(result.content)}`);
  }

  textContentSchema.parse(result.content);
  if (requiredResultSchemas[toolName]) {
    requiredResultSchemas[toolName].parse(result.structuredContent);
  }
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

  const failures = [];

  try {
    console.log(`\n1. Connecting to ${endpoint.toString()}...`);
    await client.connect(transport);
    console.log("   Connected successfully.");

    console.log("\n2. Listing and validating available tools...");
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name).sort();
    const expectedSorted = [...EXPECTED_MCP_TOOLS].sort();

    console.log(`   Registered tools (${toolNames.length}):`, toolNames.join(", "));

    if (toolNames.length !== expectedSorted.length) {
      failures.push(`Expected exactly ${expectedSorted.length} tools, but found ${toolNames.length}`);
    }

    for (const expected of expectedSorted) {
      if (!toolNames.includes(expected)) {
        failures.push(`Required MCP tool '${expected}' is missing from endpoint.`);
      }
    }

    const readChecks = [
      { name: "echo", args: { message: "Smoke test ping" } },
      { name: "check_database", args: {} },
      { name: "campaign_get_status", args: {} },
      { name: "campaign_list_work_items", args: { limit: 5 } },
      { name: "campaign_get_canon", args: { limit: 5 } },
      { name: "campaign_list_decisions", args: { limit: 5 } },
      { name: "campaign_list_assets", args: { limit: 5 } },
      { name: "campaign_list_upload_links", args: { limit: 5 } },
      { name: "campaign_list_websites", args: { limit: 5 } },
      { name: "campaign_list_content", args: { limit: 5 } },
      { name: "campaign_list_contacts", args: { limit: 5 } },
      { name: "campaign_list_tags", args: { limit: 5 } },
      { name: "campaign_search", args: { query: "rejection", limit: 3 } },
      { name: "campaign_activity_feed", args: { limit: 5 } },
    ];

    console.log(`\n3. Executing read family checks (${readChecks.length} families)...`);
    for (const check of readChecks) {
      try {
        const res = await client.callTool({
          name: check.name,
          arguments: check.args,
        });
        validateToolResult(check.name, res);
        console.log(`   ✓ ${check.name} passed:`, res.content?.[0]?.text?.slice(0, 80));
      } catch (err) {
        console.error(`   ✗ ${check.name} failed:`, err.message || err);
        failures.push(`${check.name}: ${err.message || String(err)}`);
      }
    }

    if (allowWrites) {
      console.log("\n4. Testing write operation 'campaign_create_work_item'...");
      try {
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
        console.log("   ✓ Write operation passed:", createResult.content?.[0]?.text);
      } catch (err) {
        failures.push(`Write operation: ${err.message || String(err)}`);
      }
    }

    if (failures.length > 0) {
      console.error(`\nSmoke test finished with ${failures.length} failure(s):`);
      for (const f of failures) {
        console.error(` - ${f}`);
      }
      process.exitCode = 1;
    } else {
      console.log("\nAll smoke test assertions completed successfully.");
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("\nSmoke test failed with error:", error.message || error);
  process.exitCode = 1;
});
