import "./lib/environment.mjs";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { EXPECTED_MCP_TOOLS } from "./lib/mcp-contract.mjs";

const args = process.argv.slice(2);
let origin = "http://localhost:3000";

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith("--origin=")) {
    origin = arg.slice("--origin=".length);
  } else if (arg === "--origin" && i + 1 < args.length) {
    origin = args[i + 1];
  }
}

const password = process.env.CAMPAIGNOS_PASSWORD;
if (!password) {
  console.error("CAMPAIGNOS_PASSWORD is required in environment for test:mcp.");
  process.exit(1);
}

async function testEndpoint(endpointPath) {
  console.log(`\nTesting MCP Endpoint: ${endpointPath}...`);
  const endpoint = new URL(endpointPath, origin);
  const client = new Client({ name: "mcp-protocol-runner", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(endpoint, {
    requestInit: {
      headers: { Authorization: `Bearer ${password}` },
    },
  });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name).sort();
    const expectedSorted = [...EXPECTED_MCP_TOOLS].sort();

    if (toolNames.length !== expectedSorted.length) {
      throw new Error(
        `Tool count mismatch on ${endpointPath}: expected ${expectedSorted.length}, got ${toolNames.length}`,
      );
    }

    for (const name of expectedSorted) {
      if (!toolNames.includes(name)) {
        throw new Error(`Tool '${name}' missing from ${endpointPath}`);
      }
    }

    // Ping echo
    const echoRes = await client.callTool({ name: "echo", arguments: { message: "Ping" } });
    if (echoRes.isError) throw new Error(`echo failed: ${JSON.stringify(echoRes.content)}`);

    console.log(`✓ ${endpointPath} passed tool parity and basic transport verification.`);
  } finally {
    await client.close();
  }
}

async function main() {
  console.log(`=== CampaignOS MCP Protocol Verification Suite ===`);
  console.log(`Target: ${origin}`);

  try {
    await testEndpoint("/api/mcp");
    await testEndpoint("/mcp");
    console.log("\nAll MCP protocol tests passed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("\nMCP protocol test suite failed:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
