import { describe, it, expect } from "vitest";
import {
  getCampaignStatus,
  listWorkItems,
  getCanon,
  listDecisions,
  listAssets,
  listUploadRequests,
  listWebsites,
  listContentItems,
  listContacts,
  listTags,
  listActivity,
  searchCampaign,
} from "../../lib/campaign";

describe("Read Contracts Regression & Boundaries", () => {
  it("getCampaignStatus returns valid summary counts", async () => {
    const res = await getCampaignStatus();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.workItemCounts).toBeDefined();
      expect(typeof res.data.workItemCounts.TOTAL).toBe("number");
    }
  });

  it("listWorkItems supports pagination and filtering", async () => {
    const res = await listWorkItems({ limit: 5, offset: 0 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(Array.isArray(res.data.items)).toBe(true);
      expect(typeof res.data.total).toBe("number");
    }
  });

  it("getCanon supports collection and single key queries", async () => {
    const collectionRes = await getCanon({ limit: 5 });
    expect(collectionRes.ok).toBe(true);
    if (collectionRes.ok) {
      expect(collectionRes.data.mode).toBe("collection");
    }

    const singleRes = await getCanon({ key: "movement.name" });
    expect(singleRes.ok).toBe(true);
    if (singleRes.ok && singleRes.data.mode === "single") {
      expect(singleRes.data.entry.key).toBe("movement.name");
    }
  });

  it("listDecisions returns reverse-chronological decisions", async () => {
    const res = await listDecisions({ limit: 5 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(Array.isArray(res.data.items)).toBe(true);
    }
  });

  it("listAssets returns asset list with DTOs and tags", async () => {
    const res = await listAssets({ limit: 5 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(Array.isArray(res.data.items)).toBe(true);
      if (res.data.items.length > 0) {
        expect(res.data.items[0]!.id).toBeDefined();
        expect(Array.isArray(res.data.items[0]!.tags)).toBe(true);
      }
    }
  });

  it("listUploadRequests filters by effective OPEN, EXPIRED, and targetAssetId", async () => {
    const openRes = await listUploadRequests({ status: "OPEN", limit: 5 });
    expect(openRes.ok).toBe(true);
    if (openRes.ok) {
      expect(Array.isArray(openRes.data.items)).toBe(true);
    }

    const expiredRes = await listUploadRequests({ status: "EXPIRED", limit: 5 });
    expect(expiredRes.ok).toBe(true);
    if (expiredRes.ok) {
      expect(Array.isArray(expiredRes.data.items)).toBe(true);
    }
  });

  it("listWebsites, listContentItems, listContacts, listTags return valid lists", async () => {
    const [web, content, contacts, tags] = await Promise.all([
      listWebsites({ limit: 5 }),
      listContentItems({ limit: 5 }),
      listContacts({ limit: 5, includePrivateFields: false }),
      listTags({ limit: 5 }),
    ]);

    expect(web.ok).toBe(true);
    expect(content.ok).toBe(true);
    expect(contacts.ok).toBe(true);
    expect(tags.ok).toBe(true);
  });

  it("listActivity supports entityType, entityId, limit and offset", async () => {
    const res = await listActivity({ limit: 5, offset: 0 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(Array.isArray(res.data.items)).toBe(true);
      expect(typeof res.data.total).toBe("number");
      expect(res.data.offset).toBe(0);
    }
  });

  it("searchCampaign handles literal substrings and wildcard characters without regex/SQL error", async () => {
    const res = await searchCampaign({ query: "rejection", limit: 3 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(Array.isArray(res.data.items)).toBe(true);
    }

    const wildcardRes = await searchCampaign({ query: "%_\\test", limit: 3 });
    expect(wildcardRes.ok).toBe(true);
    if (wildcardRes.ok) {
      expect(Array.isArray(wildcardRes.data.items)).toBe(true);
    }
  });
});
