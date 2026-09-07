import "./lib/environment.mjs";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const args = process.argv.slice(2);
let stagingOrigin = process.env.CAMPAIGNOS_STAGING_BASE_URL;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith("--origin=")) {
    stagingOrigin = arg.slice("--origin=".length);
  } else if (arg === "--origin" && i + 1 < args.length) {
    stagingOrigin = args[i + 1];
  } else if (!arg.startsWith("-")) {
    stagingOrigin = arg;
  }
}

const stagingPassword = process.env.CAMPAIGNOS_STAGING_PASSWORD || process.env.CAMPAIGNOS_PASSWORD;

async function main() {
  console.log("=== CampaignOS Staging Verification Gate ===");

  if (!stagingOrigin) {
    console.log("BLOCKED: CAMPAIGNOS_STAGING_BASE_URL is not configured.");
    console.log("Staging verification requires explicit staging environment credentials and authority.");
    // Exit 0 as documented when staging is not configured / blocked without failing build
    process.exit(0);
  }

  if (!stagingPassword) {
    console.log("BLOCKED: CAMPAIGNOS_STAGING_PASSWORD is not configured.");
    process.exit(0);
  }

  console.log(`Target: ${stagingOrigin}`);
  const endpoint = new URL("/api/mcp", stagingOrigin);
  const client = new Client({ name: "staging-verifier", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(endpoint, {
    requestInit: { headers: { Authorization: `Bearer ${stagingPassword}` } },
  });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    console.log(`Staging connected: ${tools.length} tools registered.`);
    const statusRes = await client.callTool({ name: "campaign_get_status", arguments: {} });
    if (statusRes.isError) {
      throw new Error(`Status check failed: ${JSON.stringify(statusRes.content)}`);
    }
    console.log("Staging read check passed.");
  } catch (err) {
    console.error("Staging check failed:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
