import "server-only";
import { getPrisma } from "@/lib/prisma";
import type { EntityType } from "./schemas";
import {
  CAMPAIGN_ENTITY_TYPES,
  type CampaignEntityType,
  type EntityRef,
} from "./tag-schemas";
import { Prisma } from "@/app/generated/prisma/client";

/**
 * The one explicit switch from polymorphic entity references to the eight
 * generic Prisma models (upgrade plan Phase 4 step 2 plus ADR 0007). Tag and
 * relation mutations validate entity existence through these helpers inside
 * their mutation transaction; read paths use the batched title lookup.
 */

type Tx = Prisma.TransactionClient;

function refKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

/**
 * Returns the entity display title, or null when the entity does not exist.
 * Titles per section 4: WorkItem/ContentItem title, CanonEntry key, Decision
 * subject, Asset/Website/Contact name.
 */
export async function findEntityTitleTx(
  tx: Tx,
  entityType: CampaignEntityType,
  entityId: string,
): Promise<string | null> {
  switch (entityType) {
    case "WORK_ITEM": {
      const row = await tx.workItem.findUnique({
        where: { id: entityId },
        select: { title: true },
      });
      return row?.title ?? null;
    }
    case "CANON_ENTRY": {
      const row = await tx.canonEntry.findUnique({
        where: { id: entityId },
        select: { key: true },
      });
      return row?.key ?? null;
    }
    case "DECISION": {
      const row = await tx.decision.findUnique({
        where: { id: entityId },
        select: { subject: true },
      });
      return row?.subject ?? null;
    }
    case "ASSET": {
      const row = await tx.asset.findUnique({
        where: { id: entityId },
        select: { name: true },
      });
      return row?.name ?? null;
    }
    case "WEBSITE": {
      const row = await tx.website.findUnique({
        where: { id: entityId },
        select: { name: true },
      });
      return row?.name ?? null;
    }
    case "CONTENT_ITEM": {
      const row = await tx.contentItem.findUnique({
        where: { id: entityId },
        select: { title: true },
      });
      return row?.title ?? null;
    }
    case "CONTACT": {
      const row = await tx.contact.findUnique({
        where: { id: entityId },
        select: { name: true },
      });
      return row?.name ?? null;
    }
    case "CAMPAIGN_MEMORY": {
      const row = await tx.campaignMemory.findUnique({
        where: { id: entityId },
        select: { title: true },
      });
      return row?.title ?? null;
    }
    default: {
      const exhaustive: never = entityType;
      throw new Error(`Unsupported entity type: ${String(exhaustive)}`);
    }
  }
}

/**
 * Transaction-aware batched title lookup. Memory services, context reads, and
 * any future callers operating inside a Prisma transaction call this helper
 * so that title lookups share the enclosing transaction's snapshot.
 */
export async function getEntityTitlesTx(
  tx: Tx,
  refs: EntityRef[],
): Promise<Map<string, string>> {
  const idsByType = new Map<CampaignEntityType, Set<string>>();
  for (const ref of refs) {
    const ids = idsByType.get(ref.entityType) ?? new Set<string>();
    ids.add(ref.entityId);
    idsByType.set(ref.entityType, ids);
  }

  const titles = new Map<string, string>();

  for (const [entityType, ids] of idsByType) {
    const idList = [...ids];
    switch (entityType) {
      case "WORK_ITEM": {
        const rows = await tx.workItem.findMany({
          where: { id: { in: idList } },
          select: { id: true, title: true },
        });
        for (const row of rows) titles.set(refKey(entityType, row.id), row.title);
        break;
      }
      case "CANON_ENTRY": {
        const rows = await tx.canonEntry.findMany({
          where: { id: { in: idList } },
          select: { id: true, key: true },
        });
        for (const row of rows) titles.set(refKey(entityType, row.id), row.key);
        break;
      }
      case "DECISION": {
        const rows = await tx.decision.findMany({
          where: { id: { in: idList } },
          select: { id: true, subject: true },
        });
        for (const row of rows) titles.set(refKey(entityType, row.id), row.subject);
        break;
      }
      case "ASSET": {
        const rows = await tx.asset.findMany({
          where: { id: { in: idList } },
          select: { id: true, name: true },
        });
        for (const row of rows) titles.set(refKey(entityType, row.id), row.name);
        break;
      }
      case "WEBSITE": {
        const rows = await tx.website.findMany({
          where: { id: { in: idList } },
          select: { id: true, name: true },
        });
        for (const row of rows) titles.set(refKey(entityType, row.id), row.name);
        break;
      }
      case "CONTENT_ITEM": {
        const rows = await tx.contentItem.findMany({
          where: { id: { in: idList } },
          select: { id: true, title: true },
        });
        for (const row of rows) titles.set(refKey(entityType, row.id), row.title);
        break;
      }
      case "CONTACT": {
        const rows = await tx.contact.findMany({
          where: { id: { in: idList } },
          select: { id: true, name: true },
        });
        for (const row of rows) titles.set(refKey(entityType, row.id), row.name);
        break;
      }
      case "CAMPAIGN_MEMORY": {
        const rows = await tx.campaignMemory.findMany({
          where: { id: { in: idList } },
          select: { id: true, title: true },
        });
        for (const row of rows) titles.set(refKey(entityType, row.id), row.title);
        break;
      }
      default: {
        const exhaustive: never = entityType;
        throw new Error(`Unsupported entity type: ${String(exhaustive)}`);
      }
    }
  }

  return titles;
}

