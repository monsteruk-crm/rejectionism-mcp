import { afterAll, describe, expect, test } from "vitest";
import {
  createAsset,
  createCanonEntry,
  createContact,
  createContentItem,
  createWebsite,
  createWorkItem,
  getAssetById,
  getCanon,
  getContactById,
  getContentItemById,
  getWebsiteById,
  listActivity,
  listDecisions,
  listWorkItems,
  recordDecision,
  updateWorkItem,
} from "@/lib/campaign";
import { getPrisma } from "@/lib/prisma";

const runId = `integration-${Date.now()}`;
const ids = {
  asset: `${runId}-asset`,
  canon: `${runId}-canon`,
  contact: `${runId}-contact`,
  content: `${runId}-content`,
  decision: `${runId}-decision`,
  successor: `${runId}-successor`,
  website: `${runId}-website`,
  work: `${runId}-work`,
};

function expectOk<T>(result: { ok: true; data: T } | { ok: false; error: unknown }): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.data;
}

afterAll(async () => {
  const prisma = getPrisma();
  await prisma.activity.deleteMany({ where: { entityId: { startsWith: runId } } });
  await prisma.decision.deleteMany({ where: { id: { in: [ids.successor, ids.decision] } } });
  await prisma.workItem.deleteMany({ where: { id: ids.work } });
  await prisma.asset.deleteMany({ where: { id: ids.asset } });
  await prisma.website.deleteMany({ where: { id: ids.website } });
  await prisma.contact.deleteMany({ where: { id: ids.contact } });
  await prisma.contentItem.deleteMany({ where: { id: ids.content } });
  await prisma.canonEntry.deleteMany({ where: { id: ids.canon } });
  await prisma.$disconnect();
});

describe("Campaign services against disposable PostgreSQL", () => {
  test("migration and seed data are readable", async () => {
    const canon = expectOk(await getCanon({ key: "movement.name" }));
    expect(canon.mode).toBe("single");
  });

  test("work-item CRUD audits changes and rejects a stale version", async () => {
    const created = expectOk(
      await createWorkItem({ id: ids.work, title: runId, description: "", priority: 9 }),
    );
    expect(expectOk(await listWorkItems({ search: runId })).items).toHaveLength(1);

    const updated = expectOk(
      await updateWorkItem({
        id: ids.work,
        expectedVersion: created.version,
        changes: { priority: 10 },
      }),
    );
    expect(updated.version).toBe(2);

    const stale = await updateWorkItem({
      id: ids.work,
      expectedVersion: created.version,
      changes: { priority: 11 },
    });
    expect(stale).toMatchObject({ ok: false, error: { code: "VERSION_CONFLICT" } });
    const activity = expectOk(await listActivity({ entityType: "WORK_ITEM", limit: 100 }));
    expect(activity.items.filter((item: any) => item.entityId === ids.work)).toHaveLength(2);
  });

  test("failed transactional validation creates neither data nor audit", async () => {
    const invalidId = `${runId}-invalid`;
    const result = await createWorkItem({
      id: invalidId,
      title: "Invalid done item",
      description: "",
      status: "DONE",
    });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(await getPrisma().workItem.findUnique({ where: { id: invalidId } })).toBeNull();
    expect(await getPrisma().activity.count({ where: { entityId: invalidId } })).toBe(0);
  });

  test("asset, website, contact, and content CRUD paths persist readable records", async () => {
    expectOk(await createAsset({ id: ids.asset, name: runId, kind: "test", status: "DRAFT" }));
    expect(expectOk(await getAssetById(ids.asset)).name).toBe(runId);

    expectOk(
      await createWebsite({
        id: ids.website,
        name: runId,
        domain: `${runId}.example.com`,
        purpose: "Integration verification",
      }),
    );
    expect(expectOk(await getWebsiteById(ids.website)).domain).toContain(runId);

    expectOk(await createContact({ id: ids.contact, name: runId }));
    expect(expectOk(await getContactById(ids.contact)).name).toBe(runId);

    expectOk(
      await createContentItem({
        id: ids.content,
        title: runId,
        format: "test",
        channel: "integration",
      }),
    );
    expect(expectOk(await getContentItemById(ids.content)).title).toBe(runId);
  });

  test("decision supersession and canon creation are atomic", async () => {
    expectOk(
      await createCanonEntry({
        id: ids.canon,
        key: `${runId}.key`,
        value: "initial",
        category: "integration",
      }),
    );
    expectOk(
      await recordDecision({
        id: ids.decision,
        subject: runId,
        decision: "Initial decision",
        rationale: "Integration verification",
      }),
    );
    const successor = expectOk(
      await recordDecision({
        id: ids.successor,
        subject: `${runId} successor`,
        decision: "Successor decision",
        rationale: "Integration verification",
        supersedesId: ids.decision,
        updateCanon: {
          mode: "update",
          key: `${runId}.key`,
          value: "updated",
          expectedVersion: 1,
        },
      }),
    );
    expect(successor.supersedesId).toBe(ids.decision);
    const decisions = expectOk(await listDecisions({ limit: 100 }));
    expect(decisions.items.find((item) => item.id === ids.decision)?.supersededById).toBe(
      ids.successor,
    );
    const canon = expectOk(await getCanon({ key: `${runId}.key` }));
    expect(canon.mode === "single" && canon.entry.value).toBe("updated");

    const failedDecisionId = `${runId}-failed-decision`;
    const failed = await recordDecision({
      id: failedDecisionId,
      subject: "Must roll back",
      decision: "No record",
      rationale: "Stale canon version",
      updateCanon: {
        mode: "update",
        key: `${runId}.key`,
        value: "must not persist",
        expectedVersion: 1,
      },
    });
    expect(failed).toMatchObject({ ok: false, error: { code: "VERSION_CONFLICT" } });
    expect(await getPrisma().decision.findUnique({ where: { id: failedDecisionId } })).toBeNull();
    expect(await getPrisma().activity.count({ where: { entityId: failedDecisionId } })).toBe(0);
  });
});
