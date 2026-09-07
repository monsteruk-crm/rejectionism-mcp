import { describe, it, expect } from "vitest";
import { lookupEntities, lookupAssetRevisions } from "../../lib/campaign/admin-lookups";

describe("Admin Lookups Integration", () => {
  it("lookupEntities searches across multiple registers", async () => {
    const res = await lookupEntities({ query: "rejection", limit: 20 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(Array.isArray(res.data.items)).toBe(true);
      expect(typeof res.data.total).toBe("number");
    }
  });

  it("lookupEntities with empty query browses bounded records", async () => {
    const res = await lookupEntities({ limit: 10, offset: 0 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.items.length).toBeLessThanOrEqual(10);
    }
  });

  it("lookupEntities respects single entityType constraint (e.g. ASSET for USES_ASSET)", async () => {
    const res = await lookupEntities({ entityTypes: ["ASSET"], limit: 10 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      for (const item of res.data.items) {
        expect(item.entityType).toBe("ASSET");
      }
    }
  });
});
