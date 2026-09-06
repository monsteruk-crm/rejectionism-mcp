import { afterAll, describe, expect, test } from "vitest";
import {
  createAsset,
  createCanonEntry,
  createContact,
  createContentItem,
  createWebsite,
  createWorkItem,
  getAssetById,
  getRelationships,
  linkEntities,
  listAssets,
  listTags,
  recordDecision,
  tagEntity,
  untagEntity,
  unlinkEntities,
} from "@/lib/campaign";
import { getPrisma } from "@/lib/prisma";

const runId = `int-links-${Date.now()}`;
const ids = {
  workItem: `${runId}-work`,
  canon: `${runId}-canon`,
  decision: `${runId}-decision`,
  asset: `${runId}-asset`,
  assetB: `${runId}-asset-b`,
  website: `${runId}-website`,
  content: `${runId}-content`,
  contact: `${runId}-contact`,
  doomed: `${runId}-doomed`,
};

// Identifiers created during the run that are not run-id prefixed.
const createdTagIds: string[] = [];
const createdRelationIds: string[] = [];

function expectOk<T>(result: { ok: true; data: T } | { ok: false; error: unknown }): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.data;
}

function rememberTag(tag: { id: string }): void {
  if (!createdTagIds.includes(tag.id)) createdTagIds.push(tag.id);
}

function rememberRelation(relation: { id: string }): void {
  if (!createdRelationIds.includes(relation.id)) createdRelationIds.push(relation.id);
}

afterAll(async () => {
  const prisma = getPrisma();
  // Teardown order per plan section 3: tag associations, relations, tags, then
  // parent entities — scoped to this run's records only, never table-wide.
  await prisma.entityTag.deleteMany({
    where: {
      OR: [{ tagId: { in: createdTagIds } }, { entityId: { in: Object.values(ids) } }],
    },
  });
  await prisma.entityRelation.deleteMany({
    where: {
      OR: [
        { id: { in: createdRelationIds } },
        { fromEntityId: { in: Object.values(ids) } },
        { toEntityId: { in: Object.values(ids) } },
      ],
    },
  });
  await prisma.activity.deleteMany({
    where: { entityId: { in: [...Object.values(ids), ...createdTagIds, ...createdRelationIds] } },
  });
  await prisma.tag.deleteMany({ where: { id: { in: createdTagIds } } });

  const assetRevisions = await prisma.assetRevision.findMany({
    where: { assetId: { in: [ids.asset, ids.assetB] } },
    select: { id: true },
  });
  await prisma.assetRepresentation.deleteMany({
    where: { assetRevisionId: { in: assetRevisions.map((revision) => revision.id) } },
  });
  await prisma.assetRevision.deleteMany({
    where: { assetId: { in: [ids.asset, ids.assetB] } },
  });
  await prisma.asset.deleteMany({ where: { id: { in: [ids.asset, ids.assetB] } } });
  await prisma.workItem.deleteMany({ where: { id: { in: [ids.workItem, ids.doomed] } } });
  await prisma.canonEntry.deleteMany({ where: { id: ids.canon } });
  await prisma.decision.deleteMany({ where: { id: ids.decision } });
  await prisma.website.deleteMany({ where: { id: ids.website } });
  await prisma.contentItem.deleteMany({ where: { id: ids.content } });
  await prisma.contact.deleteMany({ where: { id: ids.contact } });
  await prisma.$disconnect();
});

