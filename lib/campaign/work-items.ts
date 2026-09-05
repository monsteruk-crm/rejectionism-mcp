import "server-only";
import { getPrisma } from "@/lib/prisma";
import { isTestModeEnabled } from "./test-mode";
import { ok, fail, testModeDisabledResult, handleServiceError, ServiceResult } from "./results";
import {
  CreateWorkItemInputSchema,
  UpdateWorkItemInputSchema,
  ListWorkItemsQuerySchema,
  WorkItemStatus,
  MutationSource,
} from "./schemas";
import { createActivityTx } from "./activity";
import { Prisma } from "@/app/generated/prisma/client";

export interface WorkItemDto {
  id: string;
  title: string;
  description: string;
  status: WorkItemStatus;
  priority: number;
  dueDate: string | null;
  blockedReason: string | null;
  evidenceUrl: string | null;
  completionNote: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export function mapToDto(item: {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  dueDate: Date | null;
  blockedReason: string | null;
  evidenceUrl: string | null;
  completionNote: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): WorkItemDto {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    status: item.status as WorkItemStatus,
    priority: item.priority,
    dueDate: item.dueDate ? item.dueDate.toISOString() : null,
    blockedReason: item.blockedReason,
    evidenceUrl: item.evidenceUrl,
    completionNote: item.completionNote,
    version: item.version,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function validateWorkItemState(
  status: WorkItemStatus,
  evidenceUrl: string | null | undefined,
  completionNote: string | null | undefined,
  blockedReason: string | null | undefined,
): { valid: boolean; error?: string } {
  if (status === "DONE") {
    const hasEvidence = !!(evidenceUrl && evidenceUrl.trim().length > 0);
    const hasNote = !!(completionNote && completionNote.trim().length > 0);
    if (!hasEvidence && !hasNote) {
      return {
        valid: false,
        error: "Work items cannot move to DONE without an evidenceUrl or a completionNote.",
      };
    }
  }

  if (status === "BLOCKED") {
    const hasBlockedReason = !!(blockedReason && blockedReason.trim().length > 0);
    if (!hasBlockedReason) {
      return {
        valid: false,
        error: "Work items with BLOCKED status must have a blockedReason.",
      };
    }
  }

  return { valid: true };
}

export async function createWorkItem(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<WorkItemDto>> {
  if (!isTestModeEnabled()) {
    return testModeDisabledResult();
  }

  const parsed = CreateWorkItemInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;

  const validation = validateWorkItemState(
    input.status,
    input.evidenceUrl,
    input.completionNote,
    input.blockedReason,
  );
  if (!validation.valid) {
    return fail("VALIDATION_ERROR", validation.error!);
  }

  try {
    const prisma = getPrisma();
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.workItem.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          title: input.title,
          description: input.description,
          status: input.status,
          priority: input.priority,
          dueDate: input.dueDate,
          blockedReason: input.blockedReason,
          evidenceUrl: input.evidenceUrl,
          completionNote: input.completionNote,
          version: 1,
        },
      });

      await createActivityTx(tx, {
        entityType: "WORK_ITEM",
        entityId: created.id,
        action: "CREATED",
        summary: `Created work item: ${created.title}`,
        source,
        metadata: {
          status: created.status,
          priority: created.priority,
          version: created.version,
        },
      });

      return created;
    });

