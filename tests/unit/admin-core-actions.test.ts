import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createWorkItemAction,
  updateWorkItemAction,
  createCanonEntryAction,
  updateCanonEntryAction,
} from "../../app/admin/actions";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/boundaries", () => ({
  requireAdminAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/campaign", () => ({
  createWorkItem: vi.fn().mockImplementation((input) => {
    if (!input.title) {
      return Promise.resolve({
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "Title required", fieldErrors: { title: ["Title required"] } },
      });
    }
    return Promise.resolve({
      ok: true,
      data: { id: "item-123", title: input.title, version: 1 },
    });
  }),
  updateWorkItem: vi.fn().mockImplementation((input) => {
    if (input.expectedVersion === 1) {
      return Promise.resolve({
        ok: false,
        error: { code: "VERSION_CONFLICT", message: "Stale version" },
      });
    }
    return Promise.resolve({
      ok: true,
      data: { id: input.id, title: "Updated Title", version: input.expectedVersion + 1 },
    });
  }),
  createCanonEntry: vi.fn().mockResolvedValue({
    ok: true,
    data: { id: "canon-1", key: "test.key" },
  }),
  updateCanonEntry: vi.fn().mockResolvedValue({
    ok: true,
    data: { id: "canon-1", key: "test.key", version: 2 },
  }),
}));

describe("app/admin/actions.ts", () => {
  it("createWorkItemAction returns ok: true on success", async () => {
    const formData = new FormData();
    formData.append("title", "New Task");
    formData.append("status", "BACKLOG");

    const result = await createWorkItemAction(null, formData);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.data as any).id).toBe("item-123");
    }
  });

  it("createWorkItemAction returns ok: false and fieldErrors on validation failure", async () => {
    const formData = new FormData();
    // Missing title

    const result = await createWorkItemAction(null, formData);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_ERROR");
      expect(result.fieldErrors?.title).toBeDefined();
    }
  });

  it("updateWorkItemAction returns VERSION_CONFLICT code without throwing", async () => {
    const formData = new FormData();
    formData.append("id", "item-123");
    formData.append("expectedVersion", "1");
    formData.append("title", "Conflicted Edit");

    const result = await updateWorkItemAction(null, formData);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VERSION_CONFLICT");
    }
  });
});