/**
 * Batched title lookup for read paths: one query per distinct entity type on
 * the page instead of one query per relation endpoint. Memory services use
 * `getEntityTitlesTx` so that the lookup participates in the caller's
 * transaction; this global-client variant remains for unrelated read paths.
 */
export async function getEntityTitles(refs: EntityRef[]): Promise<Map<string, string>> {
  const idsByType = new Map<CampaignEntityType, Set<string>>();
  for (const ref of refs) {
    const ids = idsByType.get(ref.entityType) ?? new Set<string>();
    ids.add(ref.entityId);
    idsByType.set(ref.entityType, ids);
  }

  const titles = new Map<string, string>();
  const prisma = getPrisma();

  for (const [entityType, ids] of idsByType) {
    const idList = [...ids];
    switch (entityType) {
      case "WORK_ITEM": {
        const rows = await prisma.workItem.findMany({
          where: { id: { in: idList } },
          select: { id: true, title: true },
        });
        for (const row of rows) titles.set(refKey(entityType, row.id), row.title);
        break;
      }
      case "CANON_ENTRY": {
        const rows = await prisma.canonEntry.findMany({
          where: { id: { in: idList } },
          select: { id: true, key: true },
        });
        for (const row of rows) titles.set(refKey(entityType, row.id), row.key);
        break;
      }
      case "DECISION": {
        const rows = await prisma.decision.findMany({
          where: { id: { in: idList } },
          select: { id: true, subject: true },
        });
        for (const row of rows) titles.set(refKey(entityType, row.id), row.subject);
        break;
      }
      case "ASSET": {
        const rows = await prisma.asset.findMany({
          where: { id: { in: idList } },
          select: { id: true, name: true },
        });
        for (const row of rows) titles.set(refKey(entityType, row.id), row.name);
        break;
      }
      case "WEBSITE": {
        const rows = await prisma.website.findMany({
          where: { id: { in: idList } },
          select: { id: true, name: true },
        });
        for (const row of rows) titles.set(refKey(entityType, row.id), row.name);
        break;
      }
      case "CONTENT_ITEM": {
        const rows = await prisma.contentItem.findMany({
          where: { id: { in: idList } },
          select: { id: true, title: true },
        });
        for (const row of rows) titles.set(refKey(entityType, row.id), row.title);
        break;
      }
      case "CONTACT": {
        const rows = await prisma.contact.findMany({
          where: { id: { in: idList } },
          select: { id: true, name: true },
        });
        for (const row of rows) titles.set(refKey(entityType, row.id), row.name);
        break;
      }
      case "CAMPAIGN_MEMORY": {
        const rows = await prisma.campaignMemory.findMany({
          where: { id: { in: idList } },
          select: { id: true, title: true },
        });
        for (const row of rows) titles.set(refKey(entityType, row.id), row.title);
        break;
      }
      default: {
        const exhaustive: never = entityType;
        throw new Error(`Unsupported entity type: ${String(exhaustive)}`);
      }
    }
  }

  return titles;
}

const ENTITY_HREF_PREFIX: Record<CampaignEntityType, string> = {
  WORK_ITEM: "/admin/work-items",
  CANON_ENTRY: "/admin/canon",
  DECISION: "/admin/decisions",
  ASSET: "/admin/assets",
  WEBSITE: "/admin/websites",
  CONTENT_ITEM: "/admin/content",
  CONTACT: "/admin/contacts",
  CAMPAIGN_MEMORY: "/admin/memory",
};

export function entityHref(entityType: CampaignEntityType, entityId: string): string {
  return `${ENTITY_HREF_PREFIX[entityType]}/${encodeURIComponent(entityId)}`;
}

export function mapEntityRef(entityType: CampaignEntityType, entityId: string): EntityRef {
  return { entityType, entityId };
}

/** Narrows a storage/activity entity type into the CampaignEntityType selector, or null. */
export function toCampaignEntityType(entityType: EntityType): CampaignEntityType | null {
  return (CAMPAIGN_ENTITY_TYPES as readonly string[]).includes(entityType)
    ? (entityType as CampaignEntityType)
    : null;
}

/**
 * @deprecated Use `toCampaignEntityType`. Retained as a documented alias for
 * compatibility with relation service code that imports the older name.
 */
export const toOriginalEntityType = toCampaignEntityType;
