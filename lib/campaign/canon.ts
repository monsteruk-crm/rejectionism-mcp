import "server-only";
import { getPrisma } from "@/lib/prisma";
import { isTestModeEnabled } from "./test-mode";
import {
  ok,
  fail,
  testModeDisabledResult,
  handleServiceError,
  ServiceResult,
} from "./results";
import {
  CreateCanonEntryInputSchema,
  UpdateCanonEntryInputSchema,
  GetCanonQuerySchema,
  MutationSource,
} from "./schemas";
import { createActivityTx } from "./activity";
import { Prisma } from "@/app/generated/prisma/client";

export interface CanonEntryDto {
  id: string;
  key: string;
  value: string;
  category: string;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export function mapCanonToDto(item: {
  id: string;
  key: string;
  value: string;
  category: string;
  notes: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): CanonEntryDto {
  return {
    id: item.id,
    key: item.key,
    value: item.value,
    category: item.category,
    notes: item.notes,
    version: item.version,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function createCanonEntry(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<CanonEntryDto>> {
  if (!isTestModeEnabled()) {
    return testModeDisabledResult();
  }

  const parsed = CreateCanonEntryInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;

  try {
    const prisma = getPrisma();
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.canonEntry.findUnique({
        where: { key: input.key },
      });

      if (existing) {
        throw new Error("ALREADY_EXISTS");
      }

      const created = await tx.canonEntry.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          key: input.key,
          value: input.value,
          category: input.category,
          notes: input.notes,
          version: 1,
        },
      });

      await createActivityTx(tx, {
        entityType: "CANON_ENTRY",
        entityId: created.id,
        action: "CREATED",
        summary: `Created canon entry: ${created.key}`,
        source,
        metadata: {
          key: created.key,
          category: created.category,
          version: created.version,
        },
      });

      return created;
    });

    return ok(mapCanonToDto(result));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "ALREADY_EXISTS") {
      return fail("ALREADY_EXISTS", `Canon entry with key "${input.key}" already exists.`);
    }
    return handleServiceError(error);
  }
}

export async function updateCanonEntry(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<CanonEntryDto>> {
  if (!isTestModeEnabled()) {
    return testModeDisabledResult();
  }

  const parsed = UpdateCanonEntryInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;

  try {
    const prisma = getPrisma();
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.canonEntry.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      if (existing.version !== input.expectedVersion) {
        throw new Error("VERSION_CONFLICT");
      }

      const updateData: Prisma.CanonEntryUpdateInput = {
        version: input.expectedVersion + 1,
      };

      if (input.changes.value !== undefined) updateData.value = input.changes.value;
      if (input.changes.category !== undefined) updateData.category = input.changes.category;
      if (input.changes.notes !== undefined) updateData.notes = input.changes.notes;

      const updateResult = await tx.canonEntry.updateMany({
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
        entityType: "CANON_ENTRY",
        entityId: input.id,
        action: "UPDATED",
        summary: `Updated canon entry: ${existing.key}`,
        source,
        metadata: {
          key: existing.key,
          changedFields: Object.keys(input.changes),
          oldVersion: input.expectedVersion,
          newVersion: input.expectedVersion + 1,
        },
      });

      const updated = await tx.canonEntry.findUnique({
        where: { id: input.id },
      });

      return updated!;
    });

    return ok(mapCanonToDto(result));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "NOT_FOUND") {
      return fail("NOT_FOUND", `Canon entry with ID ${input.id} not found.`);
    }
    if (msg === "VERSION_CONFLICT") {
      return fail(
        "VERSION_CONFLICT",
        `Version conflict on canon entry ${input.id}. Expected version ${input.expectedVersion}.`,
      );
    }
    return handleServiceError(error);
  }
}

export async function getCanonEntryById(id: string): Promise<ServiceResult<CanonEntryDto>> {
  if (!isTestModeEnabled()) {
    return testModeDisabledResult();
  }

  try {
    const prisma = getPrisma();
    const item = await prisma.canonEntry.findUnique({
      where: { id },
    });

    if (!item) {
      return fail("NOT_FOUND", `Canon entry with ID ${id} not found.`);
    }

    return ok(mapCanonToDto(item));
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function getCanon(
  rawQuery: unknown = {},
): Promise<
  ServiceResult<
    | { mode: "single"; entry: CanonEntryDto }
    | { mode: "collection"; items: CanonEntryDto[]; total: number; limit: number; offset: number }
  >
> {
  if (!isTestModeEnabled()) {
    return testModeDisabledResult();
  }

  const parsed = GetCanonQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const { key, category, limit, offset } = parsed.data;

  try {
    const prisma = getPrisma();

    if (key) {
      const entry = await prisma.canonEntry.findUnique({
        where: { key },
      });

      if (!entry) {
        return fail("NOT_FOUND", `Canon entry with key "${key}" not found.`);
      }

      return ok({
        mode: "single",
        entry: mapCanonToDto(entry),
      });
    }

    const where: Prisma.CanonEntryWhereInput = category ? { category } : {};

    const [items, total] = await Promise.all([
      prisma.canonEntry.findMany({
        where,
        orderBy: [{ category: "asc" }, { key: "asc" }, { id: "asc" }],
        take: limit,
        skip: offset,
      }),
      prisma.canonEntry.count({ where }),
    ]);

    return ok({
      mode: "collection",
      items: items.map(mapCanonToDto),
      total,
      limit,
      offset,
    });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function listCanon(
  rawQuery: unknown = {},
): Promise<ServiceResult<{ items: CanonEntryDto[]; total: number; limit: number; offset: number }>> {
  const res = await getCanon(rawQuery);
  if (!res.ok) {
    return res;
  }

  if (res.data.mode === "single") {
    return ok({
      items: [res.data.entry],
      total: 1,
      limit: 1,
      offset: 0,
    });
  }

  return ok(res.data);
}
