import "./lib/environment.mjs";
import { spawnSync } from "node:child_process";
import { assertDisposableTestTarget } from "./lib/test-target.mjs";

const testDatabaseUrl = process.env.TEST_MCP_PRISMA_DATABASE_URL;
const operationalDatabaseUrl = process.env.MCP_PRISMA_DATABASE_URL;

try {
  assertDisposableTestTarget({
    testDatabaseUrl,
    operationalDatabaseUrl,
  });
} catch (err) {
  console.error(`Integration test target check failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

const environment = {
  ...process.env,
  MCP_PRISMA_DATABASE_URL: testDatabaseUrl,
};

function run(command, args) {
  const result = spawnSync(command, args, {
    env: environment,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("pnpm", ["db:deploy"]);
run("pnpm", ["db:backfill-assets"]);
run("pnpm", ["db:seed"]);
run("pnpm", ["exec", "vitest", "run", "--config", "vitest.integration.config.ts"]);
