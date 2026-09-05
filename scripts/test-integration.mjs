import { spawnSync } from "node:child_process";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  console.error("TEST_DATABASE_URL must identify a disposable PostgreSQL database.");
  process.exit(1);
}

if (testDatabaseUrl === process.env.DATABASE_URL) {
  console.error("TEST_DATABASE_URL must differ from DATABASE_URL to protect non-test data.");
  process.exit(1);
}

const environment = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
  UNAUTHENTICATED_TEST_MODE: "true",
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
run("pnpm", ["db:seed"]);
run("pnpm", ["exec", "vitest", "run", "--config", "vitest.integration.config.ts"]);
