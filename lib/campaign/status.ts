import "server-only";
import { getPrisma } from "@/lib/prisma";
import { isTestModeEnabled } from "./test-mode";
import {
  ok,
  testModeDisabledResult,
  handleServiceError,
  ServiceResult,
} from "./results";
import { WorkItemDto, mapToDto as mapWorkItemToDto } from "./work-items";
import { AssetDto, mapAssetToDto } from "./assets";
import { WebsiteDto, mapWebsiteToDto } from "./websites";
import { DecisionDto, mapDecisionToDto } from "./decisions";

export interface StatusCounts {
  BACKLOG: number;
  NEXT: number;
  IN_PROGRESS: number;
  BLOCKED: number;
  DONE: number;
  TOTAL: number;
}

export interface ActivitySummaryDto {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  metadata: unknown;
  createdAt: string;
}

export interface CampaignStatusDto {
  workItemCounts: StatusCounts;
  inProgressWork: WorkItemDto[];
  blockedWork: WorkItemDto[];
  nextWorkItems: WorkItemDto[];
  missingAssets: AssetDto[];
  missingAssetsTotal: number;
  websites: WebsiteDto[];
  recentDecisions: DecisionDto[];
  latestActivity: ActivitySummaryDto[];
}

export async function getCampaignStatus(): Promise<ServiceResult<CampaignStatusDto>> {
  if (!isTestModeEnabled()) {
    return testModeDisabledResult();
  }

  try {
    const prisma = getPrisma();

    const [
      backlogCount,
      nextCount,
      inProgressCount,
      blockedCount,
      doneCount,
      inProgressItems,
      blockedItems,
      nextItems,
      missingAssets,
      missingAssetsTotal,
      websites,
      recentDecisions,
      latestActivity,
    ] = await Promise.all([
      prisma.workItem.count({ where: { status: "BACKLOG" } }),
      prisma.workItem.count({ where: { status: "NEXT" } }),
      prisma.workItem.count({ where: { status: "IN_PROGRESS" } }),
      prisma.workItem.count({ where: { status: "BLOCKED" } }),
      prisma.workItem.count({ where: { status: "DONE" } }),
      prisma.workItem.findMany({
        where: { status: "IN_PROGRESS" },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }, { id: "asc" }],
        take: 10,
      }),
      prisma.workItem.findMany({
        where: { status: "BLOCKED" },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }, { id: "asc" }],
        take: 10,
      }),
      prisma.workItem.findMany({
        where: { status: "NEXT" },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }, { id: "asc" }],
        take: 3,
      }),
      prisma.asset.findMany({
        where: { status: "MISSING" },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: 20,
      }),
      prisma.asset.count({ where: { status: "MISSING" } }),
      prisma.website.findMany({
        orderBy: [{ name: "asc" }, { domain: "asc" }, { id: "asc" }],
      }),
      prisma.decision.findMany({
        orderBy: [{ decidedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        include: { supersededBy: { select: { id: true } } },
        take: 10,
      }),
      prisma.activity.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const totalWorkItems =
      backlogCount + nextCount + inProgressCount + blockedCount + doneCount;

    return ok({
      workItemCounts: {
        BACKLOG: backlogCount,
        NEXT: nextCount,
        IN_PROGRESS: inProgressCount,
        BLOCKED: blockedCount,
        DONE: doneCount,
        TOTAL: totalWorkItems,
      },
      inProgressWork: inProgressItems.map(mapWorkItemToDto),
      blockedWork: blockedItems.map(mapWorkItemToDto),
      nextWorkItems: nextItems.map(mapWorkItemToDto),
      missingAssets: missingAssets.map(mapAssetToDto),
      missingAssetsTotal,
      websites: websites.map(mapWebsiteToDto),
      recentDecisions: recentDecisions.map(mapDecisionToDto),
      latestActivity: latestActivity.map((a) => ({
        id: a.id,
        entityType: a.entityType,
        entityId: a.entityId,
        action: a.action,
        summary: a.summary,
        metadata: a.metadata,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleServiceError(error);
  }
}
