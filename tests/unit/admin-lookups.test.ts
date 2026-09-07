import { describe, it, expect, vi } from "vitest";
import { lookupEntities, lookupAssetRevisions } from "../../lib/campaign/admin-lookups";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  getPrisma: vi.fn(() => ({
    workItem: {
      findMany: vi.fn().mockResolvedValue([
        { id: "item-1", title: "Task 1", version: 1, status: "BACKLOG" },
      ]),
      count: vi.fn().mockResolvedValue(1),
    },
    canonEntry: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    decision: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    asset: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    website: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    contentItem: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    contact: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    assetRevision: {
      findMany: vi.fn().mockResolvedValue([
        { id: "rev-1", assetId: "asset-1", revisionNumber: 1, label: null, notes: null, representations: [], createdAt: new Date() },
      ]),
      count: vi.fn().mockResolvedValue(1),
    },
  })),
}));

describe("lib/campaign/admin-lookups.ts", () => {
  it("lookupEntities returns mapped EntityLookupItem list", async () => {
    const res = await lookupEntities({ query: "Task", entityTypes: ["WORK_ITEM"] });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.items).toHaveLength(1);
      expect(res.data.items[0]!.id).toBe("item-1");
      expect(res.data.items[0]!.entityType).toBe("WORK_ITEM");
      expect(res.data.items[0]!.href).toBe("/admin/work-items/item-1");
    }
  });

  it("lookupAssetRevisions returns revisions for asset", async () => {
    const res = await lookupAssetRevisions({ assetId: "asset-1" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.items).toHaveLength(1);
      expect(res.data.items[0]!.revisionNumber).toBe(1);
    }
  });
});
