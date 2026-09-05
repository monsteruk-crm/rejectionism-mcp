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
  ListActivityQuerySchema,
  EntityType,
  MutationSource,
} from "./schemas";
import { Prisma } from "@/app/generated/prisma/client";

export interface CreateActivityParams {
  entityType: EntityType;
  entityId: string;
  action: string;
  summary: string;
  source: MutationSource;
  metadata?: Record<string, unknown> | null;
}

export async function createActivityTx(
  tx: Prisma.TransactionClient,
  params: CreateActivityParams,
) {
  const metadataJson: Prisma.InputJsonValue = {
    source: params.source,
    ...(params.metadata || {}),
  } as Prisma.InputJsonValue;

  return await tx.activity.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      summary: params.summary,
      metadata: metadataJson,
    },
  });
}

export async function listActivity(
  rawQuery: unknown = {},
): Promise<ServiceResult<{ items: unknown[]; total: number; limit: number }>> {
  if (!isTestModeEnabled()) {
    return testModeDisabledResult();
  }

  const parsed = ListActivityQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const { entityType, limit } = parsed.data;

  try {
    const prisma = getPrisma();
    const where: Prisma.ActivityWhereInput = entityType
      ? { entityType }
      : {};

    const [items, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.activity.count({ where }),
    ]);

    return ok({ items, total, limit });
  } catch (error) {
    return handleServiceError(error);
  }
}
