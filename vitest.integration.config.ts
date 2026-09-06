import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    passWithNoTests: false,
    // Integration tests perform many sequential round-trips against a remote
    // disposable PostgreSQL database (migrations, backfills, seeds); the 5s
    // default per-test timeout is far too small for that.
    testTimeout: 240000,
    hookTimeout: 240000,
    // All integration files share one disposable PostgreSQL database; run them
    // sequentially so fixtures, seeds, and backfills cannot interleave.
    fileParallelism: false,
    alias: {
      "server-only": path.resolve(dirname, "tests/__mocks__/server-only.ts"),
    },
  },
});
