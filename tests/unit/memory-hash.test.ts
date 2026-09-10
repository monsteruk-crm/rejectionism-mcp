import { describe, it, expect, vi } from "vitest";
import {
  computeMemoryContentHash,
  normalizeMemoryKey,
  normalizeMemoryText,
} from "@/lib/campaign/memory-hash";

vi.mock("server-only", () => ({}));

describe("lib/campaign/memory-hash", () => {
  it("normalizes text by trimming, lowercasing, and collapsing whitespace", () => {
    expect(normalizeMemoryText("   Hello   WORLD  \n\t ")).toBe("hello world");
    expect(normalizeMemoryText("exact")).toBe("exact");
  });

  it("produces deterministic SHA-256 hashes", () => {
    const hash1 = computeMemoryContentHash("STYLE", "Papal Realism", "Keep it authentic");
    const hash2 = computeMemoryContentHash("style", "  papal   realism  ", "keep   it authentic");
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes hash when category, title, or content changes", () => {
    const base = computeMemoryContentHash("STYLE", "Title", "Content");
    const diffCat = computeMemoryContentHash("PROCESS", "Title", "Content");
    const diffTitle = computeMemoryContentHash("STYLE", "Different", "Content");
    const diffContent = computeMemoryContentHash("STYLE", "Title", "Different");

    expect(diffCat).not.toBe(base);
    expect(diffTitle).not.toBe(base);
    expect(diffContent).not.toBe(base);
  });

  it("normalizes keys by lowercasing and trimming", () => {
    expect(normalizeMemoryKey("  Visual.Papal.Realism  ")).toBe("visual.papal.realism");
  });
});
