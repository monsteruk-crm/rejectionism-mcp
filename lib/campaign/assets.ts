import "server-only";
import { getPrisma } from "@/lib/prisma";
import { ok, fail, handleServiceError, ServiceResult } from "./results";
import {
  CreateAssetInputSchema,
  UpdateAssetInputSchema,
  RegisterAssetInputSchema,
  ListAssetsQuerySchema,
  AssetStatus,
  MutationSource,
} from "./schemas";
import { createActivityTx } from "./activity";
import { isExternalHttpUrl } from "./external-url";
import { getTrustedOrigin } from "../auth/origin";
import { createRevisionTx } from "./asset-revisions";
import { appendExternalRepresentationTx } from "./asset-representations";
import { mapTagToDto } from "./tags";
import { mapRelationToDto } from "./relations";
import { getEntityTitles, toOriginalEntityType } from "./entity-refs";
import type { EntityRef } from "./tag-schemas";
import {
  AssetDetailDto,
  AssetListDto,
  RevisionRowLike,
  RepresentationStorageType,
  computeLegacyReferenceWarning,
  mapAssetDetailToDto,
  mapRepresentationToDto,
} from "./asset-dtos";
import { AddExternalAssetInputSchema } from "./asset-schemas";
import { Prisma } from "@/app/generated/prisma/client";

