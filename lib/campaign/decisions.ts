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
  RecordDecisionInputSchema,
  ListDecisionsQuerySchema,
  MutationSource,
} from "./schemas";
import { createActivityTx } from "./activity";
import { mapCanonToDto, CanonEntryDto } from "./canon";
import { Prisma } from "@/app/generated/prisma/client";

export interface DecisionDto {
  id: string;
  subject: string;
  decision: string;
  rationale: string;
  supersedesId: string | null;
  supersededById: string | null;
  decidedAt: string;
  createdAt: string;
  updatedAt: string;
  canonEntry?: CanonEntryDto | null;
}

export function mapDecisionToDto(item: {
  id: string;
  subject: string;
  decision: string;
  rationale: string;
  supersedesId: string | null;
  decidedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  supersededBy?: { id: string } | null;
}): DecisionDto {
  return {
    id: item.id,
    subject: item.subject,
    decision: item.decision,
    rationale: item.rationale,
    supersedesId: item.supersedesId,
    supersededById: item.supersededBy ? item.supersededBy.id : null,
    decidedAt: item.decidedAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function recordDecision(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<DecisionDto>> {
  if (!isTestModeEnabled()) {
    return testModeDisabledResult();
  }

  const parsed = RecordDecisionInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;

  try {
    const prisma = getPrisma();
    const result = await prisma.$transaction(async (tx) => {
      // If supersedesId is given, verify target exists and has not already been superseded
      if (input.supersedesId) {
        const target = await tx.decision.findUnique({
          where: { id: input.supersedesId },
        });

        if (!target) {
          throw new Error("SUPERSEDES_NOT_FOUND");
        }

        const existingSuccessor = await tx.decision.findUnique({
          where: { supersedesId: input.supersedesId },
        });

        if (existingSuccessor) {
          throw new Error("ALREADY_SUPERSEDED");
        }
      }

      let updatedCanonDto: CanonEntryDto | null = null;

      // Handle explicit canon update if requested
      if (input.updateCanon) {
        const canonMode = input.updateCanon;

        if (canonMode.mode === "create") {
          const existingKey = await tx.canonEntry.findUnique({
            where: { key: canonMode.key },
          });

          if (existingKey) {
            throw new Error("CANON_ALREADY_EXISTS");
          }

          const createdCanon = await tx.canonEntry.create({
            data: {
              key: canonMode.key,
              value: canonMode.value,
              category: canonMode.category,
              notes: canonMode.notes,
              version: 1,
            },
          });

          await createActivityTx(tx, {
            entityType: "CANON_ENTRY",
            entityId: createdCanon.id,
            action: "CREATED",
            summary: `Created canon entry via decision: ${createdCanon.key}`,
            source,
            metadata: {
              key: createdCanon.key,
              category: createdCanon.category,
              version: createdCanon.version,
            },
          });

          updatedCanonDto = mapCanonToDto(createdCanon);
        } else if (canonMode.mode === "update") {
          const existingCanon = await tx.canonEntry.findUnique({
            where: { key: canonMode.key },
          });

          if (!existingCanon) {
            throw new Error("CANON_NOT_FOUND");
          }

          if (existingCanon.version !== canonMode.expectedVersion) {
            throw new Error("CANON_VERSION_CONFLICT");
          }

          const updateCanonData: Prisma.CanonEntryUpdateInput = {
            value: canonMode.value,
            version: canonMode.expectedVersion + 1,
          };
          if (canonMode.category) updateCanonData.category = canonMode.category;
          if (canonMode.notes !== undefined) updateCanonData.notes = canonMode.notes;

          const updateResult = await tx.canonEntry.updateMany({
            where: {
              key: canonMode.key,
              version: canonMode.expectedVersion,
            },
            data: updateCanonData,
          });

          if (updateResult.count === 0) {
            throw new Error("CANON_VERSION_CONFLICT");
          }

          await createActivityTx(tx, {
            entityType: "CANON_ENTRY",
            entityId: existingCanon.id,
            action: "UPDATED",
            summary: `Updated canon entry via decision: ${existingCanon.key}`,
            source,
            metadata: {
              key: existingCanon.key,
              oldVersion: canonMode.expectedVersion,
              newVersion: canonMode.expectedVersion + 1,
            },
          });

          const updatedCanon = await tx.canonEntry.findUnique({
            where: { key: canonMode.key },
          });
          updatedCanonDto = mapCanonToDto(updatedCanon!);
        }
      }

      // Create decision
      const createdDecision = await tx.decision.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          subject: input.subject,
          decision: input.decision,
          rationale: input.rationale,
          supersedesId: input.supersedesId || null,
          decidedAt: input.decidedAt || new Date(),
        },
      });

      await createActivityTx(tx, {
        entityType: "DECISION",
        entityId: createdDecision.id,
        action: "RECORDED",
        summary: `Recorded decision: ${createdDecision.subject}`,
        source,
        metadata: {
          subject: createdDecision.subject,
          supersedesId: createdDecision.supersedesId,
          hasCanonUpdate: !!input.updateCanon,
        },
      });

      const dto = mapDecisionToDto(createdDecision);
      if (updatedCanonDto) {
        dto.canonEntry = updatedCanonDto;
      }
      return dto;
    });

    return ok(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "SUPERSEDES_NOT_FOUND") {
      return fail(
        "NOT_FOUND",
        `Decision to supersede with ID "${input.supersedesId}" was not found.`,
      );
    }
    if (msg === "ALREADY_SUPERSEDED") {
      return fail(
        "VERSION_CONFLICT",
        `Decision "${input.supersedesId}" has already been superseded by another decision.`,
      );
    }
    if (msg === "CANON_ALREADY_EXISTS") {
      return fail(
        "ALREADY_EXISTS",
        `Canon entry with key "${input.updateCanon?.key}" already exists.`,
      );
    }
    if (msg === "CANON_NOT_FOUND") {
      return fail(
        "NOT_FOUND",
        `Canon entry with key "${input.updateCanon?.key}" was not found for update.`,
      );
    }
    if (msg === "CANON_VERSION_CONFLICT") {
      return fail(
        "VERSION_CONFLICT",
        `Version conflict on canon entry "${input.updateCanon?.key}".`,
      );
    }
    return handleServiceError(error);
  }
}

export async function getDecisionById(id: string): Promise<ServiceResult<DecisionDto>> {
  if (!isTestModeEnabled()) {
    return testModeDisabledResult();
  }

  try {
    const prisma = getPrisma();
    const item = await prisma.decision.findUnique({
      where: { id },
      include: { supersededBy: { select: { id: true } } },
    });

    if (!item) {
      return fail("NOT_FOUND", `Decision with ID ${id} not found.`);
    }

    return ok(mapDecisionToDto(item));
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function listDecisions(
  rawQuery: unknown = {},
): Promise<ServiceResult<{ items: DecisionDto[]; total: number; limit: number; offset: number }>> {
  if (!isTestModeEnabled()) {
    return testModeDisabledResult();
  }

  const parsed = ListDecisionsQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const { limit, offset } = parsed.data;

  try {
    const prisma = getPrisma();
    const [items, total] = await Promise.all([
      prisma.decision.findMany({
        orderBy: [{ decidedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        include: { supersededBy: { select: { id: true } } },
        take: limit,
        skip: offset,
      }),
      prisma.decision.count(),
    ]);

    return ok({
      items: items.map(mapDecisionToDto),
      total,
      limit,
      offset,
    });
  } catch (error) {
    return handleServiceError(error);
  }
}
