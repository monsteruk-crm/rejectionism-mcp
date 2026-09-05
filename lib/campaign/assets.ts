import "server-only";
import { getPrisma } from "@/lib/prisma";
import { isTestModeEnabled } from "./test-mode";
import { ok, fail, testModeDisabledResult, handleServiceError, ServiceResult } from "./results";
import {
  CreateAssetInputSchema,
  UpdateAssetInputSchema,
  RegisterAssetInputSchema,
  ListAssetsQuerySchema,
  AssetStatus,
  MutationSource,
} from "./schemas";
import { createActivityTx } from "./activity";
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
  if (!isTestModeEnabled()) {
    return testModeDisabledResult();
  }

  const parsed = CreateAssetInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;

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
  if (!isTestModeEnabled()) {
    return testModeDisabledResult();
  }

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

      const updateData: Prisma.AssetUpdateInput = {
        version: input.expectedVersion + 1,
      };

      if (input.changes.name !== undefined) updateData.name = input.changes.name;
      if (input.changes.kind !== undefined) updateData.kind = input.changes.kind;
      if (input.changes.status !== undefined) updateData.status = input.changes.status;
      if (input.changes.sourceFilename !== undefined)
        updateData.sourceFilename = input.changes.sourceFilename;
      if (input.changes.url !== undefined) updateData.url = input.changes.url;
      if (input.changes.notes !== undefined) updateData.notes = input.changes.notes;

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

      await createActivityTx(tx, {
        entityType: "ASSET",
        entityId: input.id,
        action: "UPDATED",
        summary: `Updated asset: ${input.changes.name ?? existing.name}`,
        source,
        metadata: {
          changedFields: Object.keys(input.changes),
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
    return handleServiceError(error);
  }
}

export async function registerAsset(
  rawInput: unknown,
  source: MutationSource = "mcp",
): Promise<ServiceResult<AssetDto>> {
  if (!isTestModeEnabled()) {
    return testModeDisabledResult();
  }

  const parsed = RegisterAssetInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  if (parsed.data.action === "create") {
    return await createAsset(parsed.data, source);
  } else {
    return await updateAsset(parsed.data, source);
  }
}

export async function getAssetById(id: string): Promise<ServiceResult<AssetDto>> {
  if (!isTestModeEnabled()) {
    return testModeDisabledResult();
  }

  try {
    const prisma = getPrisma();
    const item = await prisma.asset.findUnique({
      where: { id },
    });

    if (!item) {
      return fail("NOT_FOUND", `Asset with ID ${id} not found.`);
    }

    return ok(mapAssetToDto(item));
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function listAssets(
  rawQuery: unknown = {},
): Promise<ServiceResult<{ items: AssetDto[]; total: number; limit: number; offset: number }>> {
  if (!isTestModeEnabled()) {
    return testModeDisabledResult();
  }

  const parsed = ListAssetsQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const { status, kind, limit, offset } = parsed.data;

  try {
    const prisma = getPrisma();
    const where: Prisma.AssetWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (kind && kind.trim().length > 0) {
      where.kind = { contains: kind, mode: "insensitive" };
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

    return ok({
      items: items.map(mapAssetToDto),
      total,
      limit,
      offset,
    });
  } catch (error) {
    return handleServiceError(error);
  }
}
