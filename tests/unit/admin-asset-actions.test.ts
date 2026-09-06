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
  createAsset: vi.fn(),
  addExternalAsset: vi.fn(),
  updateAsset: vi.fn(),
  createAssetRevision: vi.fn(),
  addAssetRepresentation: vi.fn(),
  setPrimaryAssetRepresentation: vi.fn(),
  createUploadRequest: vi.fn(),
  revokeUploadRequest: vi.fn(),
  regenerateUploadRequest: vi.fn(),
}));

import { requireAdminAction } from "@/lib/auth/boundaries";
import { revalidatePath } from "next/cache";
import {
  createAsset,
  addExternalAsset,
  updateAsset,
  createAssetRevision,
  addAssetRepresentation,
  setPrimaryAssetRepresentation,
  createUploadRequest,
  revokeUploadRequest,
  regenerateUploadRequest,
} from "@/lib/campaign";

import {
  createAssetMetadataAction,
  createExternalAssetAction,
  updateAssetMetadataAction,
  updateAssetWorkflowStatusAction,
  createAssetRevisionAction,
  addAssetRepresentationAction,
  setPrimaryAssetRepresentationAction,
} from "@/app/admin/assets/actions";

import {
  createUploadRequestAction,
  revokeUploadRequestAction,
  regenerateUploadRequestAction,
} from "@/app/admin/upload-links/actions";

describe("Admin Asset Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createAssetMetadataAction", () => {
    it("enforces admin authentication", async () => {
      (requireAdminAction as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("UNAUTHENTICATED"),
      );
      const fd = new FormData();
      fd.set("name", "Poster 1");
      fd.set("kind", "poster");

      await expect(createAssetMetadataAction(null, fd)).rejects.toThrow("UNAUTHENTICATED");
    });

    it("creates metadata asset and revalidates paths on success", async () => {
      (createAsset as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        data: { id: "a1", name: "Poster 1", kind: "poster", status: "DRAFT", version: 1 },
      });

      const fd = new FormData();
      fd.set("name", "Poster 1");
      fd.set("kind", "poster");
      fd.set("status", "DRAFT");
      fd.set("notes", "Print notes");

      const result = await createAssetMetadataAction(null, fd);

      expect(result.ok).toBe(true);
      expect(createAsset).toHaveBeenCalledWith(
        {
          name: "Poster 1",
          kind: "poster",
          status: "DRAFT",
          notes: "Print notes",
        },
        "admin",
      );
      expect(revalidatePath).toHaveBeenCalledWith("/admin");
      expect(revalidatePath).toHaveBeenCalledWith("/admin/assets");
    });

    it("returns error feedback when domain service fails", async () => {
      (createAsset as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "APPROVED assets require at least one representation on the latest revision.",
        },
      });

      const fd = new FormData();
      fd.set("name", "Poster 1");
      fd.set("kind", "poster");
      fd.set("status", "APPROVED");

      const result = await createAssetMetadataAction(null, fd);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION_ERROR");
        expect(result.error).toContain("APPROVED assets require at least one representation");
      }
    });
  });

  describe("createExternalAssetAction", () => {
    it("creates external asset and representation atomically", async () => {
      (addExternalAsset as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        data: { id: "a2", name: "Video Master", kind: "video" },
      });

      const fd = new FormData();
      fd.set("name", "Video Master");
      fd.set("kind", "video");
      fd.set("externalUrl", "https://vimeo.com/123456");
      fd.set("label", "4K Cut");
      fd.set("format", "ProRes");

      const result = await createExternalAssetAction(null, fd);

      expect(result.ok).toBe(true);
      expect(addExternalAsset).toHaveBeenCalledWith(
        {
          asset: {
            name: "Video Master",
            kind: "video",
            status: "DRAFT",
            notes: null,
          },
          representation: {
            externalUrl: "https://vimeo.com/123456",
            label: "4K Cut",
            variant: null,
            format: "ProRes",
            sourceFilename: null,
            notes: null,
          },
        },
        "admin",
      );
      expect(revalidatePath).toHaveBeenCalledWith("/admin");
      expect(revalidatePath).toHaveBeenCalledWith("/admin/assets");
    });
  });

  describe("updateAssetMetadataAction", () => {
    it("updates metadata and revalidates detail path", async () => {
      (updateAsset as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        data: { id: "a1", name: "New Name", kind: "poster", version: 2 },
      });

      const fd = new FormData();
      fd.set("id", "a1");
      fd.set("expectedVersion", "1");
      fd.set("name", "New Name");
      fd.set("kind", "poster");

      const result = await updateAssetMetadataAction(null, fd);

      expect(result.ok).toBe(true);
      expect(updateAsset).toHaveBeenCalledWith(
        {
          id: "a1",
          expectedVersion: 1,
          changes: {
            name: "New Name",
            kind: "poster",
            notes: null,
          },
        },
        "admin",
      );
      expect(revalidatePath).toHaveBeenCalledWith("/admin/assets/a1");
    });

    it("handles version conflict errors", async () => {
      (updateAsset as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        error: {
          code: "VERSION_CONFLICT",
          message: "Version conflict on asset a1. Expected version 1.",
        },
      });

      const fd = new FormData();
      fd.set("id", "a1");
      fd.set("expectedVersion", "1");
      fd.set("name", "New Name");

      const result = await updateAssetMetadataAction(null, fd);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VERSION_CONFLICT");
      }
    });
  });

  describe("updateAssetWorkflowStatusAction", () => {
    it("updates workflow status", async () => {
      (updateAsset as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        data: { id: "a1", status: "APPROVED", version: 2 },
      });

      const fd = new FormData();
      fd.set("id", "a1");
      fd.set("expectedVersion", "1");
      fd.set("status", "APPROVED");

      const result = await updateAssetWorkflowStatusAction(null, fd);

      expect(result.ok).toBe(true);
      expect(updateAsset).toHaveBeenCalledWith(
        {
          id: "a1",
          expectedVersion: 1,
          changes: { status: "APPROVED" },
        },
        "admin",
      );
    });
  });

  describe("createAssetRevisionAction", () => {
    it("creates a new revision", async () => {
      (createAssetRevision as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        data: {
          assetId: "a1",
          assetVersion: 2,
          revision: { id: "r2", revisionNumber: 2 },
        },
      });

      const fd = new FormData();
      fd.set("assetId", "a1");
      fd.set("expectedVersion", "1");
      fd.set("label", "Remaster");

      const result = await createAssetRevisionAction(null, fd);

      expect(result.ok).toBe(true);
      expect(createAssetRevision).toHaveBeenCalledWith(
        {
          assetId: "a1",
          expectedVersion: 1,
          label: "Remaster",
          notes: null,
        },
        "admin",
      );
      expect(revalidatePath).toHaveBeenCalledWith("/admin/assets/a1");
    });
  });

  describe("addAssetRepresentationAction", () => {
    it("appends external representation to revision", async () => {
      (addAssetRepresentation as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        data: {
          assetId: "a1",
          assetVersion: 2,
          representation: { id: "rep1", externalUrl: "https://example.com/asset.png" },
        },
      });

      const fd = new FormData();
      fd.set("assetId", "a1");
      fd.set("assetRevisionId", "r1");
      fd.set("expectedVersion", "1");
      fd.set("externalUrl", "https://example.com/asset.png");
      fd.set("format", "PNG");

      const result = await addAssetRepresentationAction(null, fd);

      expect(result.ok).toBe(true);
      expect(addAssetRepresentation).toHaveBeenCalledWith(
        {
          assetRevisionId: "r1",
          expectedVersion: 1,
          representation: {
            externalUrl: "https://example.com/asset.png",
            label: null,
            variant: null,
            format: "PNG",
            sourceFilename: null,
            notes: null,
          },
        },
        "admin",
      );
    });
  });

  describe("setPrimaryAssetRepresentationAction", () => {
    it("switches primary representation", async () => {
      (setPrimaryAssetRepresentation as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        data: {
          assetId: "a1",
          assetVersion: 2,
          assetRevisionId: "r1",
          primaryRepresentationId: "rep2",
        },
      });

      const fd = new FormData();
      fd.set("assetId", "a1");
      fd.set("representationId", "rep2");
      fd.set("expectedVersion", "1");

      const result = await setPrimaryAssetRepresentationAction(null, fd);

      expect(result.ok).toBe(true);
      expect(setPrimaryAssetRepresentation).toHaveBeenCalledWith(
        {
          representationId: "rep2",
          expectedVersion: 1,
        },
        "admin",
      );
    });
  });
});

