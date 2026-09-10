import "server-only";
import { Prisma } from "@/app/generated/prisma/client";
import { createActivityTx } from "./activity";
import { findEntityTitleTx } from "./entity-refs";
import {
  normalizeTagSlug,
  type CampaignEntityType,
  type EntityRef,
} from "./tag-schemas";
import type { MutationSource } from "./schemas";

/**
 * Transaction-aware tag/relation/membership helpers (ADR 0007, execution plan
 * section 5.1).
 *
 * Public `tagEntity` / `linkEntities` keep their full-service wrapper signatures
 * (validation, retry outside failed transactions, Activity, no-ops, and
 * ServiceResult shaping). Memory services, supersession, and future composite
 * writers call the inner `*Tx` helpers from within their own outer transaction
 * so that aggregate creation stays atomic; those callers must NOT call the
 * public wrappers after the outer transaction has committed (which would
 * reintroduce the non-atomic create-then-attach problem).
 *
 * The Tx helpers validate normalization, endpoint existence, USES_ASSET target
 * restrictions, and immutable relation notes. They throw typed internal errors
 * on validation failures (memory services map these to ServiceResult codes);
 * they never start their own transactions, swallow errors, call getPrisma, or
 * describe their own concurrency contract.
 *
 * Tx helpers rely on the caller to provide transaction isolation/timeouts and
 * to retry around the OUTERMOST transaction for unique races.
 */

type Tx = Prisma.TransactionClient;

interface AttachOneTagOptions {
  tx: Tx;
  entity: EntityRef;
  tagDisplay: string;
  source: MutationSource;
}

/** Attach a single display-name tag inside the caller's transaction. */
export async function tagEntityTx(options: AttachOneTagOptions): Promise<{
  tagId: string;
  tagSlug: string;
  tagName: string;
  attached: boolean;
  tagCreated: boolean;
}> {
  const { tx, entity, tagDisplay, source } = options;
  const slug = normalizeTagSlug(tagDisplay);
  if (slug.length === 0 || slug.length > 80) {
    throw new MemoryTxError("INVALID_TAG_SLUG", "tag must normalize to a slug of 1..80 lowercase ASCII characters.");
  }
  const title = await findEntityTitleTx(tx, entity.entityType, entity.entityId);
  if (title === null) {
    throw new MemoryTxError("ENTITY_NOT_FOUND", `${entity.entityType} entity ${entity.entityId} not found.`);
  }
  let tag = await tx.tag.findUnique({ where: { slug } });
  let tagCreated = false;
  if (!tag) {
    tag = await tx.tag.create({ data: { name: tagDisplay, slug } });
    tagCreated = true;
  }
  const membership = await tx.entityTag.findUnique({
    where: {
      tagId_entityType_entityId: {
        tagId: tag.id,
        entityType: entity.entityType,
        entityId: entity.entityId,
      },
    },
    select: { tagId: true },
  });
  let attached = false;
  if (!membership) {
    await tx.entityTag.create({
      data: {
        tagId: tag.id,
        entityType: entity.entityType,
        entityId: entity.entityId,
      },
    });
    attached = true;
  }
  if (tagCreated) {
    await createActivityTx(tx, {
      entityType: "TAG",
      entityId: tag.id,
      action: "TAG_CREATED",
      summary: `Created tag ${tag.slug}`,
      source,
      metadata: { slug: tag.slug },
    });
  }
  if (attached) {
    await createActivityTx(tx, {
      entityType: entity.entityType,
      entityId: entity.entityId,
      action: "TAG_ATTACHED",
      summary: `Attached tag ${tag.slug}`,
      source,
      metadata: { tagId: tag.id, slug: tag.slug },
    });
  }
  return {
    tagId: tag.id,
    tagSlug: tag.slug,
    tagName: tag.name,
    attached,
    tagCreated,
  };
}

/** Detach a single slug inside the caller's transaction. */
export async function untagEntityTx(options: {
  tx: Tx;
  entity: EntityRef;
  tagSlug: string;
  source: MutationSource;
}): Promise<{ detached: boolean; tagSlug: string }> {
  const { tx, entity, tagSlug, source } = options;
  const title = await findEntityTitleTx(tx, entity.entityType, entity.entityId);
  if (title === null) {
    throw new MemoryTxError("ENTITY_NOT_FOUND", `${entity.entityType} entity ${entity.entityId} not found.`);
  }
  const tag = await tx.tag.findUnique({ where: { slug: tagSlug } });
  if (!tag) {
    return { detached: false, tagSlug };
  }
  const membership = await tx.entityTag.findUnique({
    where: {
      tagId_entityType_entityId: {
        tagId: tag.id,
        entityType: entity.entityType,
        entityId: entity.entityId,
      },
    },
  });
  if (!membership) {
    return { detached: false, tagSlug: tag.slug };
  }
  await tx.entityTag.delete({
    where: {
      tagId_entityType_entityId: {
        tagId: tag.id,
        entityType: entity.entityType,
        entityId: entity.entityId,
      },
    },
  });
  await createActivityTx(tx, {
    entityType: entity.entityType,
    entityId: entity.entityId,
    action: "TAG_DETACHED",
    summary: `Detached tag ${tag.slug}`,
    source,
    metadata: { tagId: tag.id, slug: tag.slug },
  });
  return { detached: true, tagSlug: tag.slug };
}

