import "server-only";
import { getPrisma } from "@/lib/prisma";
import { ok, fail, handleServiceError, ServiceResult } from "./results";
import { createActivityTx } from "./activity";
import { findEntityTitleTx } from "./entity-refs";
import {
  ListTagsQuerySchema,
  TagEntityInputSchema,
  UntagEntityInputSchema,
  normalizeTagSlug,
  TagDto,
  EntityRef,
  OriginalEntityType,
} from "./tag-schemas";
import type { MutationSource } from "./schemas";
import { Prisma } from "@/app/generated/prisma/client";

/**
 * Generic tag services (upgrade plan Phase 4, section 4 tools 36-38).
 *
 * Tag membership is an independent set operation: unique constraints and
 * idempotent attach/remove replace expected-version arguments, and membership
 * changes never increment an entity version (ADR 0002/0005 scoped exception).
 * No-op repeats write no Activity. Unique-conflict races are retried outside
 * the failed transaction; SQL never continues inside an aborted transaction.
 * Tag definitions are never hard-deleted here.
 */

type TagRecord = Prisma.TagGetPayload<Record<never, never>>;

export function mapTagToDto(tag: TagRecord): TagDto {
  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    createdAt: tag.createdAt.toISOString(),
  };
}

const MAX_SET_ATTEMPTS = 3;

export async function listTags(
  rawQuery: unknown = {},
): Promise<ServiceResult<{ items: TagDto[]; total: number; limit: number; offset: number }>> {
  const parsed = ListTagsQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const { search, limit, offset } = parsed.data;

  try {
    const prisma = getPrisma();
    const where: Prisma.TagWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.tag.findMany({
        where,
        orderBy: [{ slug: "asc" }, { id: "asc" }],
        take: limit,
        skip: offset,
      }),
      prisma.tag.count({ where }),
    ]);

    return ok({ items: items.map(mapTagToDto), total, limit, offset });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function tagEntity(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<{ tag: TagDto; entity: EntityRef; changed: boolean }>> {
  const parsed = TagEntityInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;
  const entity: EntityRef = { entityType: input.entityType, entityId: input.entityId };
  const slug = normalizeTagSlug(input.tag);
  if (slug.length === 0 || slug.length > 80) {
    return fail(
      "VALIDATION_ERROR",
      "tag must normalize to a slug of 1..80 lowercase ASCII characters.",
    );
  }

  for (let attempt = 0; attempt < MAX_SET_ATTEMPTS; attempt += 1) {
    try {
      const prisma = getPrisma();
      const result = await prisma.$transaction(async (tx) => {
        const entityTitle = await findEntityTitleTx(tx, input.entityType, input.entityId);
        if (entityTitle === null) {
          throw new Error("NOT_FOUND");
        }

        let tag = await tx.tag.findUnique({ where: { slug } });
        let tagCreated = false;
        if (!tag) {
          // Tag.name is the first submitted trimmed display name and is immutable.
          tag = await tx.tag.create({ data: { name: input.tag, slug } });
          tagCreated = true;
        }

        const membership = await tx.entityTag.findUnique({
          where: {
            tagId_entityType_entityId: {
              tagId: tag.id,
              entityType: input.entityType,
              entityId: input.entityId,
            },
          },
          select: { tagId: true },
        });

        let attached = false;
        if (!membership) {
          await tx.entityTag.create({
            data: {
              tagId: tag.id,
              entityType: input.entityType,
              entityId: input.entityId,
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
            entityType: input.entityType,
            entityId: input.entityId,
            action: "TAG_ATTACHED",
            summary: `Attached tag ${tag.slug}`,
            source,
            metadata: { tagId: tag.id, slug: tag.slug },
          });
        }

        return { tag, changed: attached };
      });

      return ok({ tag: mapTagToDto(result.tag), entity, changed: result.changed });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        // Lost a create race (slug or membership). Retry the whole procedure
        // outside the aborted transaction; the retry converges to a no-op.
        continue;
      }
      return mapTagServiceError(error, input.entityType, input.entityId);
    }
  }

  return handleServiceError(
    new Error("Tag attach could not be completed after repeated unique conflicts."),
  );
}

export async function untagEntity(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<{ entity: EntityRef; tagSlug: string; changed: boolean }>> {
  const parsed = UntagEntityInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;
  const entity: EntityRef = { entityType: input.entityType, entityId: input.entityId };

  try {
    const prisma = getPrisma();
    const result = await prisma.$transaction(async (tx) => {
      const entityTitle = await findEntityTitleTx(tx, input.entityType, input.entityId);
      if (entityTitle === null) {
        throw new Error("NOT_FOUND");
      }

      const tag = await tx.tag.findUnique({ where: { slug: input.tagSlug } });
      if (!tag) {
        return { tagSlug: input.tagSlug, changed: false };
      }

      const membership = await tx.entityTag.findUnique({
        where: {
          tagId_entityType_entityId: {
            tagId: tag.id,
            entityType: input.entityType,
            entityId: input.entityId,
          },
        },
        select: { tagId: true },
      });
      if (!membership) {
        return { tagSlug: tag.slug, changed: false };
      }

      // Removes only the association; the tag definition is never deleted.
      await tx.entityTag.delete({
        where: {
          tagId_entityType_entityId: {
            tagId: tag.id,
            entityType: input.entityType,
            entityId: input.entityId,
          },
        },
      });

      await createActivityTx(tx, {
        entityType: input.entityType,
        entityId: input.entityId,
        action: "TAG_DETACHED",
        summary: `Detached tag ${tag.slug}`,
        source,
        metadata: { tagId: tag.id, slug: tag.slug },
      });

      return { tagSlug: tag.slug, changed: true };
    });

    return ok({ entity, tagSlug: result.tagSlug, changed: result.changed });
  } catch (error) {
    return mapTagServiceError(error, input.entityType, input.entityId);
  }
}

function mapTagServiceError(
  error: unknown,
  entityType: OriginalEntityType,
  entityId: string,
): ServiceResult<never> {
  const message = error instanceof Error ? error.message : "";
  if (message === "NOT_FOUND") {
    return fail("NOT_FOUND", `${entityType} entity ${entityId} not found.`);
  }
  return handleServiceError(error);
}
