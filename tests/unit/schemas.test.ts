import { describe, it, expect } from "vitest";
import {
  CreateWorkItemInputSchema,
  UpdateWorkItemInputSchema,
  CreateCanonEntryInputSchema,
  RecordDecisionInputSchema,
  CreateWebsiteInputSchema,
  CreateContentItemInputSchema,
  CreateContactInputSchema,
  CreateAssetInputSchema,
  RegisterAssetInputSchema,
  DomainString,
  AbsoluteUrlString,
} from "@/lib/campaign/schemas";

describe("Validation Schemas", () => {
  describe("DomainString", () => {
    it("accepts valid lowercase domain names", () => {
      expect(DomainString.parse("rejectionism.co.uk")).toBe("rejectionism.co.uk");
      expect(DomainString.parse("archiveofno.com")).toBe("archiveofno.com");
      expect(DomainString.parse("sub.domain.org")).toBe("sub.domain.org");
    });

    it("rejects domains with schemes, ports, or paths", () => {
      expect(() => DomainString.parse("https://rejectionism.co.uk")).toThrow();
      expect(() => DomainString.parse("rejectionism.co.uk:3000")).toThrow();
      expect(() => DomainString.parse("rejectionism.co.uk/path")).toThrow();
      expect(() => DomainString.parse("rejectionism.co.uk?query=1")).toThrow();
    });
  });

  describe("AbsoluteUrlString", () => {
    it("accepts valid http and https URLs", () => {
      expect(AbsoluteUrlString.parse("https://rejectionism.co.uk")).toBe(
        "https://rejectionism.co.uk",
      );
      expect(AbsoluteUrlString.parse("http://example.com/asset.png")).toBe(
        "http://example.com/asset.png",
      );
    });

    it("rejects invalid or relative URLs", () => {
      expect(() => AbsoluteUrlString.parse("/relative/path")).toThrow();
      expect(() => AbsoluteUrlString.parse("ftp://example.com")).toThrow();
      expect(() => AbsoluteUrlString.parse("not-a-url")).toThrow();
    });
  });

  describe("CreateWorkItemInputSchema", () => {
    it("accepts valid backlog item", () => {
      const parsed = CreateWorkItemInputSchema.parse({
        title: "Test item",
        description: "Test description",
        priority: 10,
      });
      expect(parsed.title).toBe("Test item");
      expect(parsed.status).toBe("BACKLOG");
    });

    it("rejects extra keys (.strict())", () => {
      expect(() =>
        CreateWorkItemInputSchema.parse({
          title: "Test item",
          extraField: "not allowed",
        }),
      ).toThrow();
    });

    it("rejects empty titles or invalid priority", () => {
      expect(() =>
        CreateWorkItemInputSchema.parse({
          title: "   ",
        }),
      ).toThrow();

      expect(() =>
        CreateWorkItemInputSchema.parse({
          title: "Valid",
          priority: 105,
        }),
      ).toThrow();
    });
  });

  describe("UpdateWorkItemInputSchema", () => {
    it("requires expectedVersion and at least one change", () => {
      expect(() =>
        UpdateWorkItemInputSchema.parse({
          id: "item-1",
          expectedVersion: 1,
          changes: {},
        }),
      ).toThrow();

      const parsed = UpdateWorkItemInputSchema.parse({
        id: "item-1",
        expectedVersion: 1,
        changes: { title: "Updated Title" },
      });
      expect(parsed.id).toBe("item-1");
      expect(parsed.expectedVersion).toBe(1);
    });
  });

  describe("CreateContentItemInputSchema", () => {
    it("requires scheduledFor when status is SCHEDULED", () => {
      expect(() =>
        CreateContentItemInputSchema.parse({
          title: "Broadcast #1",
          format: "decree",
          channel: "web",
          status: "SCHEDULED",
        }),
      ).toThrow(/scheduledFor/);

      const parsed = CreateContentItemInputSchema.parse({
        title: "Broadcast #1",
        format: "decree",
        channel: "web",
        status: "SCHEDULED",
        scheduledFor: "2026-10-01T00:00:00Z",
      });
      expect(parsed.status).toBe("SCHEDULED");
    });

    it("requires publishedUrl when status is PUBLISHED", () => {
      expect(() =>
        CreateContentItemInputSchema.parse({
          title: "Broadcast #1",
          format: "decree",
          channel: "web",
          status: "PUBLISHED",
        }),
      ).toThrow(/publishedUrl/);

      const parsed = CreateContentItemInputSchema.parse({
        title: "Broadcast #1",
        format: "decree",
        channel: "web",
        status: "PUBLISHED",
        publishedUrl: "https://rejectionism.co.uk/decree-1",
      });
      expect(parsed.status).toBe("PUBLISHED");
    });
  });

  describe("RegisterAssetInputSchema", () => {
    it("validates discriminated action union for create and update", () => {
      const createParsed = RegisterAssetInputSchema.parse({
        action: "create",
        name: "Test Logo",
        kind: "logo",
        status: "DRAFT",
      });
      expect(createParsed.action).toBe("create");

      const updateParsed = RegisterAssetInputSchema.parse({
        action: "update",
        id: "asset-1",
        expectedVersion: 2,
        changes: { status: "APPROVED" },
      });
      expect(updateParsed.action).toBe("update");
    });
  });

  describe("RecordDecisionInputSchema", () => {
    it("parses valid decision with optional canon update", () => {
      const parsed = RecordDecisionInputSchema.parse({
        subject: "New Policy",
        decision: "Adopt strict rejection",
        rationale: "Cultural necessity",
        updateCanon: {
          mode: "create",
          key: "movement.policy",
          value: "Strict rejection",
          category: "identity",
        },
      });
      expect(parsed.subject).toBe("New Policy");
      expect(parsed.updateCanon?.mode).toBe("create");
    });
  });
});
