import "server-only";
import { getPrisma } from "@/lib/prisma";
import { ok, fail, handleServiceError, ServiceResult } from "./results";
import {
  CreateContentItemInputSchema,
  UpdateContentItemInputSchema,
  ListContentItemsQuerySchema,
  ContentStatus,
  MutationSource,
} from "./schemas";
import { createActivityTx } from "./activity";
import { Prisma } from "@/app/generated/prisma/client";

export interface ContentItemDto {
  id: string;
  title: string;
  format: string;
  channel: string;
  status: ContentStatus;
  scheduledFor: string | null;
  publishedUrl: string | null;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export function mapContentItemToDto(item: {
  id: string;
  title: string;
  format: string;
  channel: string;
  status: string;
  scheduledFor: Date | null;
  publishedUrl: string | null;
  notes: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): ContentItemDto {
  return {
    id: item.id,
    title: item.title,
    format: item.format,
    channel: item.channel,
    status: item.status as ContentStatus,
    scheduledFor: item.scheduledFor ? item.scheduledFor.toISOString() : null,
    publishedUrl: item.publishedUrl,
    notes: item.notes,
    version: item.version,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function validateContentItemState(
  status: ContentStatus,
  scheduledFor: Date | null | undefined,
  publishedUrl: string | null | undefined,
): { valid: boolean; error?: string } {
  if (status === "SCHEDULED" && !scheduledFor) {
    return {
      valid: false,
      error: "scheduledFor date is required when status is SCHEDULED.",
    };
  }
  if (status === "PUBLISHED" && (!publishedUrl || publishedUrl.trim().length === 0)) {
    return {
      valid: false,
      error: "publishedUrl is required when status is PUBLISHED.",
    };
  }
  return { valid: true };
}

export async function createContentItem(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<ContentItemDto>> {
  const parsed = CreateContentItemInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;

  try {
    const prisma = getPrisma();
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.contentItem.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          title: input.title,
          format: input.format,
          channel: input.channel,
          status: input.status,
          scheduledFor: input.scheduledFor,
          publishedUrl: input.publishedUrl,
          notes: input.notes,
          version: 1,
        },
      });

      await createActivityTx(tx, {
        entityType: "CONTENT_ITEM",
        entityId: created.id,
        action: "CREATED",
        summary: `Created content item: ${created.title}`,
        source,
        metadata: {
          title: created.title,
          format: created.format,
          channel: created.channel,
          status: created.status,
          version: created.version,
        },
      });

      return created;
    });

    return ok(mapContentItemToDto(result));
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function updateContentItem(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<ContentItemDto>> {
  const parsed = UpdateContentItemInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;

  try {
    const prisma = getPrisma();
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.contentItem.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      if (existing.version !== input.expectedVersion) {
        throw new Error("VERSION_CONFLICT");
      }

      const resultingStatus = (input.changes.status ?? existing.status) as ContentStatus;
      const resultingScheduledFor =
        input.changes.scheduledFor !== undefined
          ? input.changes.scheduledFor
          : existing.scheduledFor;
      const resultingPublishedUrl =
        input.changes.publishedUrl !== undefined
          ? input.changes.publishedUrl
          : existing.publishedUrl;

      const validation = validateContentItemState(
        resultingStatus,
        resultingScheduledFor,
        resultingPublishedUrl,
      );
      if (!validation.valid) {
        throw new Error(`VALIDATION:${validation.error}`);
      }

      const updateData: Prisma.ContentItemUpdateInput = {
        version: input.expectedVersion + 1,
      };

      if (input.changes.title !== undefined) updateData.title = input.changes.title;
      if (input.changes.format !== undefined) updateData.format = input.changes.format;
      if (input.changes.channel !== undefined) updateData.channel = input.changes.channel;
      if (input.changes.status !== undefined) updateData.status = input.changes.status;
      if (input.changes.scheduledFor !== undefined)
        updateData.scheduledFor = input.changes.scheduledFor;
      if (input.changes.publishedUrl !== undefined)
        updateData.publishedUrl = input.changes.publishedUrl;
      if (input.changes.notes !== undefined) updateData.notes = input.changes.notes;

      const updateResult = await tx.contentItem.updateMany({
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
        entityType: "CONTENT_ITEM",
        entityId: input.id,
        action: "UPDATED",
        summary: `Updated content item: ${input.changes.title ?? existing.title}`,
        source,
        metadata: {
          changedFields: Object.keys(input.changes),
          oldVersion: input.expectedVersion,
          newVersion: input.expectedVersion + 1,
          status: resultingStatus,
        },
      });

      const updated = await tx.contentItem.findUnique({
        where: { id: input.id },
      });

      return updated!;
    });

    return ok(mapContentItemToDto(result));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "NOT_FOUND") {
      return fail("NOT_FOUND", `Content item with ID ${input.id} not found.`);
    }
    if (msg === "VERSION_CONFLICT") {
      return fail(
        "VERSION_CONFLICT",
        `Version conflict on content item ${input.id}. Expected version ${input.expectedVersion}.`,
      );
    }
    if (msg.startsWith("VALIDATION:")) {
      return fail("VALIDATION_ERROR", msg.replace("VALIDATION:", ""));
    }
    return handleServiceError(error);
  }
}

export async function getContentItemById(id: string): Promise<ServiceResult<ContentItemDto>> {
  try {
    const prisma = getPrisma();
    const item = await prisma.contentItem.findUnique({
      where: { id },
    });

    if (!item) {
      return fail("NOT_FOUND", `Content item with ID ${id} not found.`);
    }

    return ok(mapContentItemToDto(item));
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function listContentItems(
  rawQuery: unknown = {},
): Promise<
  ServiceResult<{ items: ContentItemDto[]; total: number; limit: number; offset: number }>
> {
  const parsed = ListContentItemsQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const { status, limit, offset } = parsed.data;

  try {
    const prisma = getPrisma();
    const where: Prisma.ContentItemWhereInput = status ? { status } : {};

    const [items, total] = await Promise.all([
      prisma.contentItem.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: limit,
        skip: offset,
      }),
      prisma.contentItem.count({ where }),
    ]);

    return ok({
      items: items.map(mapContentItemToDto),
      total,
      limit,
      offset,
    });
  } catch (error) {
    return handleServiceError(error);
  }
}