    return ok(mapToDto(result));
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function updateWorkItem(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<WorkItemDto>> {
  if (!isTestModeEnabled()) {
    return testModeDisabledResult();
  }

  const parsed = UpdateWorkItemInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;

  // Merge completionNote if passed at top-level
  const changes = { ...input.changes };
  if (input.completionNote !== undefined && changes.completionNote === undefined) {
    changes.completionNote = input.completionNote;
  }

  try {
    const prisma = getPrisma();
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.workItem.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      if (existing.version !== input.expectedVersion) {
        throw new Error("VERSION_CONFLICT");
      }

      const resultingStatus = (changes.status ?? existing.status) as WorkItemStatus;
      const resultingEvidenceUrl =
        changes.evidenceUrl !== undefined ? changes.evidenceUrl : existing.evidenceUrl;
      const resultingCompletionNote =
        changes.completionNote !== undefined ? changes.completionNote : existing.completionNote;

      let resultingBlockedReason =
        changes.blockedReason !== undefined ? changes.blockedReason : existing.blockedReason;

      // If moving away from BLOCKED and blockedReason was not explicitly provided in changes, clear it
      if (
        existing.status === "BLOCKED" &&
        resultingStatus !== "BLOCKED" &&
        changes.blockedReason === undefined
      ) {
        resultingBlockedReason = null;
      }

      const validation = validateWorkItemState(
        resultingStatus,
        resultingEvidenceUrl,
        resultingCompletionNote,
        resultingBlockedReason,
      );
      if (!validation.valid) {
        throw new Error(`VALIDATION:${validation.error}`);
      }

      const updateData: Prisma.WorkItemUpdateInput = {
        version: input.expectedVersion + 1,
      };

      if (changes.title !== undefined) updateData.title = changes.title;
      if (changes.description !== undefined) updateData.description = changes.description;
      if (changes.status !== undefined) updateData.status = changes.status;
      if (changes.priority !== undefined) updateData.priority = changes.priority;
      if (changes.dueDate !== undefined) updateData.dueDate = changes.dueDate;
      if (
        changes.blockedReason !== undefined ||
        resultingBlockedReason !== existing.blockedReason
      ) {
        updateData.blockedReason = resultingBlockedReason;
      }
      if (changes.evidenceUrl !== undefined) updateData.evidenceUrl = changes.evidenceUrl;
      if (changes.completionNote !== undefined) updateData.completionNote = changes.completionNote;

      const updateResult = await tx.workItem.updateMany({
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
        entityType: "WORK_ITEM",
        entityId: input.id,
        action: "UPDATED",
        summary: `Updated work item: ${changes.title ?? existing.title}`,
        source,
        metadata: {
          changedFields: Object.keys(changes),
          oldVersion: input.expectedVersion,
          newVersion: input.expectedVersion + 1,
          status: resultingStatus,
        },
      });

      const updated = await tx.workItem.findUnique({
        where: { id: input.id },
      });

      return updated!;
    });

    return ok(mapToDto(result));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "NOT_FOUND") {
      return fail("NOT_FOUND", `Work item with ID ${input.id} not found.`);
    }
    if (msg === "VERSION_CONFLICT") {
      return fail(
        "VERSION_CONFLICT",
        `Version conflict on work item ${input.id}. Expected version ${input.expectedVersion}.`,
      );
    }
    if (msg.startsWith("VALIDATION:")) {
      return fail("VALIDATION_ERROR", msg.replace("VALIDATION:", ""));
    }
    return handleServiceError(error);
  }
}

export async function getWorkItemById(id: string): Promise<ServiceResult<WorkItemDto>> {
  if (!isTestModeEnabled()) {
    return testModeDisabledResult();
  }

  try {
    const prisma = getPrisma();
    const item = await prisma.workItem.findUnique({
      where: { id },
    });

    if (!item) {
      return fail("NOT_FOUND", `Work item with ID ${id} not found.`);
    }

    return ok(mapToDto(item));
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function listWorkItems(
  rawQuery: unknown = {},
): Promise<ServiceResult<{ items: WorkItemDto[]; total: number; limit: number; offset: number }>> {
  if (!isTestModeEnabled()) {
    return testModeDisabledResult();
  }

  const parsed = ListWorkItemsQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const { status, minPriority, dueBefore, search, limit, offset } = parsed.data;

  try {
    const prisma = getPrisma();
    const where: Prisma.WorkItemWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (minPriority !== undefined) {
      where.priority = { gte: minPriority };
    }

    if (dueBefore) {
      where.dueDate = { lte: dueBefore };
    }

    if (search && search.trim().length > 0) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.workItem.findMany({
        where,
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }, { id: "asc" }],
        take: limit,
        skip: offset,
      }),
      prisma.workItem.count({ where }),
    ]);

    return ok({
      items: items.map(mapToDto),
      total,
      limit,
      offset,
    });
  } catch (error) {
    return handleServiceError(error);
  }
}
