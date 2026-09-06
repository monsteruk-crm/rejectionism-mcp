import { afterAll, describe, expect, test } from "vitest";
import {
  addAssetRepresentation,
  createAsset,
  createAssetRevision,
  getAssetById,
  listAssets,
  registerAsset,
  setPrimaryAssetRepresentation,
  updateAsset,
} from "@/lib/campaign";
import { getPrisma } from "@/lib/prisma";

const runId = `int-assets-${Date.now()}`;
const ids = {
  workflow: `${runId}-workflow`,
  emptyApproved: `${runId}-empty-approved`,
  legacy: `${runId}-legacy`,
  registered: `${runId}-registered`,
};

function expectOk<T>(result: { ok: true; data: T } | { ok: false; error: unknown }): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.data;
}

afterAll(async () => {
  const prisma = getPrisma();
  // Restrict foreign keys require deleting children before parents, scoped to
  // this run's records only (never a table-wide delete).
  await prisma.activity.deleteMany({ where: { entityId: { startsWith: runId } } });
  const assets = await prisma.asset.findMany({
    where: { id: { startsWith: runId } },
    select: { id: true },
  });
  const assetIds = assets.map((asset) => asset.id);
  const revisions = await prisma.assetRevision.findMany({
    where: { assetId: { in: assetIds } },
    select: { id: true },
  });
  await prisma.assetRepresentation.deleteMany({
    where: { assetRevisionId: { in: revisions.map((revision) => revision.id) } },
  });
  await prisma.assetRevision.deleteMany({ where: { assetId: { in: assetIds } } });
  await prisma.asset.deleteMany({ where: { id: { in: assetIds } } });
  await prisma.$disconnect();
});

