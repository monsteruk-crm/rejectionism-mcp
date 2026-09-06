import { describe, expect, it } from "vitest";
import {
  canonicalFinalizationPayload,
  generateUploadToken,
  hashFinalizationPayload,
  hashUploadToken,
  isRawUploadToken,
  UPLOAD_TOKEN_PATTERN,
} from "@/lib/campaign/upload-tokens";

describe("raw upload token generation", () => {
  it("generates 43-character base64url tokens without padding", () => {
    const token = generateUploadToken();
    expect(token).toHaveLength(43);
    expect(token).toMatch(UPLOAD_TOKEN_PATTERN);
    expect(token).not.toContain("=");
    expect(token).not.toContain("+");
    expect(token).not.toContain("/");
  });

  it("generates distinct tokens", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateUploadToken()));
    expect(tokens.size).toBe(50);
  });
});

describe("raw upload token validation", () => {
  it("accepts exactly 43 base64url characters", () => {
    expect(isRawUploadToken("A".repeat(43))).toBe(true);
    expect(isRawUploadToken("a-b_Z9".repeat(7) + "a")).toBe(true); // 43 chars
  });

  it("rejects wrong lengths, padding, and non-base64url characters", () => {
    expect(isRawUploadToken("A".repeat(42))).toBe(false);
    expect(isRawUploadToken("A".repeat(44))).toBe(false);
    expect(isRawUploadToken(`${"A".repeat(42)}=`)).toBe(false);
    expect(isRawUploadToken(`${"A".repeat(42)}+`)).toBe(false);
    expect(isRawUploadToken(`${"A".repeat(42)}/`)).toBe(false);
    expect(isRawUploadToken("")).toBe(false);
    expect(isRawUploadToken(null)).toBe(false);
    expect(isRawUploadToken(123)).toBe(false);
  });
});

describe("token hashing", () => {
  it("produces the lowercase SHA-256 hex digest of the raw token", async () => {
    // Well-known SHA-256 test vector for "abc".
    const digest = await hashUploadToken("abc");
    expect(digest).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("is deterministic and never returns the raw token", async () => {
    const token = generateUploadToken();
    const first = await hashUploadToken(token);
    const second = await hashUploadToken(token);
    expect(first).toBe(second);
    expect(first).toHaveLength(64);
    expect(first).not.toContain(token);
  });
});

describe("finalization payload canonicalization", () => {
  const key = "0b8dfa2e-6a5f-4c1d-9a6f-9d6f1f9f3a01";

  it("serializes with a fixed property order regardless of insertion order", () => {
    const itemA = {
      clientItemId: "11111111-1111-4111-8111-111111111111",
      type: "FILE" as const,
      fileId: "file-1",
      name: "Logo",
      kind: "artwork",
      notes: null,
      label: null,
      variant: null,
      format: null,
    };
    // Same logical item with a different property insertion order and an
    // extra derived property that must be ignored.
    const itemB = {
      format: null,
      variant: null,
      label: null,
      notes: null,
      kind: "artwork",
      name: "Logo",
      blobUrl: "https://evil.example/blob", // derived metadata: excluded
      fileId: "file-1",
      type: "FILE" as const,
      clientItemId: "11111111-1111-4111-8111-111111111111",
    };

    const canonicalA = JSON.stringify(canonicalFinalizationPayload(key, [itemA]));
    const canonicalB = JSON.stringify(canonicalFinalizationPayload(key, [itemB]));
    expect(canonicalB).toBe(canonicalA);
    expect(canonicalB.indexOf("blobUrl")).toBe(-1);
  });

  it("hashes identical payloads identically and preserves item order", async () => {
    const items = [
      {
        clientItemId: "22222222-2222-4222-8222-222222222222",
        type: "EXTERNAL_URL" as const,
        externalUrl: "https://example.com/a.png",
        name: "A",
        kind: "artwork",
        notes: "",
        label: null,
        variant: null,
        format: null,
      },
      {
        clientItemId: "33333333-3333-4333-8333-333333333333",
        type: "FILE" as const,
        fileId: "file-2",
        name: "B",
        kind: "artwork",
        notes: null,
        label: "Primary",
        variant: null,
        format: null,
      },
    ];

    const first = await hashFinalizationPayload(key, items);
    const second = await hashFinalizationPayload(key, [...items]);
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);

    // Item order is part of the payload.
    const reordered = await hashFinalizationPayload(key, [...items].reverse());
    expect(reordered).not.toBe(first);
  });

  it("normalizes empty notes to null and keys the hash on the submissionKey", async () => {
    const item = {
      clientItemId: "44444444-4444-4444-8444-444444444444",
      type: "EXTERNAL_URL" as const,
      externalUrl: "https://example.com/a.png",
      name: "A",
      kind: "artwork",
      notes: "",
      label: null,
      variant: null,
      format: null,
    };

    const withEmptyNotes = await hashFinalizationPayload(key, [item]);
    const withNullNotes = await hashFinalizationPayload(key, [{ ...item, notes: null }]);
    expect(withEmptyNotes).toBe(withNullNotes);

    const otherKey = await hashFinalizationPayload("99999999-9999-4999-8999-999999999999", [item]);
    expect(otherKey).not.toBe(withEmptyNotes);
  });
});