describe("Generic tags", () => {
  test("entities of all seven types accept tags without version bumps", async () => {
    expectOk(await createWorkItem({ id: ids.workItem, title: runId }));
    expectOk(
      await createCanonEntry({
        id: ids.canon,
        key: `${runId}.key`,
        value: "integration",
        category: "integration",
      }),
    );
    expectOk(
      await recordDecision({
        id: ids.decision,
        subject: runId,
        decision: "Integration fixture",
        rationale: "Integration fixture",
      }),
    );
    expectOk(await createAsset({ id: ids.asset, name: runId, kind: "test" }));
    expectOk(
      await createWebsite({
        id: ids.website,
        name: runId,
        domain: `${runId}.example.com`,
        purpose: "Integration fixture",
      }),
    );
    expectOk(
      await createContentItem({ id: ids.content, title: runId, format: "test", channel: "integration" }),
    );
    expectOk(await createContact({ id: ids.contact, name: runId }));

    const targets = [
      { entityType: "WORK_ITEM" as const, entityId: ids.workItem },
      { entityType: "CANON_ENTRY" as const, entityId: ids.canon },
      { entityType: "DECISION" as const, entityId: ids.decision },
      { entityType: "ASSET" as const, entityId: ids.asset },
      { entityType: "WEBSITE" as const, entityId: ids.website },
      { entityType: "CONTENT_ITEM" as const, entityId: ids.content },
      { entityType: "CONTACT" as const, entityId: ids.contact },
    ];

    for (const target of targets) {
      const result = expectOk(
        await tagEntity({ ...target, tag: `${runId} ${target.entityType}` }),
      );
      expect(result.changed).toBe(true);
      // The normalizer replaces underscores with hyphens (WORK_ITEM -> work-item).
      expect(result.tag.slug).toBe(
        `${runId}-${target.entityType.toLowerCase().replace(/_/g, "-")}`,
      );
      expect(result.entity).toEqual(target);
      rememberTag(result.tag);
    }

    // Set membership never increments an entity version.
    expect(await getPrisma().workItem.findUnique({ where: { id: ids.workItem } })).toMatchObject({
      version: 1,
    });
    expect(await getPrisma().asset.findUnique({ where: { id: ids.asset } })).toMatchObject({
      version: 1,
    });
  });

  test("duplicate attaches, slug collisions, and concurrent attaches stay idempotent", async () => {
    const activityBefore = await getPrisma().activity.count({ where: { entityId: ids.asset } });

    // Exact repeat: no additional membership, no Activity.
    const repeat = expectOk(await tagEntity({ entityType: "ASSET", entityId: ids.asset, tag: `${runId} ASSET` }));
    expect(repeat.changed).toBe(false);
    expect(
      await getPrisma().activity.count({ where: { entityId: ids.asset } }),
    ).toBe(activityBefore);

    // Spelling/case variants sharing a slug reuse the original tag and name.
    const collision = expectOk(
      await tagEntity({ entityType: "ASSET", entityId: ids.asset, tag: `${runId}    asset` }),
    );
    expect(collision.changed).toBe(false);
    expect(collision.tag.slug).toBe(`${runId}-asset`);
    expect(collision.tag.name).toBe(`${runId} ASSET`); // first submitted name is immutable

    // Concurrent first attaches converge on one tag, one membership, one audit.
    const raceSlugTag = `${runId} Race Tag`;
    const results = await Promise.all([
      tagEntity({ entityType: "WORK_ITEM", entityId: ids.workItem, tag: raceSlugTag }),
      tagEntity({ entityType: "WORK_ITEM", entityId: ids.workItem, tag: raceSlugTag }),
      tagEntity({ entityType: "WORK_ITEM", entityId: ids.workItem, tag: raceSlugTag }),
    ]);
    const raceTags = results.map((result) => expectOk(result));
    expect(raceTags.filter((result) => result.changed)).toHaveLength(1);
    expect(new Set(raceTags.map((result) => result.tag.id))).toHaveLength(1);
    rememberTag(raceTags[0]!.tag);
    const raceSlug = `${runId}-race-tag`;
    const raceMemberships = await getPrisma().entityTag.findMany({
      where: { entityId: ids.workItem, tag: { slug: raceSlug } },
    });
    expect(raceMemberships).toHaveLength(1);
    const raceActivities = await getPrisma().activity.findMany({
      where: { action: "TAG_CREATED", metadata: { path: ["slug"], equals: raceSlug } },
    });
    expect(raceActivities).toHaveLength(1);
  });

  test("invalid and deleted targets are NOT_FOUND without audit", async () => {
    const missingId = `${runId}-missing`;

    const missingTag = await tagEntity({ entityType: "ASSET", entityId: missingId, tag: "ghost" });
    expect(missingTag).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });

    const missingUntag = await untagEntity({
      entityType: "ASSET",
      entityId: missingId,
      tagSlug: "ghost",
    });
    expect(missingUntag).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });

    const missingLink = await linkEntities({
      from: { entityType: "ASSET", entityId: missingId },
      to: { entityType: "WORK_ITEM", entityId: ids.workItem },
      relationType: "RELATES_TO",
    });
    expect(missingLink).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });

    expect(
      await getPrisma().activity.count({ where: { entityId: missingId } }),
    ).toBe(0);

    // A deleted entity rejects untagging as NOT_FOUND.
    expectOk(await createWorkItem({ id: ids.doomed, title: `${runId} doomed` }));
    const doomedTag = expectOk(
      await tagEntity({ entityType: "WORK_ITEM", entityId: ids.doomed, tag: "doomed tag" }),
    );
    rememberTag(doomedTag.tag);
    await getPrisma().workItem.delete({ where: { id: ids.doomed } });

    const deletedUntag = await untagEntity({
      entityType: "WORK_ITEM",
      entityId: ids.doomed,
      tagSlug: "doomed-tag",
    });
    expect(deletedUntag).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    // Only the fixture CREATED and the original TAG_ATTACHED; the failed
    // untag wrote nothing.
    const doomedActivities = await getPrisma().activity.findMany({
      where: { entityId: ids.doomed },
      select: { action: true },
    });
    expect(doomedActivities.map((activity) => activity.action).sort()).toEqual([
      "CREATED",
      "TAG_ATTACHED",
    ]);
  });

  test("detach removes only the membership and keeps the tag definition", async () => {
    const attached = expectOk(
      await tagEntity({ entityType: "WORK_ITEM", entityId: ids.workItem, tag: "Detach Me" }),
    );
    expect(attached.changed).toBe(true);
    rememberTag(attached.tag);

    const detached = expectOk(
      await untagEntity({ entityType: "WORK_ITEM", entityId: ids.workItem, tagSlug: "detach-me" }),
    );
    expect(detached.changed).toBe(true);

    expect(
      await getPrisma().entityTag.findUnique({
        where: {
          tagId_entityType_entityId: {
            tagId: attached.tag.id,
            entityType: "WORK_ITEM",
            entityId: ids.workItem,
          },
        },
      }),
    ).toBeNull();

    const activityAfterDetach = await getPrisma().activity.count({
      where: { entityId: ids.workItem },
    });

    const repeat = expectOk(
      await untagEntity({ entityType: "WORK_ITEM", entityId: ids.workItem, tagSlug: "detach-me" }),
    );
    expect(repeat.changed).toBe(false);
    expect(
      await getPrisma().activity.count({ where: { entityId: ids.workItem } }),
    ).toBe(activityAfterDetach);

    // The tag definition survives; only the association was removed.
    const listed = expectOk(await listTags({ search: "detach-me" }));
    expect(listed.items.map((tag) => tag.slug)).toEqual(["detach-me"]);
  });
});