export interface AssetDto {
  id: string;
  name: string;
  kind: string;
  status: AssetStatus;
  sourceFilename: string | null;
  url: string | null;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export function mapAssetToDto(item: {
  id: string;
  name: string;
  kind: string;
  status: string;
  sourceFilename: string | null;
  url: string | null;
  notes: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): AssetDto {
  return {
    id: item.id,
    name: item.name,
    kind: item.kind,
    status: item.status as AssetStatus,
    sourceFilename: item.sourceFilename,
    url: item.url,
    notes: item.notes,
    version: item.version,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function createAsset(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<AssetDto>> {
  const parsed = CreateAssetInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;

  if (input.status === "APPROVED" && input.url === null) {
    return fail(
      "VALIDATION_ERROR",
      "APPROVED assets require at least one representation on the latest revision.",
    );
  }

  // New invalid URLs are rejected; existing legacy rows keep their plain-text URL.
  if (input.url !== null && !isExternalHttpUrl(input.url)) {
    return fail(
      "VALIDATION_ERROR",
      "url must be a public http(s) URL without credentials and without a local destination.",
    );
  }

  try {
    const prisma = getPrisma();
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.asset.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          name: input.name,
          kind: input.kind,
          status: input.status,
          sourceFilename: input.sourceFilename,
          url: input.url,
          notes: input.notes,
          version: 1,
        },
      });

      // Every Asset gets revision 1 at creation. A valid supplied URL also
      // creates the primary EXTERNAL_URL representation on revision 1, marked
      // with legacyAssetId so the legacy backfill never duplicates it.
      // A filename-only Asset creates no representation.
      const revision = await tx.assetRevision.create({
        data: {
          assetId: created.id,
          revisionNumber: 1,
        },
        select: { id: true },
      });

      if (input.url !== null) {
        await tx.assetRepresentation.create({
          data: {
            assetRevisionId: revision.id,
            storageType: "EXTERNAL_URL",
            sourceFilename: input.sourceFilename,
            externalUrl: input.url,
            legacyAssetId: created.id,
            isPrimary: true,
          },
        });
      }

      await createActivityTx(tx, {
        entityType: "ASSET",
        entityId: created.id,
        action: "CREATED",
        summary: `Created asset: ${created.name}`,
        source,
        metadata: {
          name: created.name,
          kind: created.kind,
          status: created.status,
          version: created.version,
        },
      });

      return created;
    });

    return ok(mapAssetToDto(result));
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function updateAsset(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<AssetDto>> {
  const parsed = UpdateAssetInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;

  try {
    const prisma = getPrisma();
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.asset.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      if (existing.version !== input.expectedVersion) {
        throw new Error("VERSION_CONFLICT");
      }

      const changes = input.changes;
      // A different non-null URL appends a legacy-compatible revision; a
      // same-string URL is a legacy no-op; null only clears the column.
      const appendUrl =
        changes.url !== undefined && changes.url !== null && changes.url !== existing.url
          ? changes.url
          : null;

      if (appendUrl !== null) {
        if (existing.status === "SUPERSEDED") {
          throw new Error("SUPERSEDED_REJECTED");
        }
        // New URLs are strictly validated; existing legacy rows keep their
        // plain-text URL on same-string saves.
        if (!isExternalHttpUrl(appendUrl)) {
          throw new Error("INVALID_URL");
        }
      }

      // CAS on the parent Asset before any child write; the version bumps once
      // for the combined operation (column updates + optional URL append).
      const updateData: Prisma.AssetUpdateInput = {
        version: input.expectedVersion + 1,
      };

      if (changes.name !== undefined) updateData.name = changes.name;
      if (changes.kind !== undefined) updateData.kind = changes.kind;
      if (changes.sourceFilename !== undefined) updateData.sourceFilename = changes.sourceFilename;
      if (changes.url !== undefined) updateData.url = changes.url;
      if (changes.notes !== undefined) updateData.notes = changes.notes;

      const updateResult = await tx.asset.updateMany({
        where: {
          id: input.id,
          version: input.expectedVersion,
        },
        data: updateData,
      });

      if (updateResult.count === 0) {
        throw new Error("VERSION_CONFLICT");
      }

      let statusAfter: AssetStatus = existing.status;

      if (appendUrl !== null) {
        // Composed via the shared tx helpers (no nested transactions). The
        // legacy marker moves to the appended representation only when no
        // earlier representation carries it.
        const marker = await tx.assetRepresentation.findFirst({
          where: { legacyAssetId: existing.id },
          select: { id: true },
        });

        const { revision, statusAfter: statusAfterRevision } = await createRevisionTx(tx, {
          assetId: existing.id,
          label: null,
          notes: null,
          assetStatus: existing.status,
          source,
          expectedVersion: input.expectedVersion,
        });

        // Pass the pre-revision status: content added to a previously APPROVED
        // asset must end up NEEDS_WORK.
        await appendExternalRepresentationTx(tx, {
          assetId: existing.id,
          assetStatus: existing.status,
          revisionId: revision.id,
          input: { externalUrl: appendUrl, notes: null, sourceFilename: null },
          legacyAssetId: marker ? null : existing.id,
          source,
          expectedVersion: input.expectedVersion,
        });

        statusAfter = existing.status === "APPROVED" ? "NEEDS_WORK" : statusAfterRevision;
      }

      // An explicitly supplied status wins over mutation-driven transitions,
      // but only after resulting-state validation: APPROVED requires at least
      // one representation on the latest revision.
      if (changes.status !== undefined) {
        if (changes.status === "APPROVED") {
          const latestRevision = await tx.assetRevision.findFirst({
            where: { assetId: existing.id },
            orderBy: { revisionNumber: "desc" },
            select: { _count: { select: { representations: true } } },
          });
          if (!latestRevision || latestRevision._count.representations === 0) {
            throw new Error("APPROVED_REQUIRES_REPRESENTATION");
          }
        }
        if (changes.status !== statusAfter) {
          await tx.asset.update({
            where: { id: existing.id },
            data: { status: changes.status },
          });
        }
        statusAfter = changes.status;
      }

      await createActivityTx(tx, {
        entityType: "ASSET",
        entityId: input.id,
        action: "UPDATED",
        summary: `Updated asset: ${changes.name ?? existing.name}`,
        source,
        metadata: {
          changedFields: Object.keys(changes),
          oldVersion: input.expectedVersion,
          newVersion: input.expectedVersion + 1,
        },
      });

      const updated = await tx.asset.findUnique({
        where: { id: input.id },
      });

      return updated!;
    });

    return ok(mapAssetToDto(result));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "NOT_FOUND") {
      return fail("NOT_FOUND", `Asset with ID ${input.id} not found.`);
    }
    if (msg === "VERSION_CONFLICT") {
      return fail(
        "VERSION_CONFLICT",
        `Version conflict on asset ${input.id}. Expected version ${input.expectedVersion}.`,
      );
    }
    if (msg === "SUPERSEDED_REJECTED") {
      return fail(
        "VALIDATION_ERROR",
        "Asset is SUPERSEDED; content changes are rejected until an explicit status update restores it.",
      );
    }
    if (msg === "INVALID_URL") {
      return fail(
        "VALIDATION_ERROR",
        "url must be a public http(s) URL without credentials and without a local destination.",
      );
    }
    if (msg === "APPROVED_REQUIRES_REPRESENTATION") {
      return fail(
        "VALIDATION_ERROR",
        "APPROVED assets require at least one representation on the latest revision.",
      );
    }
    return handleServiceError(error);
  }
}

