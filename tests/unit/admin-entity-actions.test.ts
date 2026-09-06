import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock boundaries
vi.mock("@/lib/auth/boundaries", () => ({
  requireAdminAction: vi.fn(async () => {}),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock campaign services
vi.mock("@/lib/campaign", () => ({
  tagEntity: vi.fn(),
  untagEntity: vi.fn(),
  linkEntities: vi.fn(),
  unlinkEntities: vi.fn(),
  entityHref: vi.fn((type: string, id: string) => `/admin/${type.toLowerCase()}s/${id}`),
}));

import { requireAdminAction } from "@/lib/auth/boundaries";
import { revalidatePath } from "next/cache";
import { tagEntity, untagEntity, linkEntities, unlinkEntities } from "@/lib/campaign";
import {
  tagEntityAction,
  untagEntityAction,
  linkEntitiesAction,
  unlinkEntitiesAction,
} from "@/app/admin/entity-actions";

describe("Admin Entity Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tagEntityAction", () => {
    it("enforces admin authentication", async () => {
      (requireAdminAction as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("UNAUTHENTICATED"),
      );
      const fd = new FormData();
      fd.set("entityType", "WORK_ITEM");
      fd.set("entityId", "w1");
      fd.set("tag", "launch");

      await expect(tagEntityAction(null, fd)).rejects.toThrow("UNAUTHENTICATED");
    });

    it("attaches tag and revalidates paths on success", async () => {
      (tagEntity as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        data: {
          tag: { id: "t1", name: "launch", slug: "launch", createdAt: "2026-09-06" },
          entity: { entityType: "WORK_ITEM", entityId: "w1" },
          changed: true,
        },
      });

      const fd = new FormData();
      fd.set("entityType", "WORK_ITEM");
      fd.set("entityId", "w1");
      fd.set("tag", "launch");

      const result = await tagEntityAction(null, fd);

      expect(result.ok).toBe(true);
      expect(tagEntity).toHaveBeenCalledWith(
        {
          entityType: "WORK_ITEM",
          entityId: "w1",
          tag: "launch",
        },
        "admin",
      );
      expect(revalidatePath).toHaveBeenCalledWith("/admin/work_items/w1");
    });
  });

  describe("untagEntityAction", () => {
    it("removes tag association and revalidates", async () => {
      (untagEntity as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        data: {
          entity: { entityType: "ASSET", entityId: "a1" },
          tagSlug: "poster",
          changed: true,
        },
      });

      const fd = new FormData();
      fd.set("entityType", "ASSET");
      fd.set("entityId", "a1");
      fd.set("tagSlug", "poster");

      const result = await untagEntityAction(null, fd);

      expect(result.ok).toBe(true);
      expect(untagEntity).toHaveBeenCalledWith(
        {
          entityType: "ASSET",
          entityId: "a1",
          tagSlug: "poster",
        },
        "admin",
      );
      expect(revalidatePath).toHaveBeenCalledWith("/admin/assets/a1");
    });
  });

  describe("linkEntitiesAction", () => {
    it("creates directed relationship and revalidates both endpoints", async () => {
      (linkEntities as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        data: {
          relation: { id: "rel1" },
          changed: true,
        },
      });

      const fd = new FormData();
      fd.set("fromEntityType", "WORK_ITEM");
      fd.set("fromEntityId", "w1");
      fd.set("toEntityType", "ASSET");
      fd.set("toEntityId", "a1");
      fd.set("relationType", "USES_ASSET");
      fd.set("notes", "Main artwork");

      const result = await linkEntitiesAction(null, fd);

      expect(result.ok).toBe(true);
      expect(linkEntities).toHaveBeenCalledWith(
        {
          from: { entityType: "WORK_ITEM", entityId: "w1" },
          to: { entityType: "ASSET", entityId: "a1" },
          relationType: "USES_ASSET",
          notes: "Main artwork",
        },
        "admin",
      );
      expect(revalidatePath).toHaveBeenCalledWith("/admin/work_items/w1");
      expect(revalidatePath).toHaveBeenCalledWith("/admin/assets/a1");
    });
  });

  describe("unlinkEntitiesAction", () => {
    it("removes relationship and revalidates", async () => {
      (unlinkEntities as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        data: { relationId: "rel1", changed: true },
      });

      const fd = new FormData();
      fd.set("relationId", "rel1");
      fd.set("revalidateHref", "/admin/work-items/w1");

      const result = await unlinkEntitiesAction(null, fd);

      expect(result.ok).toBe(true);
      expect(unlinkEntities).toHaveBeenCalledWith({ relationId: "rel1" }, "admin");
      expect(revalidatePath).toHaveBeenCalledWith("/admin/work-items/w1");
    });
  });
});