describe("Directed relationships", () => {
  test("links validate endpoints, types, notes, and read in both directions", async () => {
    const activityBeforeContent = await getPrisma().activity.count({
      where: { entityId: ids.content },
    });

    const linked = expectOk(
      await linkEntities({
        from: { entityType: "CONTENT_ITEM", entityId: ids.content },
        to: { entityType: "ASSET", entityId: ids.asset },
        relationType: "USES_ASSET",
        notes: "hero artwork",
      }),
    );
    expect(linked.changed).toBe(true);
    expect(linked.relation.fromTitle).toBe(runId);
    expect(linked.relation.toTitle).toBe(runId);
    expect(linked.relation.fromHref).toBe(`/admin/content/${encodeURIComponent(ids.content)}`);
    expect(linked.relation.toHref).toBe(`/admin/assets/${encodeURIComponent(ids.asset)}`);
    rememberRelation(linked.relation);

    // Identical edge and notes: unchanged, no Activity.
    const identical = expectOk(
      await linkEntities({
        from: { entityType: "CONTENT_ITEM", entityId: ids.content },
        to: { entityType: "ASSET", entityId: ids.asset },
        relationType: "USES_ASSET",
        notes: "hero artwork",
      }),
    );
    expect(identical.changed).toBe(false);
    expect(identical.relation.id).toBe(linked.relation.id);
    expect(
      await getPrisma().activity.count({ where: { entityId: ids.content } }),
    ).toBe(activityBeforeContent);

    // Same edge with different notes is a conflict, never a silent overwrite.
    const noteConflict = await linkEntities({
      from: { entityType: "CONTENT_ITEM", entityId: ids.content },
      to: { entityType: "ASSET", entityId: ids.asset },
      relationType: "USES_ASSET",
      notes: "different notes",
    });
    expect(noteConflict).toMatchObject({ ok: false, error: { code: "ALREADY_EXISTS" } });
    expect(
      await getPrisma().activity.count({ where: { entityId: ids.content } }),
    ).toBe(activityBeforeContent);

    // Self-link and USES_ASSET target rules.
    const selfLink = await linkEntities({
      from: { entityType: "ASSET", entityId: ids.asset },
      to: { entityType: "ASSET", entityId: ids.asset },
      relationType: "RELATES_TO",
    });
    expect(selfLink).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });

    const badUsesAsset = await linkEntities({
      from: { entityType: "CONTENT_ITEM", entityId: ids.content },
      to: { entityType: "WORK_ITEM", entityId: ids.workItem },
      relationType: "USES_ASSET",
    });
    expect(badUsesAsset).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });

    const invalidType = await linkEntities({
      from: { entityType: "CONTENT_ITEM", entityId: ids.content },
      to: { entityType: "ASSET", entityId: ids.asset },
      relationType: "IMPLEMENTS" as "USES_ASSET",
    });
    expect(invalidType).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });

    // More edges for direction reads.
    const toContent = expectOk(
      await linkEntities({
        from: { entityType: "CANON_ENTRY", entityId: ids.canon },
        to: { entityType: "CONTENT_ITEM", entityId: ids.content },
        relationType: "RELATES_TO",
      }),
    );
    rememberRelation(toContent.relation);
    expect(toContent.relation.fromTitle).toBe(`${runId}.key`);

    const outgoingExtra = expectOk(
      await linkEntities({
        from: { entityType: "CONTENT_ITEM", entityId: ids.content },
        to: { entityType: "WORK_ITEM", entityId: ids.workItem },
        relationType: "PART_OF",
      }),
    );
    rememberRelation(outgoingExtra.relation);

    const both = expectOk(
      await getRelationships({ entityType: "CONTENT_ITEM", entityId: ids.content }),
    );
    expect(both.total).toBe(3);
    const byId = new Map(both.items.map((item) => [item.id, item]));
    expect(byId.get(linked.relation.id)?.direction).toBe("outgoing");
    expect(byId.get(toContent.relation.id)?.direction).toBe("incoming");
    expect(byId.get(outgoingExtra.relation.id)?.direction).toBe("outgoing");

    const outgoingOnly = expectOk(
      await getRelationships({
        entityType: "CONTENT_ITEM",
        entityId: ids.content,
        direction: "outgoing",
      }),
    );
    expect(outgoingOnly.total).toBe(2);

    const incomingOnly = expectOk(
      await getRelationships({
        entityType: "CONTENT_ITEM",
        entityId: ids.content,
        direction: "incoming",
        relationType: "RELATES_TO",
      }),
    );
    expect(incomingOnly.total).toBe(1);
    expect(incomingOnly.items[0]!.relationType).toBe("RELATES_TO");
    expect(incomingOnly.items[0]!.fromTitle).toBe(`${runId}.key`);

    // No reverse edge is fabricated.
    const fromAsset = expectOk(
      await getRelationships({
        entityType: "ASSET",
        entityId: ids.asset,
        direction: "outgoing",
      }),
    );
    expect(fromAsset.total).toBe(0);
  });

  test("unlink removes the edge, and repeats report unchanged", async () => {
    const extra = expectOk(
      await linkEntities({
        from: { entityType: "CONTACT", entityId: ids.contact },
        to: { entityType: "WEBSITE", entityId: ids.website },
        relationType: "RELATES_TO",
      }),
    );
    rememberRelation(extra.relation);

    const removed = expectOk(await unlinkEntities({ relationId: extra.relation.id }));
    expect(removed.changed).toBe(true);

    const repeat = expectOk(await unlinkEntities({ relationId: extra.relation.id }));
    expect(repeat.changed).toBe(false);

    const missing = expectOk(
      await unlinkEntities({ relationId: `${runId}-no-such-relation` }),
    );
    expect(missing.changed).toBe(false);
  });
});

