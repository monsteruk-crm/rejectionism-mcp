import { describe, it, expect } from "vitest";
import {
  RememberMemoryInputSchema,
  UpdateMemoryInputSchema,
  GetMemoryInputSchema,
  ListMemoriesQuerySchema,
  RecallMemoriesInputSchema,
  MemoryKeySchema,
  MemorySourceUrlSchema,
  MemoryImportanceSchema,
  MemoryConfidenceSchema,
} from "@/lib/campaign/memory-schemas";

describe("lib/campaign/memory-schemas", () => {
  describe("MemoryKeySchema", () => {
    it("accepts valid keys", () => {
      expect(MemoryKeySchema.parse("visual.papal.realism")).toBe("visual.papal.realism");
      expect(MemoryKeySchema.parse("a_b-c.1")).toBe("a_b-c.1");
      expect(MemoryKeySchema.parse(" simple ")).toBe("simple");
    });

    it("rejects invalid keys", () => {
      expect(() => MemoryKeySchema.parse("")).toThrow();
      expect(() => MemoryKeySchema.parse("INVALID_UPPERCASE")).toThrow();
      expect(() => MemoryKeySchema.parse("has spaces")).toThrow();
      expect(() => MemoryKeySchema.parse("double..dot")).toThrow();
      expect(() => MemoryKeySchema.parse("-leading-hyphen")).toThrow();
    });
  });

  describe("Numeric bounds", () => {
    it("validates importance 0-100", () => {
      expect(MemoryImportanceSchema.parse(0)).toBe(0);
      expect(MemoryImportanceSchema.parse(50)).toBe(50);
      expect(MemoryImportanceSchema.parse(100)).toBe(100);
      expect(() => MemoryImportanceSchema.parse(-1)).toThrow();
      expect(() => MemoryImportanceSchema.parse(101)).toThrow();
    });

    it("validates confidence 0-100", () => {
      expect(MemoryConfidenceSchema.parse(0)).toBe(0);
      expect(MemoryConfidenceSchema.parse(100)).toBe(100);
      expect(() => MemoryConfidenceSchema.parse(-5)).toThrow();
      expect(() => MemoryConfidenceSchema.parse(105)).toThrow();
    });
  });

  describe("MemorySourceUrlSchema", () => {
    it("accepts valid http and https URLs", () => {
      expect(MemorySourceUrlSchema.parse("https://example.com/doc")).toBe("https://example.com/doc");
      expect(MemorySourceUrlSchema.parse("http://localhost:3000")).toBe("http://localhost:3000");
    });

    it("rejects embedded credentials or invalid protocols", () => {
      expect(() => MemorySourceUrlSchema.parse("ftp://example.com")).toThrow();
      expect(() => MemorySourceUrlSchema.parse("https://user:pass@example.com")).toThrow();
      expect(() => MemorySourceUrlSchema.parse("not-a-url")).toThrow();
    });
  });

  describe("RememberMemoryInputSchema", () => {
    it("parses valid remember input with defaults", () => {
      const parsed = RememberMemoryInputSchema.parse({
        title: "Test memory",
        content: "Some important context",
        category: "PREFERENCE",
      });
      expect(parsed.title).toBe("Test memory");
      expect(parsed.importance).toBe(50);
      expect(parsed.confidence).toBe(100);
      expect(parsed.pinned).toBe(false);
      expect(parsed.sourceLabel).toBeNull();
      expect(parsed.tags).toEqual([]);
      expect(parsed.relationships).toEqual([]);
    });

    it("rejects extra unknown fields due to strict schema", () => {
      expect(() =>
        RememberMemoryInputSchema.parse({
          title: "Test memory",
          content: "Content",
          category: "PREFERENCE",
          unknownField: "malicious",
        }),
      ).toThrow();
    });
  });

  describe("GetMemoryInputSchema", () => {
    it("accepts either id or key, but not both", () => {
      expect(GetMemoryInputSchema.parse({ id: "cl12345" }).id).toBe("cl12345");
      expect(GetMemoryInputSchema.parse({ key: "visual.papal" }).key).toBe("visual.papal");
      expect(() => GetMemoryInputSchema.parse({ id: "cl123", key: "visual.papal" })).toThrow();
      expect(() => GetMemoryInputSchema.parse({})).toThrow();
    });
  });

  describe("ListMemoriesQuerySchema", () => {
    it("enforces expiredOnly requires includeExpired", () => {
      expect(() =>
        ListMemoriesQuerySchema.parse({
          expiredOnly: true,
          includeExpired: false,
        }),
      ).toThrow();

      expect(
        ListMemoriesQuerySchema.parse({
          expiredOnly: true,
          includeExpired: true,
        }).expiredOnly,
      ).toBe(true);
    });

    it("enforces RELEVANCE sort requires non-empty search", () => {
      expect(() =>
        ListMemoriesQuerySchema.parse({
          sort: "RELEVANCE",
          search: "",
        }),
      ).toThrow();

      expect(
        ListMemoriesQuerySchema.parse({
          sort: "RELEVANCE",
          search: "query",
        }).sort,
      ).toBe("RELEVANCE");
    });
  });

  describe("UpdateMemoryInputSchema", () => {
    it("requires at least one field in changes", () => {
      expect(() =>
        UpdateMemoryInputSchema.parse({
          id: "cm123",
          expectedVersion: 1,
          changes: {},
        }),
      ).toThrow();

      expect(
        UpdateMemoryInputSchema.parse({
          id: "cm123",
          expectedVersion: 1,
          changes: { title: "Updated" },
        }).changes.title,
      ).toBe("Updated");
    });
  });
});
