import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Plain node scripts do not load .env.local automatically, and an inherited
// shell environment can carry stale DATABASE_URL values from unrelated
// commands. Resolve both targets with identical shell-first precedence so the
// safety comparison checks the exact values that child processes would use.
function readEnvFileValue(key) {
  const line = readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(`${key}=`));
  if (!line) {
    return undefined;
  }
  return line
    .slice(key.length + 1)
    .trim()
    .replace(/^"(.*)"$/, "$1");
}

const testDatabaseUrl =
  process.env.TEST_MCP_PRISMA_DATABASE_URL || readEnvFileValue("TEST_MCP_PRISMA_DATABASE_URL");
const operationalDatabaseUrl =
  process.env.MCP_PRISMA_DATABASE_URL || readEnvFileValue("MCP_PRISMA_DATABASE_URL");

if (!testDatabaseUrl) {
  console.error("TEST_MCP_PRISMA_DATABASE_URL must identify a disposable PostgreSQL database.");
  process.exit(1);
}

if (!operationalDatabaseUrl || testDatabaseUrl === operationalDatabaseUrl) {
  console.error(
    "TEST_MCP_PRISMA_DATABASE_URL must differ from the operational MCP_PRISMA_DATABASE_URL to protect non-test data.",
  );
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
