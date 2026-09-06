import { afterAll, describe, expect, test } from "vitest";
import { backfillLegacyAssets } from "@/lib/campaign/asset-backfill";
import { createAsset } from "@/lib/campaign";
import { seedCampaignData } from "@/lib/campaign/seed";
import { isExternalHttpUrl } from "@/lib/campaign/external-url";
import { SEED_ASSETS } from "../../prisma/seed-data";
import { getPrisma } from "@/lib/prisma";

const runId = `asset-migration-${Date.now()}`;

const fixture = {
  withValidUrl: {
    id: `${runId}-valid-url`,
    name: `${runId} valid url`,
    kind: "test",
    status: "DRAFT" as const,
    sourceFilename: "primary-seal.png",
    url: "https://example.com/fixtures/primary-seal.png",
    notes: null,
  },
  filenameOnly: {
    id: `${runId}-filename-only`,
    name: `${runId} filename only`,
    kind: "test",
    status: "MISSING" as const,
    sourceFilename: "lost-master.png",
    url: null,
    notes: null,
  },
  invalidUrl: {
    id: `${runId}-invalid-url`,
    name: `${runId} invalid url`,
    kind: "test",
    status: "DRAFT" as const,
    sourceFilename: "local-only.png",
    url: "http://127.0.0.1/local-secret.png",
    notes: null,
  },
  metadataOnly: {
    id: `${runId}-metadata-only`,
    name: `${runId} metadata only`,
    kind: "test",
    status: "DRAFT" as const,
    sourceFilename: null,
    url: null,
    notes: "metadata placeholder",
  },
};

const fixtureIds = [
  fixture.withValidUrl.id,
  fixture.filenameOnly.id,
  fixture.invalidUrl.id,
  fixture.metadataOnly.id,
];

async function createFixtureAssets() {
  const prisma = getPrisma();
  // Remove fixtures orphaned by an earlier aborted suite run (same run-family
  // prefix, so this is scoped cleanup, never a table-wide delete).
  const orphanRevisions = await prisma.assetRevision.findMany({
    where: { asset: { id: { startsWith: "asset-migration-" } } },
    select: { id: true },
  });
  await prisma.assetRepresentation.deleteMany({
    where: {
      OR: [
        { assetRevisionId: { in: orphanRevisions.map((revision) => revision.id) } },
        { legacyAsset: { id: { startsWith: "asset-migration-" } } },
      ],
    },
  });
  await prisma.activity.deleteMany({
    where: { entityType: "ASSET", entityId: { startsWith: "asset-migration-" } },
  });
  await prisma.assetRevision.deleteMany({
    where: { asset: { id: { startsWith: "asset-migration-" } } },
  });
  await prisma.asset.deleteMany({ where: { id: { startsWith: "asset-migration-" } } });

  // Deliberately bypass the service: these rows simulate pre-upgrade Assets
  // that must gain revision 1 through the migration/backfill, not at creation.
  await prisma.asset.createMany({
    data: [
      fixture.withValidUrl,
      fixture.filenameOnly,
      fixture.invalidUrl,
      fixture.metadataOnly,
    ],
  });
}

afterAll(async () => {
  const prisma = getPrisma();
  // Run-owned cleanup only: children before parents (Restrict foreign keys).
  await prisma.activity.deleteMany({ where: { entityId: { startsWith: runId } } });
  await prisma.activity.deleteMany({
    where: { entityType: "ASSET", entityId: { in: fixtureIds } },
  });
  await prisma.assetRepresentation.deleteMany({
    where: { OR: [{ legacyAssetId: { in: fixtureIds } }, { assetRevision: { assetId: { in: fixtureIds } } }] },
  });
  await prisma.assetRevision.deleteMany({ where: { assetId: { in: fixtureIds } } });
  await prisma.asset.deleteMany({ where: { id: { in: fixtureIds } } });
  await prisma.$disconnect();
});

