import { afterAll, describe, expect, test } from "vitest";
import {
  createAsset,
  createCanonEntry,
  createContact,
  createContentItem,
  createWebsite,
  createWorkItem,
  recordDecision,
  tagEntity,
  searchCampaign,
} from "@/lib/campaign";
import { getPrisma } from "@/lib/prisma";

const runId = `int-srch-${Date.now()}`;
const ids = {
  workItem: `${runId}-work`,
  canon: `${runId}-canon`,
  decision: `${runId}-decision`,
  asset: `${runId}-asset`,
  website: `${runId}-website`,
  content: `${runId}-content`,
  contact: `${runId}-contact`,
};

const createdTagIds: string[] = [];

function expectOk<T>(result: { ok: true; data: T } | { ok: false; error: unknown }): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.data;
}

function rememberTag(tag: { id: string }): void {
  if (!createdTagIds.includes(tag.id)) createdTagIds.push(tag.id);
}

afterAll(async () => {
  const prisma = getPrisma();
  await prisma.entityTag.deleteMany({
    where: {
      OR: [{ tagId: { in: createdTagIds } }, { entityId: { in: Object.values(ids) } }],
    },
  });
  await prisma.activity.deleteMany({
    where: { entityId: { in: [...Object.values(ids), ...createdTagIds] } },
  });
  await prisma.tag.deleteMany({ where: { id: { in: createdTagIds } } });

  const assetRevisions = await prisma.assetRevision.findMany({
    where: { assetId: ids.asset },
    select: { id: true },
  });
  await prisma.assetRepresentation.deleteMany({
    where: { assetRevisionId: { in: assetRevisions.map((r) => r.id) } },
  });
  await prisma.assetRevision.deleteMany({ where: { assetId: ids.asset } });
  await prisma.asset.deleteMany({ where: { id: ids.asset } });
  await prisma.workItem.deleteMany({ where: { id: ids.workItem } });
  await prisma.canonEntry.deleteMany({ where: { id: ids.canon } });
  await prisma.decision.deleteMany({ where: { id: ids.decision } });
  await prisma.website.deleteMany({ where: { id: ids.website } });
  await prisma.contentItem.deleteMany({ where: { id: ids.content } });
  await prisma.contact.deleteMany({ where: { id: ids.contact } });
  await prisma.$disconnect();
});

