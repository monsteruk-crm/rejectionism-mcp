import { describe, it, expect } from "vitest";
import { parseCleanupArgs } from "../../scripts/cleanup-upload-files";

describe("scripts/cleanup-upload-files.ts CLI Parser", () => {
  it("defaults to dry-run with limit 100", () => {
    const parsed = parseCleanupArgs([]);
    expect(parsed.apply).toBe(false);
    expect(parsed.limit).toBe(100);
    expect(parsed.requestId).toBeUndefined();
    expect(parsed.confirmTarget).toBeUndefined();
  });

  it("parses --apply and --confirm-target", () => {
    const parsed = parseCleanupArgs(["--apply", "--confirm-target=abcd1234abcd1234", "--limit", "50"]);
    expect(parsed.apply).toBe(true);
    expect(parsed.confirmTarget).toBe("abcd1234abcd1234");
    expect(parsed.limit).toBe(50);
  });

  it("parses --request-id scope", () => {
    const parsed = parseCleanupArgs(["--request-id", "req-123"]);
    expect(parsed.requestId).toBe("req-123");
  });

  it("rejects unknown flags", () => {
    expect(() => parseCleanupArgs(["--unknown-flag"])).toThrow(/Unknown argument/);
  });

  it("rejects conflicting --dry-run and --apply", () => {
    expect(() => parseCleanupArgs(["--dry-run", "--apply"])).toThrow(/Conflicting flags/);
  });

  it("rejects invalid limit values", () => {
    expect(() => parseCleanupArgs(["--limit", "0"])).toThrow(/Invalid limit/);
    expect(() => parseCleanupArgs(["--limit", "1001"])).toThrow(/Invalid limit/);
    expect(() => parseCleanupArgs(["--limit", "abc"])).toThrow(/Invalid limit/);
  });
});