describe("asset migration, backfill, and seed preservation", () => {
  test("backfill migrates valid legacy URLs and leaves everything else untouched", async () => {
    const prisma = getPrisma();
    await createFixtureAssets();

    const before = await prisma.asset.findMany({ where: { id: { in: fixtureIds } } });
    expect(before).toHaveLength(4);

    const firstRun = await backfillLegacyAssets();
    expect(firstRun.ok).toBe(true);
    if (!firstRun.ok) throw new Error(JSON.stringify(firstRun.error));

    // Valid URL: one primary EXTERNAL_URL representation on revision 1.
    const validAsset = before.find((asset) => asset.id === fixture.withValidUrl.id)!;
    const validRevision = await prisma.assetRevision.findUnique({
      where: {
        assetId_revisionNumber: { assetId: validAsset.id, revisionNumber: 1 },
      },
      include: { representations: true },
    });
    expect(validRevision).not.toBeNull();
    expect(validRevision!.representations).toHaveLength(1);
    const representation = validRevision!.representations[0];
    expect(representation).toMatchObject({
      storageType: "EXTERNAL_URL",
      externalUrl: fixture.withValidUrl.url,
      sourceFilename: fixture.withValidUrl.sourceFilename,
      legacyAssetId: validAsset.id,
      label: "Legacy reference",
      isPrimary: true,
      blobUrl: null,
      blobPathname: null,
      mimeType: null,
      byteSize: null,
      checksumSha256: null,
    });

    // Migrated activity exists exactly once, source system.
    const migratedActivity = await prisma.activity.findMany({
      where: { entityId: validAsset.id, action: "ASSET_LEGACY_REFERENCE_MIGRATED" },
    });
    expect(migratedActivity).toHaveLength(1);
    expect(migratedActivity[0].metadata).toMatchObject({ source: "system" });

    // Filename-only, invalid-URL, and metadata-only assets get revision 1 but
    // no representation; invalid URLs keep the original plain-text value.
    for (const fixtureCase of [fixture.filenameOnly, fixture.invalidUrl, fixture.metadataOnly]) {
      const revision = await prisma.assetRevision.findUnique({
        where: {
          assetId_revisionNumber: { assetId: fixtureCase.id, revisionNumber: 1 },
        },
        include: { representations: true },
      });
      expect(revision).not.toBeNull();
      expect(revision!.representations).toHaveLength(0);
      if (revision!.id.startsWith("legacy-revision-")) {
        expect(revision!.createdAt.getTime()).toBe(
          before.find((asset) => asset.id === fixtureCase.id)!.createdAt.getTime(),
        );
      }
    }
    const invalidAfter = await prisma.asset.findUnique({ where: { id: fixture.invalidUrl.id } });
    expect(invalidAfter?.url).toBe(fixture.invalidUrl.url);

    // Existing Asset columns, versions, and timestamps are never modified.
    const after = await prisma.asset.findMany({ where: { id: { in: fixtureIds } } });
    for (const original of before) {
      const current = after.find((asset) => asset.id === original.id)!;
      expect(current).toMatchObject({
        name: original.name,
        kind: original.kind,
        status: original.status,
        sourceFilename: original.sourceFilename,
        url: original.url,
        notes: original.notes,
        version: original.version,
        createdAt: original.createdAt,
        updatedAt: original.updatedAt,
      });
    }
  });

  test("repeated backfill creates no duplicates and updates nothing", async () => {
    const prisma = getPrisma();
    const beforeCounts = {
      revisions: await prisma.assetRevision.count({ where: { assetId: { in: fixtureIds } } }),
      representations: await prisma.assetRepresentation.count({
        where: { legacyAssetId: { in: fixtureIds } },
      }),
      migratedActivity: await prisma.activity.count({
        where: { entityId: { in: fixtureIds }, action: "ASSET_LEGACY_REFERENCE_MIGRATED" },
      }),
    };

    const secondRun = await backfillLegacyAssets();
    expect(secondRun.ok).toBe(true);
    if (!secondRun.ok) throw new Error(JSON.stringify(secondRun.error));

    // Our four fixtures are known state; totals may include other assets.
    expect(secondRun.data.representationsCreated).toBe(0);

    const afterCounts = {
      revisions: await prisma.assetRevision.count({ where: { assetId: { in: fixtureIds } } }),
      representations: await prisma.assetRepresentation.count({
        where: { legacyAssetId: { in: fixtureIds } },
      }),
      migratedActivity: await prisma.activity.count({
        where: { entityId: { in: fixtureIds }, action: "ASSET_LEGACY_REFERENCE_MIGRATED" },
      }),
    };
    expect(afterCounts).toEqual(beforeCounts);

    // The migrated fixture is recognized as already migrated on repeat runs.
    const validRevision = await prisma.assetRevision.findUnique({
      where: {
        assetId_revisionNumber: {
          assetId: fixture.withValidUrl.id,
          revisionNumber: 1,
        },
      },
      include: { representations: true },
    });
    expect(validRevision!.representations).toHaveLength(1);
  });

  test("asset creation writes revision 1 transactionally and backfill skips it", async () => {
    const prisma = getPrisma();
    const createdId = `${runId}-created-with-url`;

    const created = await createAsset({
      id: createdId,
      name: `${runId} created with url`,
      kind: "test",
      status: "DRAFT",
      sourceFilename: "created.png",
      url: "https://example.com/fixtures/created.png",
      notes: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error(JSON.stringify(created.error));
    fixtureIds.push(createdId);

    const revision = await prisma.assetRevision.findUnique({
      where: { assetId_revisionNumber: { assetId: createdId, revisionNumber: 1 } },
      include: { representations: true },
    });
    expect(revision).not.toBeNull();
    expect(revision!.representations).toHaveLength(1);
    expect(revision!.representations[0]).toMatchObject({
      storageType: "EXTERNAL_URL",
      externalUrl: "https://example.com/fixtures/created.png",
      legacyAssetId: createdId,
      isPrimary: true,
    });

    // A later backfill recognizes the marker and does not duplicate.
    const run = await backfillLegacyAssets();
    expect(run.ok).toBe(true);
    if (!run.ok) throw new Error(JSON.stringify(run.error));
    expect(
      await prisma.assetRepresentation.count({ where: { legacyAssetId: createdId } }),
    ).toBe(1);

    // New invalid URLs are rejected outright.
    const invalidId = `${runId}-created-invalid-url`;
    const rejected = await createAsset({
      id: invalidId,
      name: `${runId} created invalid url`,
      kind: "test",
      url: "http://127.0.0.1/rejected.png",
    });
    expect(rejected).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(await prisma.asset.findUnique({ where: { id: invalidId } })).toBeNull();
  });

  test("rerunning the seed leaves existing seed assets untouched and preserves human edits", async () => {
    const prisma = getPrisma();
    const seedAsset = SEED_ASSETS[0];

    // Simulate a human edit on seed-owned metadata.
    const editedNotes = `${runId} human-edited notes`;
    const edited = await prisma.asset.update({
      where: { id: seedAsset.id },
      data: { notes: editedNotes, version: { increment: 1 } },
    });
    const editedAt = new Date();

    const firstSeed = await seedCampaignData();
    expect(firstSeed.ok).toBe(true);
    const secondSeed = await seedCampaignData();
    expect(secondSeed.ok).toBe(true);
    if (!firstSeed.ok || !secondSeed.ok) throw new Error("seed failed");

    for (const summary of [firstSeed.data, secondSeed.data]) {
      expect(summary.assets.created).toBe(0);
      expect(summary.assets.updated).toBe(0);
      expect(summary.assets.unchanged).toBe(SEED_ASSETS.length);
    }

    const afterSeed = await prisma.asset.findUnique({ where: { id: seedAsset.id } });
    expect(afterSeed?.notes).toBe(editedNotes);
    expect(afterSeed?.version).toBe(edited.version);

    const updatedActivity = await prisma.activity.findMany({
      where: {
        entityType: "ASSET",
        entityId: seedAsset.id,
        action: "UPDATED",
        createdAt: { gt: editedAt },
      },
    });
    expect(updatedActivity).toHaveLength(0);
  });

  test("re-seeding a deleted seed asset rebuilds revision 1 without duplicates", async () => {
    const prisma = getPrisma();
    const seedAsset = SEED_ASSETS[1];
    const expectedRepresentations = isExternalHttpUrl(seedAsset.url ?? "") ? 1 : 0;

    // Remove the seed asset and its structures to exercise the creation path.
    await prisma.activity.deleteMany({ where: { entityId: seedAsset.id } });
    await prisma.assetRepresentation.deleteMany({
      where: { assetRevision: { assetId: seedAsset.id } },
    });
    await prisma.assetRevision.deleteMany({ where: { assetId: seedAsset.id } });
    await prisma.asset.deleteMany({ where: { id: seedAsset.id } });

    const seed = await seedCampaignData();
    expect(seed.ok).toBe(true);
    if (!seed.ok) throw new Error(JSON.stringify(seed.error));
    expect(seed.data.assets.created).toBe(1);

    const rebuiltRevision = await prisma.assetRevision.findUnique({
      where: {
        assetId_revisionNumber: { assetId: seedAsset.id, revisionNumber: 1 },
      },
      include: { representations: true },
    });
    expect(rebuiltRevision).not.toBeNull();
    expect(rebuiltRevision!.representations).toHaveLength(expectedRepresentations);
    if (expectedRepresentations === 1) {
      expect(rebuiltRevision!.representations[0]).toMatchObject({
        storageType: "EXTERNAL_URL",
        legacyAssetId: seedAsset.id,
        isPrimary: true,
      });
    }
  });

  test("authored migration constraints reject invalid structures", async () => {
    const prisma = getPrisma();
    const assetId = fixture.withValidUrl.id;
    const revision = await prisma.assetRevision.findUnique({
      where: { assetId_revisionNumber: { assetId, revisionNumber: 1 } },
      select: { id: true },
    });
    expect(revision).not.toBeNull();
    const revisionId = revision!.id;

    // Constraint 1: revisionNumber must be positive.
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "AssetRevision" ("id", "assetId", "revisionNumber") VALUES ($1, $2, 0)`,
        `${runId}-chk-rev0`,
        assetId,
      ),
    ).rejects.toThrow();

    // Constraint 2: at most one primary representation per revision.
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "AssetRepresentation" ("id", "assetRevisionId", "storageType", "externalUrl", "isPrimary") VALUES ($1, $2, 'EXTERNAL_URL', 'https://example.com/fixtures/second-primary.png', true)`,
        `${runId}-chk-second-primary`,
        revisionId,
      ),
    ).rejects.toThrow();

    // Constraint 3: BLOB storage requires the complete blob field set.
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "AssetRepresentation" ("id", "assetRevisionId", "storageType") VALUES ($1, $2, 'BLOB')`,
        `${runId}-chk-blob-incomplete`,
        revisionId,
      ),
    ).rejects.toThrow();

    // Constraint 3: mixed BLOB/EXTERNAL fields are rejected.
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "AssetRepresentation" ("id", "assetRevisionId", "storageType", "externalUrl", "blobUrl", "blobPathname", "uploadFileId", "mimeType", "byteSize", "isPrimary") VALUES ($1, $2, 'BLOB', 'https://example.com/x.png', 'https://blob.example.net/x', 'campaignos/x', '00000000-0000-4000-8000-000000000000', 'image/png', 10, false)`,
        `${runId}-chk-mixed-storage`,
        revisionId,
      ),
    ).rejects.toThrow();

    const tokenHash = "a".repeat(64);
    const requestBase = `INSERT INTO "UploadRequest" ("id", "tokenHash", "title", "expiresAt"`;

    // Constraint 5: maxItems bounds.
    await expect(
      prisma.$executeRawUnsafe(
        `${requestBase}, "maxItems") VALUES ($1, $2, 'bounds', NOW() + INTERVAL '1 day', 0)`,
        `${runId}-chk-maxitems`,
        tokenHash,
      ),
    ).rejects.toThrow();

    // Constraint 5: expiresAt must be after createdAt.
    await expect(
      prisma.$executeRawUnsafe(
        `${requestBase}) VALUES ($1, $2, 'expiry', NOW() - INTERVAL '1 day')`,
        `${runId}-chk-expiry`,
        `${tokenHash.slice(0, 63)}b`,
      ),
    ).rejects.toThrow();

    // Constraint 7: OPEN requests cannot carry submission metadata.
    await expect(
      prisma.$executeRawUnsafe(
        `${requestBase}, "submittedAt") VALUES ($1, $2, 'open-with-submission', NOW() + INTERVAL '1 day', NOW())`,
        `${runId}-chk-open-state`,
        `${tokenHash.slice(0, 63)}c`,
      ),
    ).rejects.toThrow();

    // Constraint 6: targetRevisionId without targetAssetId is rejected.
    await expect(
      prisma.$executeRawUnsafe(
        `${requestBase}, "targetRevisionId") VALUES ($1, $2, 'orphan-target', NOW() + INTERVAL '1 day', $3)`,
        `${runId}-chk-target`,
        `${tokenHash.slice(0, 63)}d`,
        revisionId,
      ),
    ).rejects.toThrow();
  });
});
