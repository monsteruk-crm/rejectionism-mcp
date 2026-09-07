import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { computeUrlFingerprint, checkReadiness } from "../../lib/campaign/readiness";

vi.mock("server-only", () => ({}));

describe("lib/campaign/readiness.ts", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("computeUrlFingerprint handles valid and invalid URLs", () => {
    expect(computeUrlFingerprint(undefined)).toBeNull();
    expect(computeUrlFingerprint("")).toBeNull();
    expect(computeUrlFingerprint("invalid-url")).toBeNull();

    const fp = computeUrlFingerprint("postgresql://user:pass@localhost:5432/campaignos?schema=public");
    expect(fp).toBeDefined();
    expect(fp).toHaveLength(64);
  });

  it("returns CONFIGURATION_ERROR when database URL is missing", async () => {
    delete process.env.MCP_PRISMA_DATABASE_URL;
    const report = await checkReadiness();

    expect(report.ok).toBe(false);
    expect(report.error).toBe("CONFIGURATION_ERROR");
    expect(report.database.connected).toBe(false);
    expect(report.database.tablesPresent).toBe(false);
    expect(report.database.migrationsApplied).toBe(false);
  });
});
