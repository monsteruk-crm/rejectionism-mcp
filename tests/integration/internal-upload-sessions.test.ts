import { describe, it, expect } from "vitest";
import {
  createAdminUploadSession,
  listAdminUploadSessions,
  cancelAdminUploadSession,
  getUploadRequest,
  listUploadRequests,
  regenerateUploadRequest,
  revokeUploadRequest,
} from "../../lib/campaign";

describe("Internal Upload Sessions Integration", () => {
  it("creates an internal admin upload session with ADMIN_INTERNAL purpose", async () => {
    const res = await createAdminUploadSession();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.id).toBeDefined();
      expect(res.data.status).toBe("OPEN");
      expect(res.data.effectiveStatus).toBe("OPEN");
      expect(res.data.maxItems).toBe(50);
      expect((res.data as any).uploadUrl).toBeUndefined();

      // Cancel session
      const cancelRes = await cancelAdminUploadSession(res.data.id);
      expect(cancelRes.ok).toBe(true);
      if (cancelRes.ok) {
        expect(cancelRes.data.status).toBe("REVOKED");
      }
    }
  });

  it("lists internal upload sessions separately from contributor links", async () => {
    const session = await createAdminUploadSession();
    expect(session.ok).toBe(true);

    if (session.ok) {
      const internalList = await listAdminUploadSessions({ limit: 10 });
      expect(internalList.ok).toBe(true);
      if (internalList.ok) {
        const found = internalList.data.items.some((i) => i.id === session.data.id);
        expect(found).toBe(true);
      }

      const contributorList = await listUploadRequests({ limit: 100 });
      expect(contributorList.ok).toBe(true);
      if (contributorList.ok) {
        expect(contributorList.data.items.some((i) => i.id === session.data.id)).toBe(false);
      }
      expect(await getUploadRequest({ id: session.data.id })).toMatchObject({
        ok: false,
        error: { code: "NOT_FOUND" },
      });
      expect(await revokeUploadRequest({ id: session.data.id })).toMatchObject({
        ok: false,
        error: { code: "NOT_FOUND" },
      });
      expect(await regenerateUploadRequest({ id: session.data.id })).toMatchObject({
        ok: false,
        error: { code: "NOT_FOUND" },
      });

      // Cleanup session
      await cancelAdminUploadSession(session.data.id);
    }
  });
});
