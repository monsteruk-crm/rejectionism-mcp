import "server-only";
import { getPrisma } from "@/lib/prisma";
import { ok, fail, handleServiceError, ServiceResult } from "./results";
import { createActivityTx } from "./activity";
import { entityHref, findEntityTitleTx, getEntityTitles, toOriginalEntityType } from "./entity-refs";
import {
  GetRelationshipsQuerySchema,
  LinkEntitiesInputSchema,
  UnlinkEntitiesInputSchema,
  type DirectedRelationDto,
  type RelationDto,
} from "./relation-schemas";
import type { EntityRef } from "./tag-schemas";
import type { EntityType, MutationSource } from "./schemas";
import { Prisma } from "@/app/generated/prisma/client";

/**
 * Directed relationship services (upgrade plan Phase 4, section 4 tools 39-41).
 *
 * Relations are an independent set operation: no entity version bump, no
 * automatic reverse records, and immutable notes. Both endpoints are validated
 * inside the mutation transaction. Identical edge plus identical normalized
 * notes is a no-op returning changed false; the same edge with different notes
 * is ALREADY_EXISTS and never silently overwrites. Unique-conflict races are
 * retried outside the failed transaction.
 */

type RelationRecord = Prisma.EntityRelationGetPayload<Record<never, never>>;

const MAX_SET_ATTEMPTS = 3;

function endpointTitle(titles: Map<string, string>, ref: EntityRef): string {
  return titles.get(`${ref.entityType}:${ref.entityId}`) ?? ref.entityId;
}

/** Narrows a stored polymorphic endpoint into the generic selector, or null. */
function toEntityRef(entityType: EntityType, entityId: string): EntityRef | null {
  const original = toOriginalEntityType(entityType);
  return original ? { entityType: original, entityId } : null;
}

export function mapRelationToDto(
  relation: RelationRecord,
  titles: Map<string, string>,
): RelationDto {
  const from = toEntityRef(relation.fromEntityType, relation.fromEntityId);
  const to = toEntityRef(relation.toEntityType, relation.toEntityId);
  if (!from || !to) {
    // Authored constraint 8 restricts stored endpoints to the original seven
    // entity types; fail closed rather than map an out-of-scope record.
    throw new Error("RELATION_ENDPOINT_OUT_OF_SCOPE");
  }

  return {
    id: relation.id,
    from,
    to,
    relationType: relation.relationType,
    notes: relation.notes,
    createdAt: relation.createdAt.toISOString(),
    fromTitle: endpointTitle(titles, from),
    toTitle: endpointTitle(titles, to),
    fromHref: entityHref(from.entityType, from.entityId),
    toHref: entityHref(to.entityType, to.entityId),
  };
}