describe("Global Search Integration", () => {
  test("searches across all 7 registers with exact snippet extraction", async () => {
    // 1. Setup fixtures
    expectOk(
      await createWorkItem({
        id: ids.workItem,
        title: `Work Title ${runId}`,
        description: `Work description keyword_${runId} detailed`,
      }),
    );

    expectOk(
      await createCanonEntry({
        id: ids.canon,
        key: `canon.${runId}`,
        value: `Canon value keyword_${runId} detailed`,
        category: "manifesto",
      }),
    );

    expectOk(
      await recordDecision({
        id: ids.decision,
        subject: `Decision Subject ${runId}`,
        decision: `Decision body keyword_${runId} detailed`,
        rationale: "Strategic rationale",
      }),
    );

    expectOk(
      await createAsset({
        id: ids.asset,
        name: `Asset Name ${runId}`,
        kind: "poster",
        notes: `Asset notes keyword_${runId} detailed`,
      }),
    );

    expectOk(
      await createWebsite({
        id: ids.website,
        name: `Website ${runId}`,
        domain: `${runId}.example.com`,
        purpose: `Portal purpose keyword_${runId} detailed`,
      }),
    );

    expectOk(
      await createContentItem({
        id: ids.content,
        title: `Content Title ${runId}`,
        format: "essay",
        channel: "blog",
        notes: `Content notes keyword_${runId} detailed`,
      }),
    );

    expectOk(
      await createContact({
        id: ids.contact,
        name: `Contact Name ${runId}`,
        organization: `Org keyword_${runId} alliance`,
        role: "Representative",
        email: `secret_${runId}@example.com`,
        notes: `Private secret_note_${runId}`,
      }),
    );

    // 2. Search for the unique keyword
    const searchRes = expectOk(
      await searchCampaign({
        query: `keyword_${runId}`,
        limit: 20,
      }),
    );

    expect(searchRes.total).toBe(7);
    expect(searchRes.items).toHaveLength(7);

    const typesFound = searchRes.items.map((item) => item.entityType);
    expect(typesFound).toContain("WORK_ITEM");
    expect(typesFound).toContain("CANON_ENTRY");
    expect(typesFound).toContain("DECISION");
    expect(typesFound).toContain("ASSET");
    expect(typesFound).toContain("WEBSITE");
    expect(typesFound).toContain("CONTENT_ITEM");
    expect(typesFound).toContain("CONTACT");

    // Verify snippet extraction
    const workResult = searchRes.items.find((i) => i.entityType === "WORK_ITEM")!;
    expect(workResult.snippet).toContain(`keyword_${runId}`);
    expect(workResult.href).toBe(`/admin/work-items/${ids.workItem}`);

    const canonResult = searchRes.items.find((i) => i.entityType === "CANON_ENTRY")!;
    expect(canonResult.status).toBeNull();
    expect(canonResult.snippet).toContain(`keyword_${runId}`);

    const decisionResult = searchRes.items.find((i) => i.entityType === "DECISION")!;
    expect(decisionResult.status).toBe("CURRENT");
  });

  test("enforces contact privacy: private email and notes are never matched or exposed", async () => {
    // Search for the contact's private email
    const emailSearch = expectOk(
      await searchCampaign({
        query: `secret_${runId}@example.com`,
      }),
    );
    expect(emailSearch.items).toHaveLength(0);

    // Search for the contact's private notes
    const notesSearch = expectOk(
      await searchCampaign({
        query: `secret_note_${runId}`,
      }),
    );
    expect(notesSearch.items).toHaveLength(0);
  });

  test("qualifies entities via attached tags and enforces AND tag filtering", async () => {
    const tag1 = expectOk(
      await tagEntity({
        entityType: "ASSET",
        entityId: ids.asset,
        tag: `TagAlpha_${runId}`,
      }),
    );
    rememberTag(tag1.tag);

    const tag2 = expectOk(
      await tagEntity({
        entityType: "ASSET",
        entityId: ids.asset,
        tag: `TagBeta_${runId}`,
      }),
    );
    rememberTag(tag2.tag);

    // Matching by tag text
    const tagTextSearch = expectOk(
      await searchCampaign({
        query: `TagAlpha_${runId}`,
      }),
    );
    expect(tagTextSearch.items.some((i) => i.id === ids.asset)).toBe(true);

    // Filter requiring both tags
    const bothTagsSearch = expectOk(
      await searchCampaign({
        query: runId,
        tags: [tag1.tag.slug, tag2.tag.slug],
      }),
    );
    expect(bothTagsSearch.items.map((i) => i.id)).toContain(ids.asset);

    // Filter with an unknown/unattached tag returns 0
    const unknownTagSearch = expectOk(
      await searchCampaign({
        query: runId,
        tags: [tag1.tag.slug, "nonexistent-tag-slug-xyz"],
      }),
    );
    expect(unknownTagSearch.total).toBe(0);
    expect(unknownTagSearch.items).toHaveLength(0);
  });

  test("handles literal SQL wildcard characters without globbing", async () => {
    expectOk(
      await createCanonEntry({
        key: `canon.wildcard.${runId}`,
        value: `100% pure rejectionism for ${runId}`,
        category: "slogan",
      }),
    );

    // Literal search for 100%
    const wildcardSearch = expectOk(
      await searchCampaign({
        query: `100% pure rejectionism for ${runId}`,
      }),
    );
    expect(wildcardSearch.items).toHaveLength(1);
    expect(wildcardSearch.items[0]!.title).toBe(`canon.wildcard.${runId}`);
  });
});
