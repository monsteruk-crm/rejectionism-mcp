import "./lib/environment.mjs";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2).filter((a) => a !== "--");
let origin = "http://localhost:3000";

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith("http://") || arg.startsWith("https://")) {
    origin = arg;
  } else if (arg.startsWith("--origin=")) {
    origin = arg.slice("--origin=".length);
  } else if (arg === "--origin" && i + 1 < args.length) {
    origin = args[i + 1];
  }
}

function runStep(title, command, cmdArgs) {
  console.log(`\n======================================================`);
  console.log(`STEP: ${title}`);
  console.log(`======================================================`);

  const result = spawnSync(command, cmdArgs, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  if (result.status !== 0) {
    console.error(`\nStep '${title}' failed with exit code ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

async function main() {
  console.log("=== Rejectionism CampaignOS Functional Verification Gate ===");
  console.log(`Target origin: ${origin}\n`);

  runStep("Readiness Check", "node", ["scripts/check-readiness.mjs", `--origin=${origin}`]);
  runStep("Smoke Client Read Tests (/api/mcp)", "node", ["scripts/test-client.mjs", origin]);
  runStep("Smoke Client Read Tests (/mcp)", "node", ["scripts/test-client.mjs", origin, "--path=/mcp"]);
  runStep("MCP Protocol Suite (/api/mcp and /mcp)", "node", ["scripts/test-mcp.mjs", `--origin=${origin}`]);

  console.log("\n======================================================");
  console.log("ALL FUNCTIONAL VERIFICATION STEPS PASSED SUCCESSFULLY!");
  console.log("======================================================");
}

main();
