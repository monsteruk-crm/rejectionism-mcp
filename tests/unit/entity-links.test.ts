import { describe, expect, it } from "vitest";
import {
  TagEntityInputSchema,
  TagSlugSchema,
  UntagEntityInputSchema,
  normalizeTagSlug,
  EntityRefSchema,
} from "@/lib/campaign/tag-schemas";
import {
  GetRelationshipsQuerySchema,
  LinkEntitiesInputSchema,
} from "@/lib/campaign/relation-schemas";

describe("tag slug normalization", () => {
  it("lowercases and hyphenates runs of non-alphanumeric characters", () => {
    expect(normalizeTagSlug("Primary Seal")).toBe("primary-seal");
    expect(normalizeTagSlug("  Mixed   CASE  ")).toBe("mixed-case");
    expect(normalizeTagSlug("logo/2026_v2!!")).toBe("logo-2026-v2");
    expect(normalizeTagSlug("--already--slugged--")).toBe("already-slugged");
  });

  it("applies Unicode NFKD and strips combining marks", () => {
    expect(normalizeTagSlug("Créma")).toBe("crema");
    expect(normalizeTagSlug("ﬁle")).toBe("file"); // NFKD composes the ligature
    expect(normalizeTagSlug("e\u0301clair")).toBe("eclair");
  });

  it("rejects slugs that normalize to empty", () => {
    expect(normalizeTagSlug("!!!")).toBe("");
    expect(normalizeTagSlug("   ")).toBe("");
    expect(normalizeTagSlug("日本語")).toBe("");
  });
});

describe("tag slug schema", () => {
  it("accepts canonical slugs only", () => {
    expect(TagSlugSchema.safeParse("primary-seal").success).toBe(true);
    expect(TagSlugSchema.safeParse("a").success).toBe(true);
    expect(TagSlugSchema.safeParse("-leading").success).toBe(false);
    expect(TagSlugSchema.safeParse("trailing-").success).toBe(false);
    expect(TagSlugSchema.safeParse("double--hyphen").success).toBe(false);
    expect(TagSlugSchema.safeParse("Upper-Case").success).toBe(false);
    expect(TagSlugSchema.safeParse("spaced value").success).toBe(false);
    expect(TagSlugSchema.safeParse("a".repeat(81)).success).toBe(false);
  });
});

describe("entity ref schema", () => {
  it("accepts only the original seven entity types", () => {
    expect(
      EntityRefSchema.safeParse({ entityType: "WORK_ITEM", entityId: "w1" }).success,
    ).toBe(true);
    expect(
      EntityRefSchema.safeParse({ entityType: "CONTENT_ITEM", entityId: "c1" }).success,
    ).toBe(true);
    // Additions are never taggable/linkable targets.
    expect(
      EntityRefSchema.safeParse({ entityType: "UPLOAD_REQUEST", entityId: "u1" }).success,
    ).toBe(false);
    expect(EntityRefSchema.safeParse({ entityType: "TAG", entityId: "t1" }).success).toBe(false);
    expect(
      EntityRefSchema.safeParse({ entityType: "ENTITY_RELATION", entityId: "r1" }).success,
    ).toBe(false);
    expect(EntityRefSchema.safeParse({ entityType: "ACTIVITY", entityId: "a1" }).success).toBe(
      false,
    );
  });

  it("rejects unknown keys and empty ids", () => {
    expect(
      EntityRefSchema.safeParse({ entityType: "ASSET", entityId: "a1", extra: 1 }).success,
    ).toBe(false);
    expect(EntityRefSchema.safeParse({ entityType: "ASSET", entityId: "" }).success).toBe(false);
  });
});

describe("tag input schemas", () => {
  it("trims the display name and requires 1..80 characters", () => {
    const parsed = TagEntityInputSchema.parse({
      entityType: "ASSET",
      entityId: " asset-1 ",
      tag: "  Primary Seal  ",
    });
    expect(parsed.entityId).toBe("asset-1");
    expect(parsed.tag).toBe("Primary Seal");
    expect(TagEntityInputSchema.safeParse({ entityType: "ASSET", entityId: "a", tag: "" }).success).toBe(
      false,
    );
    expect(
      TagEntityInputSchema.safeParse({ entityType: "ASSET", entityId: "a", tag: "x".repeat(81) })
        .success,
    ).toBe(false);
  });

  it("requires canonical slugs for untagging", () => {
    expect(
      UntagEntityInputSchema.safeParse({ entityType: "ASSET", entityId: "a1", tagSlug: "primary-seal" })
        .success,
    ).toBe(true);
    expect(
      UntagEntityInputSchema.safeParse({ entityType: "ASSET", entityId: "a1", tagSlug: "Not A Slug" })
        .success,
    ).toBe(false);
  });
});

describe("relationship schemas", () => {
  it("defaults direction to both and paginates", () => {
    const parsed = GetRelationshipsQuerySchema.parse({
      entityType: "ASSET",
      entityId: "asset-1",
    });
    expect(parsed.direction).toBe("both");
    expect(parsed.limit).toBe(50);
    expect(parsed.offset).toBe(0);
  });

  it("accepts an explicit direction and relation type", () => {
    expect(
      GetRelationshipsQuerySchema.safeParse({
        entityType: "ASSET",
        entityId: "asset-1",
        direction: "incoming",
        relationType: "USES_ASSET",
      }).success,
    ).toBe(true);
    expect(
      GetRelationshipsQuerySchema.safeParse({
        entityType: "ASSET",
        entityId: "asset-1",
        direction: "sideways",
      }).success,
    ).toBe(false);
    expect(
      GetRelationshipsQuerySchema.safeParse({
        entityType: "ASSET",
        entityId: "asset-1",
        relationType: "IMPLEMENTS",
      }).success,
    ).toBe(false);
  });

  it("normalizes link notes and rejects unknown keys", () => {
    const parsed = LinkEntitiesInputSchema.parse({
      from: { entityType: "CONTENT_ITEM", entityId: "content-1" },
      to: { entityType: "ASSET", entityId: "asset-1" },
      relationType: "USES_ASSET",
      notes: "  trimmed notes  ",
    });
    expect(parsed.notes).toBe("trimmed notes");

    const blank = LinkEntitiesInputSchema.parse({
      from: { entityType: "CONTENT_ITEM", entityId: "content-1" },
      to: { entityType: "ASSET", entityId: "asset-1" },
      relationType: "USES_ASSET",
      notes: "",
    });
    expect(blank.notes).toBeNull();

    expect(
      LinkEntitiesInputSchema.safeParse({
        from: { entityType: "CONTENT_ITEM", entityId: "content-1" },
        to: { entityType: "ASSET", entityId: "asset-1" },
        relationType: "USES_ASSET",
        extra: true,
      }).success,
    ).toBe(false);
  });
});