describe("Admin Upload Links Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createUploadRequestAction", () => {
    it("creates upload request and returns raw URL", async () => {
      (createUploadRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        data: {
          id: "req1",
          uploadUrl: "http://localhost:3000/upload/testToken123456789012345678901234567890123",
          expiresAt: "2026-09-13T00:00:00.000Z",
        },
      });

      const fd = new FormData();
      fd.set("title", "Artwork Request");
      fd.set("instructions", "Submit SVGs");
      fd.set("expiresInDays", "7");
      fd.set("maxItems", "20");

      const result = await createUploadRequestAction(null, fd);

      expect(result.ok).toBe(true);
      expect(createUploadRequest).toHaveBeenCalledWith(
        {
          title: "Artwork Request",
          instructions: "Submit SVGs",
          expiresInDays: 7,
          maxItems: 20,
          targetAssetId: undefined,
          targetRevisionId: undefined,
        },
        "admin",
      );
      expect(revalidatePath).toHaveBeenCalledWith("/admin/upload-links");
    });
  });

  describe("revokeUploadRequestAction", () => {
    it("revokes upload request and revalidates paths", async () => {
      (revokeUploadRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        data: { id: "req1", status: "REVOKED" },
      });

      const fd = new FormData();
      fd.set("id", "req1");

      const result = await revokeUploadRequestAction(null, fd);

      expect(result.ok).toBe(true);
      expect(revokeUploadRequest).toHaveBeenCalledWith({ id: "req1" }, "admin");
      expect(revalidatePath).toHaveBeenCalledWith("/admin/upload-links/req1");
    });
  });

  describe("regenerateUploadRequestAction", () => {
    it("regenerates upload request and returns replacement link", async () => {
      (regenerateUploadRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        data: {
          id: "req2",
          replacedId: "req1",
          uploadUrl: "http://localhost:3000/upload/newToken1234567890123456789012345678901234",
          expiresAt: "2026-09-13T00:00:00.000Z",
        },
      });

      const fd = new FormData();
      fd.set("id", "req1");

      const result = await regenerateUploadRequestAction(null, fd);

      expect(result.ok).toBe(true);
      expect(regenerateUploadRequest).toHaveBeenCalledWith({ id: "req1" }, "admin");
      expect(revalidatePath).toHaveBeenCalledWith("/admin/upload-links/req1");
      expect(revalidatePath).toHaveBeenCalledWith("/admin/upload-links/req2");
    });
  });
});
