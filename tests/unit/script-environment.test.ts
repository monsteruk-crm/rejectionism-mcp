import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { loadEnvironment } from "../../scripts/lib/environment.mjs";
import {
  normalizeDatabaseUrl,
  computeDatabaseFingerprint,
  assertDisposableTestTarget,
} from "../../scripts/lib/test-target.mjs";

describe("scripts/lib/environment.mjs", () => {
  let testDir: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    testDir = resolve(tmpdir(), `test-env-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    delete process.env.TEST_VAR_A;
    delete process.env.TEST_VAR_B;
    delete process.env.CAMPAIGNOS_TEST_ENV_FILE;
    delete process.env.DOTENV_CONFIG_PATH;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("loads .env.local and .env with inherited variables taking precedence", () => {
    writeFileSync(resolve(testDir, ".env"), "TEST_VAR_A=from_env\nTEST_VAR_B=from_env\n");
    writeFileSync(resolve(testDir, ".env.local"), "TEST_VAR_A=from_local\n");
    process.env.TEST_VAR_B = "from_process";

    loadEnvironment({ rootDir: testDir, argv: [] });

    expect(process.env.TEST_VAR_A).toBe("from_local");
    expect(process.env.TEST_VAR_B).toBe("from_process");
  });

  it("loads explicit file via --env-file argument", () => {
    const customEnv = resolve(testDir, "custom.env");
    writeFileSync(customEnv, "TEST_VAR_A=from_custom\n");

    loadEnvironment({ rootDir: testDir, argv: [`--env-file=${customEnv}`] });
    expect(process.env.TEST_VAR_A).toBe("from_custom");
  });

  it("loads explicit file via CAMPAIGNOS_TEST_ENV_FILE", () => {
    const customEnv = resolve(testDir, "test.env");
    writeFileSync(customEnv, "TEST_VAR_A=from_test_env_file\n");
    process.env.CAMPAIGNOS_TEST_ENV_FILE = customEnv;

    loadEnvironment({ rootDir: testDir, argv: [] });
    expect(process.env.TEST_VAR_A).toBe("from_test_env_file");
  });

  it("throws when explicit file is missing", () => {
    expect(() => {
      loadEnvironment({ rootDir: testDir, argv: ["--env-file=nonexistent.env"] });
    }).toThrow(/Explicitly specified environment file not found/);
  });
});

describe("scripts/lib/test-target.mjs", () => {
  it("normalizes PostgreSQL database URLs correctly", () => {
    const url1 = "postgresql://user:secret@localhost:5432/campaignos?schema=public&sslmode=disable";
    const norm1 = normalizeDatabaseUrl(url1);

    expect(norm1.host).toBe("localhost");
    expect(norm1.port).toBe(5432);
    expect(norm1.database).toBe("campaignos");
    expect(norm1.schema).toBe("public");
    expect(norm1.normalizedString).toBe("postgresql://localhost:5432/campaignos?schema=public");
  });

  it("computes deterministic SHA-256 database fingerprints", () => {
    const url1 = "postgresql://user1:pass1@db.example.com:5432/my_db?schema=public";
    const url2 = "postgresql://user2:pass2@db.example.com:5432/my_db";

    const fp1 = computeDatabaseFingerprint(url1);
    const fp2 = computeDatabaseFingerprint(url2);

    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(64);
  });

  it("differentiates different databases or schemas", () => {
    const fp1 = computeDatabaseFingerprint("postgresql://localhost:5432/db1?schema=public");
    const fp2 = computeDatabaseFingerprint("postgresql://localhost:5432/db2?schema=public");
    const fp3 = computeDatabaseFingerprint("postgresql://localhost:5432/db1?schema=custom");

    expect(fp1).not.toBe(fp2);
    expect(fp1).not.toBe(fp3);
  });

  it("assertDisposableTestTarget rejects matching test and operational URLs", () => {
    const testUrl = "postgresql://u1:p1@localhost:5432/campaignos";
    const opUrl = "postgresql://u2:p2@localhost:5432/campaignos";

    expect(() => {
      assertDisposableTestTarget({
        testDatabaseUrl: testUrl,
        operationalDatabaseUrl: opUrl,
        requireDisposableAck: false,
      });
    }).toThrow(/TEST_MCP_PRISMA_DATABASE_URL matches the operational/);
  });

  it("assertDisposableTestTarget requires CAMPAIGNOS_TEST_DISPOSABLE when enabled", () => {
    const testUrl = "postgresql://u1:p1@localhost:5432/campaignos_test";
    const opUrl = "postgresql://u2:p2@localhost:5432/campaignos_prod";

    const originalAck = process.env.CAMPAIGNOS_TEST_DISPOSABLE;
    delete process.env.CAMPAIGNOS_TEST_DISPOSABLE;

    try {
      expect(() => {
        assertDisposableTestTarget({
          testDatabaseUrl: testUrl,
          operationalDatabaseUrl: opUrl,
          requireDisposableAck: true,
        });
      }).toThrow(/CAMPAIGNOS_TEST_DISPOSABLE=1 is required/);

      process.env.CAMPAIGNOS_TEST_DISPOSABLE = "1";
      const result = assertDisposableTestTarget({
        testDatabaseUrl: testUrl,
        operationalDatabaseUrl: opUrl,
        requireDisposableAck: true,
      });
      expect(result.fingerprint).toBeDefined();
    } finally {
      if (originalAck !== undefined) {
        process.env.CAMPAIGNOS_TEST_DISPOSABLE = originalAck;
      } else {
        delete process.env.CAMPAIGNOS_TEST_DISPOSABLE;
      }
    }
  });

  it("assertDisposableTestTarget checks expected fingerprint if supplied", () => {
    const testUrl = "postgresql://u1:p1@localhost:5432/campaignos_test";
    const expected = computeDatabaseFingerprint(testUrl);

    const result = assertDisposableTestTarget({
      testDatabaseUrl: testUrl,
      requireDisposableAck: false,
      expectedFingerprint: expected,
    });
    expect(result.fingerprint).toBe(expected);

    expect(() => {
      assertDisposableTestTarget({
        testDatabaseUrl: testUrl,
        requireDisposableAck: false,
        expectedFingerprint: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      });
    }).toThrow(/fingerprint mismatch/);
  });
});