export async function linkEntities(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<{ relation: RelationDto; changed: boolean }>> {
  const parsed = LinkEntitiesInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;

  if (input.from.entityType === input.to.entityType && input.from.entityId === input.to.entityId) {
    return fail("VALIDATION_ERROR", "A relation cannot link an entity to itself.");
  }

  if (input.relationType === "USES_ASSET" && input.to.entityType !== "ASSET") {
    return fail("VALIDATION_ERROR", "USES_ASSET relations require the target entity to be an ASSET.");
  }

  for (let attempt = 0; attempt < MAX_SET_ATTEMPTS; attempt += 1) {
    try {
      const prisma = getPrisma();
      const result = await prisma.$transaction(async (tx) => {
        const fromTitle = await findEntityTitleTx(tx, input.from.entityType, input.from.entityId);
        if (fromTitle === null) {
          throw new Error("NOT_FOUND_FROM");
        }
        const toTitle = await findEntityTitleTx(tx, input.to.entityType, input.to.entityId);
        if (toTitle === null) {
          throw new Error("NOT_FOUND_TO");
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
            // Identical edge and normalized notes: unchanged, no Activity.
            return { relation: existing, changed: false, fromTitle, toTitle };
          }
          // Notes are immutable; the same edge with different notes is a conflict.
          throw new Error("RELATION_NOTE_CONFLICT");
        }

        const created = await tx.entityRelation.create({
          data: {
            fromEntityType: input.from.entityType,
            fromEntityId: input.from.entityId,
            toEntityType: input.to.entityType,
            toEntityId: input.to.entityId,
            relationType: input.relationType,
            notes: input.notes,
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

        return { relation: created, changed: true, fromTitle, toTitle };
      });

      const titles = new Map<string, string>();
      titles.set(`${input.from.entityType}:${input.from.entityId}`, result.fromTitle);
      titles.set(`${input.to.entityType}:${input.to.entityId}`, result.toTitle);

      return ok({
        relation: mapRelationToDto(result.relation, titles),
        changed: result.changed,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        // Lost a create race on the unique edge. Retry outside the aborted
        // transaction; the retry converges to the existing-edge branches.
        continue;
      }

      const message = error instanceof Error ? error.message : "";
      if (message === "NOT_FOUND_FROM") {
        return fail(
          "NOT_FOUND",
          `${input.from.entityType} entity ${input.from.entityId} not found.`,
        );
      }
      if (message === "NOT_FOUND_TO") {
        return fail(
          "NOT_FOUND",
          `${input.to.entityType} entity ${input.to.entityId} not found.`,
        );
      }
      if (message === "RELATION_NOTE_CONFLICT") {
        return fail(
          "ALREADY_EXISTS",
          "A relation already exists between these entities with different notes; relation notes are immutable.",
        );
      }
      return handleServiceError(error);
    }
  }

  return handleServiceError(
    new Error("Relation link could not be completed after repeated unique conflicts."),
  );
}

export async function unlinkEntities(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<{ relationId: string; changed: boolean }>> {
  const parsed = UnlinkEntitiesInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;

  try {
    const prisma = getPrisma();
    const changed = await prisma.$transaction(async (tx) => {
      const relation = await tx.entityRelation.findUnique({
        where: { id: input.relationId },
      });
      if (!relation) {
        // Missing relation is unchanged, not an error.
        return false;
      }

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

      return true;
    });

    return ok({ relationId: input.relationId, changed });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function getRelationships(
  rawQuery: unknown,
): Promise<ServiceResult<{ items: DirectedRelationDto[]; total: number; limit: number; offset: number }>> {
  const parsed = GetRelationshipsQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const { entityType, entityId, direction, relationType, limit, offset } = parsed.data;

  try {
    const prisma = getPrisma();
    const outgoingFilter = {
      fromEntityType: entityType,
      fromEntityId: entityId,
    };
    const incomingFilter = {
      toEntityType: entityType,
      toEntityId: entityId,
    };
    const where: Prisma.EntityRelationWhereInput = {
      AND: [
        direction === "outgoing"
          ? outgoingFilter
          : direction === "incoming"
            ? incomingFilter
            : { OR: [outgoingFilter, incomingFilter] },
        ...(relationType ? [{ relationType }] : []),
      ],
    };

    // Count and paginate the combined matching set, not each direction.
    const [rows, total] = await Promise.all([
      prisma.entityRelation.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: limit,
        skip: offset,
      }),
      prisma.entityRelation.count({ where }),
    ]);

    const endpointRefs: EntityRef[] = [];
    for (const row of rows) {
      const from = toEntityRef(row.fromEntityType, row.fromEntityId);
      if (from) endpointRefs.push(from);
      const to = toEntityRef(row.toEntityType, row.toEntityId);
      if (to) endpointRefs.push(to);
    }
    const titles = await getEntityTitles(endpointRefs);

    const items: DirectedRelationDto[] = rows.map((row) => ({
      ...mapRelationToDto(row, titles),
      direction:
        row.fromEntityType === entityType && row.fromEntityId === entityId
          ? "outgoing"
          : "incoming",
    }));

    return ok({ items, total, limit, offset });
  } catch (error) {
    return handleServiceError(error);
  }
}