export async function registerAsset(
  rawInput: unknown,
  source: MutationSource = "mcp",
): Promise<ServiceResult<AssetDto>> {
  const parsed = RegisterAssetInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  if (parsed.data.action === "create") {
    // Strip the discriminator so the strict create schema is not rejected.
    const { action: _action, ...createPayload } = parsed.data;
    return await createAsset(createPayload, source);
  } else {
    const { action: _action, ...updatePayload } = parsed.data;
    return await updateAsset(updatePayload, source);
  }
}

export async function getAssetById(id: string): Promise<ServiceResult<AssetDetailDto>> {
  try {
    const prisma = getPrisma();
    const trustedOrigin = getTrustedOrigin();
    const [item, tagRows, relationRows] = await Promise.all([
      prisma.asset.findUnique({
        where: { id },
        include: {
          revisions: {
            include: { representations: true },
          },
        },
      }),
      prisma.entityTag.findMany({
        where: { entityType: "ASSET", entityId: id },
        include: { tag: true },
        orderBy: [{ tag: { slug: "asc" } }],
      }),
      prisma.entityRelation.findMany({
        where: {
          OR: [
            { fromEntityType: "ASSET", fromEntityId: id },
            { toEntityType: "ASSET", toEntityId: id },
          ],
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      }),
    ]);

    if (!item) {
      return fail("NOT_FOUND", `Asset with ID ${id} not found.`);
    }

    // Relation endpoints are DB-constrained to the original seven types; the
    // narrowing keeps the polymorphic storage type out of the read helpers.
    const endpointRefs: EntityRef[] = [];
    for (const relation of relationRows) {
      const fromType = toOriginalEntityType(relation.fromEntityType);
      if (fromType) {
        endpointRefs.push({ entityType: fromType, entityId: relation.fromEntityId });
      }
      const toType = toOriginalEntityType(relation.toEntityType);
      if (toType) {
        endpointRefs.push({ entityType: toType, entityId: relation.toEntityId });
      }
    }
    const titles = await getEntityTitles(endpointRefs);

    return ok(
      mapAssetDetailToDto(item, trustedOrigin, {
        tags: tagRows.map((row) => mapTagToDto(row.tag)),
        relationships: relationRows.map((relation) => mapRelationToDto(relation, titles)),
      }),
    );
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function addExternalAsset(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<AssetDetailDto>> {
  const parsed = AddExternalAssetInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const { asset: assetInput, representation: repInput } = parsed.data;

  try {
    const prisma = getPrisma();

    const created = await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: {
          ...(assetInput.id ? { id: assetInput.id } : {}),
          name: assetInput.name,
          kind: assetInput.kind,
          status: assetInput.status,
          notes: assetInput.notes,
          sourceFilename: repInput.sourceFilename ?? null,
          url: repInput.externalUrl,
          version: 1,
        },
      });

      const revision = await tx.assetRevision.create({
        data: {
          assetId: asset.id,
          revisionNumber: 1,
        },
      });

      const representation = await tx.assetRepresentation.create({
        data: {
          assetRevisionId: revision.id,
          storageType: "EXTERNAL_URL",
          label: repInput.label ?? null,
          notes: repInput.notes ?? null,
          variant: repInput.variant ?? null,
          format: repInput.format ?? null,
          sourceFilename: repInput.sourceFilename ?? null,
          externalUrl: repInput.externalUrl,
          legacyAssetId: asset.id,
          isPrimary: true,
        },
      });

      await createActivityTx(tx, {
        entityType: "ASSET",
        entityId: asset.id,
        action: "CREATED",
        summary: `Created asset with external representation: ${asset.name}`,
        source,
        metadata: {
          name: asset.name,
          kind: asset.kind,
          status: asset.status,
          version: asset.version,
          representationId: representation.id,
        },
      });

      return asset;
    });

    return await getAssetById(created.id);
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function listAssets(
  rawQuery: unknown = {},
): Promise<ServiceResult<{ items: AssetListDto[]; total: number; limit: number; offset: number }>> {
  const parsed = ListAssetsQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const { status, kind, search, storageType, tags, limit, offset } = parsed.data;

  try {
    const prisma = getPrisma();
    const trustedOrigin = getTrustedOrigin();
    const where: Prisma.AssetWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (kind && kind.trim().length > 0) {
      where.kind = { contains: kind, mode: "insensitive" };
    }

    if (search && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { kind: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { sourceFilename: { contains: q, mode: "insensitive" } },
        {
          revisions: {
            some: {
              representations: {
                some: {
                  OR: [
                    { label: { contains: q, mode: "insensitive" } },
                    { notes: { contains: q, mode: "insensitive" } },
                    { sourceFilename: { contains: q, mode: "insensitive" } },
                  ],
                },
              },
            },
          },
        },
      ];
    }

    if (storageType) {
      where.revisions = {
        some: {
          representations: {
            some: {
              storageType,
            },
          },
        },
      };
    }

    // Tag predicate: assets must carry ALL requested slugs; an unknown slug
    // yields zero results. EntityTag has no relation to Asset, so the matching
    // IDs are resolved through one membership query and a distinct-tag count.
    if (tags && tags.length > 0) {
      const uniqueSlugs = [...new Set(tags)];
      const tagRows = await prisma.tag.findMany({
        where: { slug: { in: uniqueSlugs } },
        select: { id: true },
      });
      if (tagRows.length !== uniqueSlugs.length) {
        return ok({ items: [], total: 0, limit, offset });
      }
      // (tagId, entityId) is unique, so a per-entity distinct-tag count of at
      // least the requested number means the asset carries ALL requested slugs.
      const memberships = await prisma.entityTag.findMany({
        where: {
          entityType: "ASSET",
          tagId: { in: tagRows.map((tag) => tag.id) },
        },
        select: { entityId: true, tagId: true },
      });
      const matchedTagCount = new Map<string, number>();
      for (const membership of memberships) {
        matchedTagCount.set(
          membership.entityId,
          (matchedTagCount.get(membership.entityId) ?? 0) + 1,
        );
      }
      const matchingIds = [...matchedTagCount.entries()]
        .filter(([, count]) => count >= tagRows.length)
        .map(([entityId]) => entityId);
      where.id = { in: matchingIds };
    }

    const [items, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        orderBy: [{ status: "asc" }, { name: "asc" }, { id: "asc" }],
        take: limit,
        skip: offset,
      }),
      prisma.asset.count({ where }),
    ]);

    // Grouped child fetch for the returned page only: one extra query instead
    // of per-asset joins; list consumers never fetch children themselves.
    const assetIds = items.map((item) => item.id);
    const revisions =
      assetIds.length > 0
        ? await prisma.assetRevision.findMany({
            where: { assetId: { in: assetIds } },
            include: { representations: true },
          })
        : [];

    const revisionsByAsset = new Map<string, RevisionRowLike[]>();
    for (const revision of revisions) {
      const list = revisionsByAsset.get(revision.assetId);
      if (list) {
        list.push(revision);
      } else {
        revisionsByAsset.set(revision.assetId, [revision]);
      }
    }

    const tagRows =
      assetIds.length > 0
        ? await prisma.entityTag.findMany({
            where: { entityType: "ASSET", entityId: { in: assetIds } },
            include: { tag: true },
          })
        : [];
    const slugsByAsset = new Map<string, string[]>();
    for (const row of tagRows) {
      const slugs = slugsByAsset.get(row.entityId) ?? [];
      slugs.push(row.tag.slug);
      slugsByAsset.set(row.entityId, slugs);
    }
    for (const slugs of slugsByAsset.values()) {
      slugs.sort();
    }

    const listItems: AssetListDto[] = items.map((item) => {
      const assetRevisions = revisionsByAsset.get(item.id) ?? [];
      const latestRevision = assetRevisions.reduce<RevisionRowLike | null>(
        (latest, revision) =>
          latest === null || revision.revisionNumber > latest.revisionNumber ? revision : latest,
        null,
      );
      const primary = latestRevision?.representations.find((r) => r.isPrimary) ?? null;

      const storageTypeSet = new Set<RepresentationStorageType>();
      for (const revision of assetRevisions) {
        for (const representation of revision.representations) {
          storageTypeSet.add(representation.storageType as RepresentationStorageType);
        }
      }
      const storageTypes = (["BLOB", "EXTERNAL_URL"] as const).filter((storageType) =>
        storageTypeSet.has(storageType),
      );

      return {
        ...mapAssetToDto(item),
        revisionCount: assetRevisions.length,
        latestRevisionNumber: latestRevision?.revisionNumber ?? null,
        primaryRepresentation: primary ? mapRepresentationToDto(primary, trustedOrigin) : null,
        storageTypes,
        tags: slugsByAsset.get(item.id) ?? [],
        legacyReferenceWarning: computeLegacyReferenceWarning(
          item.url,
          primary?.externalUrl ?? null,
        ),
      };
    });

    return ok({
      items: listItems,
      total,
      limit,
      offset,
    });
  } catch (error) {
    return handleServiceError(error);
  }
}
