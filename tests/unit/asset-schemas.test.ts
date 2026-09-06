import { describe, expect, it } from "vitest";
import {
  AddAssetRepresentationInputSchema,
  AssetDetailChangesSchema,
  AssetHttpUrlSchema,
  AssetMetadataSchema,
  AssetVersionSchema,
  CreateAssetRevisionInputSchema,
  ExternalRepresentationInputSchema,
  RepresentationFieldsSchema,
  SetPrimaryAssetRepresentationInputSchema,
  UpdateAssetDetailInputSchema,
} from "@/lib/campaign/asset-schemas";

describe("asset version schema", () => {
  it("coerces positive integers", () => {
    expect(AssetVersionSchema.parse(3)).toBe(3);
    expect(AssetVersionSchema.parse("7")).toBe(7);
  });

  it("rejects zero, negative, fractional, and non-numeric versions", () => {
    expect(AssetVersionSchema.safeParse(0).success).toBe(false);
    expect(AssetVersionSchema.safeParse(-1).success).toBe(false);
    expect(AssetVersionSchema.safeParse(1.5).success).toBe(false);
    expect(AssetVersionSchema.safeParse("abc").success).toBe(false);
  });
});

describe("asset metadata schema", () => {
  it("applies defaults and normalizes notes", () => {
    const parsed = AssetMetadataSchema.parse({ name: "Seal", kind: "logo" });
    expect(parsed.status).toBe("DRAFT");
    expect(parsed.notes).toBeNull();
    expect(parsed.id).toBeUndefined();
  });

  it("rejects unknown keys and empty required text", () => {
    expect(
      AssetMetadataSchema.safeParse({ name: "Seal", kind: "logo", extra: 1 }).success,
    ).toBe(false);
    expect(AssetMetadataSchema.safeParse({ name: "", kind: "logo" }).success).toBe(false);
    expect(
      AssetMetadataSchema.safeParse({ name: "Seal", kind: "logo", status: "NOPE" }).success,
    ).toBe(false);
  });
});

describe("asset detail changes schema", () => {
  it("requires at least one change key", () => {
    expect(AssetDetailChangesSchema.safeParse({}).success).toBe(false);
    expect(AssetDetailChangesSchema.safeParse({ name: "Renamed" }).success).toBe(true);
  });

  it("rejects unknown keys, including the legacy url column", () => {
    expect(
      AssetDetailChangesSchema.safeParse({ url: "https://example.com/a.png" }).success,
    ).toBe(false);
  });
});

describe("update asset detail input schema", () => {
  it("accepts a well-formed update", () => {
    expect(
      UpdateAssetDetailInputSchema.safeParse({
        id: "asset-1",
        expectedVersion: "2",
        changes: { status: "APPROVED" },
      }).success,
    ).toBe(true);
  });

  it("rejects a missing changes object", () => {
    expect(
      UpdateAssetDetailInputSchema.safeParse({ id: "asset-1", expectedVersion: 2 }).success,
    ).toBe(false);
  });
});

describe("representation input schemas", () => {
  it("accepts descriptive fields only and rejects technical fields", () => {
    expect(
      ExternalRepresentationInputSchema.safeParse({
        externalUrl: "https://example.com/a.png",
        label: "Primary",
      }).success,
    ).toBe(true);
    expect(RepresentationFieldsSchema.safeParse({ mimeType: "image/png" }).success).toBe(false);
  });

  it("validates the external URL with the section 8 validator", () => {
    expect(AssetHttpUrlSchema.safeParse(" https://example.com/a.png ").success).toBe(true);
    expect(AssetHttpUrlSchema.safeParse("http://localhost/a.png").success).toBe(false);
    expect(AssetHttpUrlSchema.safeParse("http://user:pass@example.com/a.png").success).toBe(false);
    expect(AssetHttpUrlSchema.safeParse("ftp://example.com/a.png").success).toBe(false);
  });

  it("accepts an add-representation input and rejects unknown keys", () => {
    const valid = {
      assetRevisionId: "rev-1",
      expectedVersion: 2,
      representation: { externalUrl: "https://example.com/b.png" },
    };
    expect(AddAssetRepresentationInputSchema.safeParse(valid).success).toBe(true);
    expect(
      AddAssetRepresentationInputSchema.safeParse({ ...valid, extra: true }).success,
    ).toBe(false);
    expect(
      AddAssetRepresentationInputSchema.safeParse({
        ...valid,
        representation: { externalUrl: "http://127.0.0.1/b.png" },
      }).success,
    ).toBe(false);
  });
});

describe("revision and primary input schemas", () => {
  it("accepts a minimal create-revision input", () => {
    const parsed = CreateAssetRevisionInputSchema.parse({
      assetId: "asset-1",
      expectedVersion: 1,
    });
    expect(parsed.label).toBeUndefined();
    expect(parsed.notes).toBeNull();
  });

  it("accepts a set-primary input and rejects extra keys", () => {
    expect(
      SetPrimaryAssetRepresentationInputSchema.safeParse({
        representationId: "rep-1",
        expectedVersion: 4,
      }).success,
    ).toBe(true);
    expect(
      SetPrimaryAssetRepresentationInputSchema.safeParse({
        representationId: "rep-1",
        expectedVersion: 4,
        revisionId: "rev-1",
      }).success,
    ).toBe(false);
  });
});