describe("Asset revision and representation services", () => {
  test("external-only representations follow the primary and numbering rules", async () => {
    // Filename-only creation: revision 1 exists with no representations.
    const created = expectOk(
      await createAsset({ id: ids.workflow, name: runId, kind: "test" }),
    );
    expect(created.version).toBe(1);

    const detail = expectOk(await getAssetById(ids.workflow));
    expect(detail.revisions).toHaveLength(1);
    expect(detail.latestRevisionNumber).toBe(1);
    expect(detail.primaryRepresentationId).toBeNull();
    expect(detail.revisions[0]!.representations).toHaveLength(0);

    // Empty revision append keeps the status and numbers sequentially.
    const revision = expectOk(
      await createAssetRevision({ assetId: ids.workflow, expectedVersion: 1 }),
    );
    expect(revision.assetVersion).toBe(2);
    expect(revision.revision.revisionNumber).toBe(2);

    // The first representation on an empty revision becomes primary.
    const firstRep = expectOk(
      await addAssetRepresentation({
        assetRevisionId: revision.revision.id,
        expectedVersion: 2,
        representation: { externalUrl: "https://example.com/first.png" },
      }),
    );
    expect(firstRep.assetVersion).toBe(3);
    expect(firstRep.representation.isPrimary).toBe(true);

    // Appends to a revision that already has representations never change the primary.
    const secondRep = expectOk(
      await addAssetRepresentation({
        assetRevisionId: revision.revision.id,
        expectedVersion: 3,
        representation: { externalUrl: "https://example.com/second.png" },
      }),
    );
    expect(secondRep.representation.isPrimary).toBe(false);

    // Switching the primary to the non-primary representation bumps the
    // parent version exactly once.
    const switched = expectOk(
      await setPrimaryAssetRepresentation({
        representationId: secondRep.representation.id,
        expectedVersion: 4,
      }),
    );
    expect(switched.primaryRepresentationId).toBe(secondRep.representation.id);
    expect(switched.assetVersion).toBe(5);

    // Already-primary with a current version is a no-op: same version, no Activity.
    const activityBefore = await getPrisma().activity.count({
      where: { entityId: ids.workflow },
    });
    const noOp = expectOk(
      await setPrimaryAssetRepresentation({
        representationId: secondRep.representation.id,
        expectedVersion: 5,
      }),
    );
    expect(noOp.assetVersion).toBe(5);
    expect(
      await getPrisma().activity.count({ where: { entityId: ids.workflow } }),
    ).toBe(activityBefore);

    // Detail reflects the latest revision primary, revisions sorted descending.
    const detailAfter = expectOk(await getAssetById(ids.workflow));
    expect(detailAfter.revisions[0]!.revisionNumber).toBe(2);
    expect(detailAfter.latestRevisionNumber).toBe(2);
    expect(detailAfter.primaryRepresentationId).toBe(secondRep.representation.id);
  });

  test("stale version conflicts roll back without audit", async () => {
    const activityBefore = await getPrisma().activity.count({
      where: { entityId: ids.workflow },
    });
    const stale = await createAssetRevision({
      assetId: ids.workflow,
      expectedVersion: 1,
    });
    expect(stale).toMatchObject({ ok: false, error: { code: "VERSION_CONFLICT" } });
    expect(
      await getPrisma().activity.count({ where: { entityId: ids.workflow } }),
    ).toBe(activityBefore);
  });

  test("SUPERSEDED assets reject content until explicitly restored", async () => {
    const superseded = expectOk(
      await updateAsset({
        id: ids.workflow,
        expectedVersion: 5,
        changes: { status: "SUPERSEDED" },
      }),
    );
    expect(superseded.version).toBe(6);
    expect(superseded.status).toBe("SUPERSEDED");

    const revisionAttempt = await createAssetRevision({
      assetId: ids.workflow,
      expectedVersion: 6,
    });
    expect(revisionAttempt).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });

    // URL appends are content changes and are rejected as well, without audit.
    const activityBefore = await getPrisma().activity.count({
      where: { entityId: ids.workflow },
    });
    const appendAttempt = await updateAsset({
      id: ids.workflow,
      expectedVersion: 6,
      changes: { url: "https://example.com/blocked.png" },
    });
    expect(appendAttempt).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(
      await getPrisma().activity.count({ where: { entityId: ids.workflow } }),
    ).toBe(activityBefore);

    const restored = expectOk(
      await updateAsset({
        id: ids.workflow,
        expectedVersion: 6,
        changes: { status: "DRAFT" },
      }),
    );
    expect(restored.version).toBe(7);

    const revision = expectOk(
      await createAssetRevision({ assetId: ids.workflow, expectedVersion: 7 }),
    );
    expect(revision.revision.revisionNumber).toBe(3);
  });

  test("APPROVED status requires a representation on the latest revision", async () => {
    expectOk(
      await createAsset({ id: ids.emptyApproved, name: runId, kind: "test" }),
    );

    const denied = await updateAsset({
      id: ids.emptyApproved,
      expectedVersion: 1,
      changes: { status: "APPROVED" },
    });
    expect(denied).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    // The whole transaction rolled back, including the version bump.
    expect(
      await getPrisma().asset.findUnique({ where: { id: ids.emptyApproved } }),
    ).toMatchObject({ version: 1 });

    const detail = expectOk(await getAssetById(ids.emptyApproved));
    const revisionOne = detail.revisions.find((revision) => revision.revisionNumber === 1);
    expect(revisionOne).toBeDefined();
    const rep = expectOk(
      await addAssetRepresentation({
        assetRevisionId: revisionOne!.id,
        expectedVersion: 1,
        representation: { externalUrl: "https://example.com/approved.png" },
      }),
    );
    expect(rep.assetVersion).toBe(2);

    const approved = expectOk(
      await updateAsset({
        id: ids.emptyApproved,
        expectedVersion: 2,
        changes: { status: "APPROVED" },
      }),
    );
    expect(approved.status).toBe("APPROVED");
  });
});