export interface DirectedLinkInput {
  from: EntityRef;
  to: EntityRef;
  relationType: "RELATES_TO" | "USES_ASSET" | "PART_OF";
  notes?: string | null;
}

/**
 * Attach a single directed edge inside the caller's transaction. The same edge
 * with identical normalized notes is a no-op; the same edge with different
 * notes throws RELATION_NOTE_CONFLICT and the caller must abort. Tags created
 * in this transaction are not touched: this helper does not manage tags.
 */
export async function linkEntitiesTx(options: {
  tx: Tx;
  input: DirectedLinkInput;
  source: MutationSource;
}): Promise<{ relationId: string | null; changed: boolean }> {
  const { tx, input, source } = options;
  if (input.from.entityType === input.to.entityType && input.from.entityId === input.to.entityId) {
    throw new MemoryTxError("SELF_RELATION", "A relation cannot link an entity to itself.");
  }
  if (input.relationType === "USES_ASSET" && input.to.entityType !== "ASSET") {
    throw new MemoryTxError("INVALID_USES_ASSET_TARGET", "USES_ASSET relations require the target entity to be an ASSET.");
  }
  const fromTitle = await findEntityTitleTx(tx, input.from.entityType, input.from.entityId);
  if (fromTitle === null) {
    throw new MemoryTxError("ENTITY_NOT_FOUND", `${input.from.entityType} entity ${input.from.entityId} not found.`);
  }
  const toTitle = await findEntityTitleTx(tx, input.to.entityType, input.to.entityId);
  if (toTitle === null) {
    throw new MemoryTxError("ENTITY_NOT_FOUND", `${input.to.entityType} entity ${input.to.entityId} not found.`);
  }
  const existing = await tx.entityRelation.findUnique({
    where: {
      fromEntityType_fromEntityId_toEntityType_toEntityId_relationType: {
        fromEntityType: input.from.entityType,
        fromEntityId: input.from.entityId,
        toEntityType: input.to.entityType,
        toEntityId: input.to.entityId,
        relationType: input.relationType,
      },
    },
  });
  if (existing) {
    if ((existing.notes ?? null) === (input.notes ?? null)) {
      return { relationId: existing.id, changed: false };
    }
    throw new MemoryTxError("RELATION_NOTE_CONFLICT", "A relation with different notes already exists; notes are immutable.");
  }
  const created = await tx.entityRelation.create({
    data: {
      fromEntityType: input.from.entityType,
      fromEntityId: input.from.entityId,
      toEntityType: input.to.entityType,
      toEntityId: input.to.entityId,
      relationType: input.relationType,
      notes: input.notes ?? null,
    },
  });
  await createActivityTx(tx, {
    entityType: "ENTITY_RELATION",
    entityId: created.id,
    action: "ENTITY_LINKED",
    summary: `Linked ${input.from.entityType} to ${input.to.entityType} (${input.relationType})`,
    source,
    metadata: {
      relationType: input.relationType,
      fromEntityType: input.from.entityType,
      fromEntityId: input.from.entityId,
      toEntityType: input.to.entityType,
      toEntityId: input.to.entityId,
    },
  });
  return { relationId: created.id, changed: true };
}

/** Detach a single edge by id inside the caller's transaction. */
export async function unlinkEntitiesTx(options: {
  tx: Tx;
  relationId: string;
  source: MutationSource;
}): Promise<{ detached: boolean }> {
  const { tx, relationId, source } = options;
  const relation = await tx.entityRelation.findUnique({ where: { id: relationId } });
  if (!relation) return { detached: false };
  await tx.entityRelation.delete({ where: { id: relation.id } });
  await createActivityTx(tx, {
    entityType: "ENTITY_RELATION",
    entityId: relation.id,
    action: "ENTITY_UNLINKED",
    summary: `Unlinked ${relation.fromEntityType} from ${relation.toEntityType} (${relation.relationType})`,
    source,
    metadata: {
      relationType: relation.relationType,
      fromEntityType: relation.fromEntityType,
      fromEntityId: relation.fromEntityId,
      toEntityType: relation.toEntityType,
      toEntityId: relation.toEntityId,
    },
  });
  return { detached: true };
}

export class MemoryTxError extends Error {
  code:
    | "INVALID_TAG_SLUG"
    | "ENTITY_NOT_FOUND"
    | "SELF_RELATION"
    | "INVALID_USES_ASSET_TARGET"
    | "RELATION_NOTE_CONFLICT";
  constructor(code: MemoryTxError["code"], message: string) {
    super(message);
    this.name = "MemoryTxError";
    this.code = code;
  }
}

export type MemoryCampaignEntityType = CampaignEntityType;