describe("Asset tag projections and predicates", () => {
  test("asset detail and list expose tags and relationships; filters require all slugs", async () => {
    const secondSlug = expectOk(
      await tagEntity({ entityType: "ASSET", entityId: ids.asset, tag: `${runId} Second` }),
    );
    rememberTag(secondSlug.tag);

    const detail = expectOk(await getAssetById(ids.asset));
    expect(detail.tags.map((tag) => tag.slug)).toEqual([
      `${runId}-asset`,
      `${runId}-second`,
    ]);
    expect(detail.relationships.map((relation) => relation.relationType)).toContain("USES_ASSET");

    expectOk(await createAsset({ id: ids.assetB, name: `${runId} b`, kind: "test" }));
    const onlyFirst = expectOk(
      await tagEntity({ entityType: "ASSET", entityId: ids.assetB, tag: `${runId} ASSET` }),
    );
    rememberTag(onlyFirst.tag);

    // Single-slug filter matches both tagged assets.
    const single = expectOk(await listAssets({ tags: [`${runId}-asset`], limit: 100 }));
    expect(single.items.map((asset) => asset.id).sort()).toEqual([ids.asset, ids.assetB].sort());
    const listed = single.items.find((asset) => asset.id === ids.asset);
    expect(listed!.tags).toEqual([`${runId}-asset`, `${runId}-second`]);

    // All-slugs requirement: assetB lacks the second slug.
    const allSlugs = expectOk(
      await listAssets({ tags: [`${runId}-asset`, `${runId}-second`], limit: 100 }),
    );
    expect(allSlugs.items.map((asset) => asset.id)).toEqual([ids.asset]);

    // Unknown slug yields zero.
    const unknown = expectOk(await listAssets({ tags: ["no-such-slug-anywhere"], limit: 100 }));
    expect(unknown.items).toEqual([]);
    expect(unknown.total).toBe(0);
  });
});