describe("Legacy asset URL compatibility", () => {
  test("different URLs append revisions, same-string saves and clears do not", async () => {
    expectOk(
      await createAsset({
        id: ids.legacy,
        name: runId,
        kind: "test",
        url: "https://example.com/legacy.png",
      }),
    );

    // Creation with a URL produces revision 1 plus the primary representation,
    // carrying the legacyAssetId marker so the backfill never duplicates it.
    const markersAfterCreate = await getPrisma().assetRepresentation.findMany({
      where: { legacyAssetId: ids.legacy },
      select: { externalUrl: true },
    });
    expect(markersAfterCreate).toHaveLength(1);
    expect(markersAfterCreate[0]!.externalUrl).toBe("https://example.com/legacy.png");

    // A same-string URL save bumps the version but creates no revision.
    const sameString = expectOk(
      await updateAsset({
        id: ids.legacy,
        expectedVersion: 1,
        changes: { url: "https://example.com/legacy.png" },
      }),
    );
    expect(sameString.version).toBe(2);
    const afterSameString = expectOk(await getAssetById(ids.legacy));
    expect(afterSameString.revisions).toHaveLength(1);

    // A different non-null URL appends a new revision with a primary
    // EXTERNAL_URL representation; the marker stays on the original one.
    const appended = expectOk(
      await updateAsset({
        id: ids.legacy,
        expectedVersion: 2,
        changes: { url: "https://example.com/updated.png" },
      }),
    );
    expect(appended.version).toBe(3);
    expect(appended.url).toBe("https://example.com/updated.png");

    const afterAppend = expectOk(await getAssetById(ids.legacy));
    expect(afterAppend.revisions).toHaveLength(2);
    expect(afterAppend.latestRevisionNumber).toBe(2);
    expect(afterAppend.revisions[0]!.representations).toHaveLength(1);
    expect(afterAppend.revisions[0]!.representations[0]!.externalUrl).toBe(
      "https://example.com/updated.png",
    );
    expect(afterAppend.revisions[0]!.representations[0]!.isPrimary).toBe(true);

    const markersAfterAppend = await getPrisma().assetRepresentation.findMany({
      where: { legacyAssetId: ids.legacy },
      select: { externalUrl: true },
    });
    expect(markersAfterAppend).toHaveLength(1);
    expect(markersAfterAppend[0]!.externalUrl).toBe("https://example.com/legacy.png");

    // Repeating the new URL is a same-string no-op: still two revisions.
    const repeat = expectOk(
      await updateAsset({
        id: ids.legacy,
        expectedVersion: 3,
        changes: { url: "https://example.com/updated.png" },
      }),
    );
    expect(repeat.version).toBe(4);
    const afterRepeat = expectOk(await getAssetById(ids.legacy));
    expect(afterRepeat.revisions).toHaveLength(2);

    // Clearing the URL clears only the column; representations are untouched.
    const cleared = expectOk(
      await updateAsset({
        id: ids.legacy,
        expectedVersion: 4,
        changes: { url: null },
      }),
    );
    expect(cleared.url).toBeNull();
    const afterClear = expectOk(await getAssetById(ids.legacy));
    expect(afterClear.url).toBeNull();
    expect(afterClear.revisions).toHaveLength(2);
    expect(afterClear.revisions[0]!.representations).toHaveLength(1);
  });
});

describe("registerAsset compatibility and list DTOs", () => {
  test("registerAsset dispatches create and update without the discriminator", async () => {
    const registered = expectOk(
      await registerAsset({
        action: "create",
        id: ids.registered,
        name: runId,
        kind: "test",
      }),
    );
    expect(registered.version).toBe(1);
    expect(registered.name).toBe(runId);

    const updated = expectOk(
      await registerAsset({
        action: "update",
        id: ids.registered,
        expectedVersion: 1,
        changes: { name: `${runId}-renamed` },
      }),
    );
    expect(updated.name).toBe(`${runId}-renamed`);
    expect(updated.version).toBe(2);
  });

  test("listAssets enriches the page with revision summaries", async () => {
    const listed = expectOk(await listAssets({ kind: "test", limit: 100 }));

    const workflow = listed.items.find((item) => item.id === ids.workflow);
    expect(workflow).toBeDefined();
    expect(workflow!.revisionCount).toBe(3);
    expect(workflow!.latestRevisionNumber).toBe(3);
    // The latest workflow revision is empty, so there is no primary pointer.
    expect(workflow!.primaryRepresentation).toBeNull();
    expect(workflow!.storageTypes).toEqual(["EXTERNAL_URL"]);
    expect(workflow!.tags).toEqual([]);

    const legacy = listed.items.find((item) => item.id === ids.legacy);
    expect(legacy).toBeDefined();
    expect(legacy!.revisionCount).toBe(2);
    expect(legacy!.primaryRepresentation?.externalUrl).toBe("https://example.com/updated.png");
    expect(legacy!.storageTypes).toEqual(["EXTERNAL_URL"]);
  });
});
