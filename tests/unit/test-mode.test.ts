import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isTestModeEnabled, TEST_MODE_WARNING } from "@/lib/campaign/test-mode";
import { testModeDisabledResult, ok, fail } from "@/lib/campaign/results";

describe("Test Mode Gate", () => {
  const originalEnv = process.env.UNAUTHENTICATED_TEST_MODE;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.UNAUTHENTICATED_TEST_MODE = originalEnv;
    } else {
      delete process.env.UNAUTHENTICATED_TEST_MODE;
    }
  });

  it("returns true only when UNAUTHENTICATED_TEST_MODE is strictly 'true'", () => {
    process.env.UNAUTHENTICATED_TEST_MODE = "true";
    expect(isTestModeEnabled()).toBe(true);

    process.env.UNAUTHENTICATED_TEST_MODE = "false";
    expect(isTestModeEnabled()).toBe(false);

    process.env.UNAUTHENTICATED_TEST_MODE = "TRUE";
    expect(isTestModeEnabled()).toBe(false);

    process.env.UNAUTHENTICATED_TEST_MODE = "1";
    expect(isTestModeEnabled()).toBe(false);

    process.env.UNAUTHENTICATED_TEST_MODE = " true ";
    expect(isTestModeEnabled()).toBe(false);

    delete process.env.UNAUTHENTICATED_TEST_MODE;
    expect(isTestModeEnabled()).toBe(false);
  });

  it("returns standard TEST_MODE_DISABLED failure result", () => {
    const res = testModeDisabledResult();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("TEST_MODE_DISABLED");
      expect(res.error.message).toContain("blocked");
    }
  });

  it("contains the exact required warning constant", () => {
    expect(TEST_MODE_WARNING).toBe(
      "UNAUTHENTICATED TEST SYSTEM — DO NOT STORE PRIVATE OR SENSITIVE DATA",
    );
  });
});
