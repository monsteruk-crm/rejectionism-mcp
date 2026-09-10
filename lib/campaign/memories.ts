import "server-only";
import { Prisma } from "@/app/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { ok, fail, handleServiceError, ServiceResult } from "./results";
import { createActivityTx } from "./activity";
import { entityHref, findEntityTitleTx, getEntityTitlesTx } from "./entity-refs";
import {
  ArchiveMemoryInputSchema,
  GetMemoryInputSchema,
  ListMemoriesQuerySchema,
  RecallMemoriesInputSchema,
  SupersedeMemoryInputSchema,
  UpdateMemoryInputSchema,
  RememberMemoryInputSchema,
  type ArchiveMemoryInput,
  type GetMemoryInput,
  type ListMemoriesQuery,
  type MemoryDetailDto,
  type MemoryDto,
  type MemoryListOutputDto,
  type MemoryNextAction,
  type MemoryRememberOutcome,
  type MemoryRememberOutputDto,
  type MemorySummaryDto,
  type MemorySupersedeOutputDto,
  type MemoryUpdateOutputDto,
  type RecallInput,
  type RecallMemoriesInput,
  type RecallOutputDto,
  type RecalledMemoryDto,
  type SupersedeMemoryInput,
  type UpdateMemoryInput,
  type RememberMemoryInput,
} from "./memory-schemas";

export type {
  MemoryDetailDto,
  MemoryDto,
  MemoryListOutputDto,
  MemoryNextAction,
  MemoryRememberOutcome,
  MemoryRememberOutputDto,
  MemorySummaryDto,
  MemorySupersedeOutputDto,
  MemoryUpdateOutputDto,
  RecallInput,
  RecallMemoriesInput,
  RecallOutputDto,
  RecalledMemoryDto,
};
import { computeMemoryContentHash, normalizeMemoryKey } from "./memory-hash";
import {
  type CampaignEntityType,
  type EntityRef,
  type TagDto,
} from "./tag-schemas";
import type { MutationSource } from "./schemas";
import {
  MemoryTxError,
  linkEntitiesTx,
  tagEntityTx,
} from "./tag-link-tx";
import { buildMemoryScanner, scanMemoryCandidates } from "./memory-query";
import {
  type MemoryCandidate,
  type RankedMemory,
  excerptMemoryContent,
  prepareRecallQuery,
  rankMemoryCandidates,
  truncateMemoryContent,
} from "./memory-relevance";

/**
 * CampaignOS persistent cross-tool memory services (ADR 0007, execution plan
 * section 5). All mutation transactions use ReadCommitted isolation,
 * maxWait 15000ms and timeout 60000ms; unique-race retries occur around the
 * OUTERMOST transaction (at most three attempts).
 *
 * Constraint mapping (executed by the memory service, never the helper):
 *   - P2002 with index CampaignMemory_active_content_hash_key → DUPLICATE/ALREADY_CURRENT
 *     depending on whether the input carried an explicit key.
 *   - P2002 with index CampaignMemory_key_key or CampaignMemory_supersedesId_key →
 *     KEY_CONFLICT (create) or ALREADY_EXISTS (update/supersede ts/kx).
 *   - P2034 (Prisma serialization failure) → retry the whole transaction.
 *   - updateMany count zero with predicate (id, version, status) → VERSION_CONFLICT.
 */

const MEMORY_WRITE_TIMEOUT_MS = 60000;
const MEMORY_WRITE_MAX_WAIT_MS = 15000;
const MEMORY_MAX_ATTEMPTS = 3;

type Tx = Prisma.TransactionClient;

const SUPERSESSION_TRANSACTION_OPTIONS = {
  isolationLevel: "ReadCommitted" as const,
  maxWait: MEMORY_WRITE_MAX_WAIT_MS,
  timeout: MEMORY_WRITE_TIMEOUT_MS,
};

function mapMemoryToDto(
  prismaMemory: Prisma.CampaignMemoryGetPayload<Record<never, never>>,
  options: { requestNow: Date },
): import("./memory-schemas").MemoryDto {
  const expiresAt = prismaMemory.expiresAt;
  const isExpired = expiresAt !== null && expiresAt.getTime() <= options.requestNow.getTime();
  return {
    id: prismaMemory.id,
    key: prismaMemory.key,
    title: prismaMemory.title,
    content: prismaMemory.content,
    contentHash: prismaMemory.contentHash,
    category: prismaMemory.category as import("./memory-schemas").MemoryDto["category"],
    status: prismaMemory.status,
    importance: prismaMemory.importance,
    confidence: prismaMemory.confidence,
    pinned: prismaMemory.pinned,
    sourceType: prismaMemory.sourceType,
    sourceLabel: prismaMemory.sourceLabel,
    sourceUrl: prismaMemory.sourceUrl,
    version: prismaMemory.version,
    accessCount: prismaMemory.accessCount,
    lastAccessedAt: prismaMemory.lastAccessedAt?.toISOString() ?? null,
    expiresAt: expiresAt?.toISOString() ?? null,
    isExpired,
    supersededById: null,
    supersedesId: prismaMemory.supersedesId,
    createdAt: prismaMemory.createdAt.toISOString(),
    updatedAt: prismaMemory.updatedAt.toISOString(),
    href: entityHref("CAMPAIGN_MEMORY", prismaMemory.id),
  };
}

async function loadMemoryOrThrowNull(
  tx: Tx,
  id: string,
): Promise<Prisma.CampaignMemoryGetPayload<Record<never, never>> | null> {
  return tx.campaignMemory.findUnique({ where: { id } });
}

function mapTxErrorToServiceFailure(error: MemoryTxError, entity?: EntityRef): ServiceResult<never> {
  if (error.code === "ENTITY_NOT_FOUND") return fail("NOT_FOUND", error.message);
  if (error.code === "SELF_RELATION" || error.code === "INVALID_USES_ASSET_TARGET" || error.code === "INVALID_TAG_SLUG") {
    return fail("VALIDATION_ERROR", error.message);
  }
  if (error.code === "RELATION_NOTE_CONFLICT") {
    return fail("ALREADY_EXISTS", error.message);
  }
  return fail("INTERNAL_ERROR", "Tag or relation validation failed inside the memory transaction.");
}

function prismaUniqueTargetFromError(error: Prisma.PrismaClientKnownRequestError): string | undefined {
  if (error.meta && typeof error.meta === "object" && "target" in error.meta) {
    const target = (error.meta as { target?: unknown }).target;
    if (typeof target === "string") return target;
    if (Array.isArray(target)) return target.join("_");
  }
  return undefined;
}

// ------------------------------------------------------------
// Remember
// ------------------------------------------------------------

export async function rememberMemory(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<import("./memory-schemas").MemoryRememberOutputDto>> {
  const parsed = RememberMemoryInputSchema.safeParse(rawInput);
  if (!parsed.success) return handleServiceError(parsed.error);
  const input: RememberMemoryInput = parsed.data;
  const requestNow = new Date();

  const normalizedKey =
    input.key !== undefined && input.key !== null ? normalizeMemoryKey(input.key) : null;
  const contentHash = computeMemoryContentHash(input.category, input.title, input.content);
  const forcedSourceType: "HUMAN" | "MCP" | "ADMIN" | "IMPORT" | "SYSTEM" =
    source === "mcp" ? "MCP" : source === "system" ? "SYSTEM" : "ADMIN";

  for (let attempt = 0; attempt < MEMORY_MAX_ATTEMPTS; attempt += 1) {
    try {
      const prisma = getPrisma();
      const result = await prisma.$transaction(async (tx) => {
        if (normalizedKey !== null) {
          const owner = await tx.campaignMemory.findFirst({
            where: { key: normalizedKey },
            orderBy: { version: "desc" },
          });
          if (owner && owner.status === "ACTIVE" && owner.contentHash === contentHash) {
            return { outcome: "ALREADY_CURRENT" as const, memory: owner };
          }
          if (owner) {
            return { outcome: "KEY_CONFLICT" as const, memory: owner };
          }
        }
        const dupByHash = await tx.campaignMemory.findFirst({
          where: { contentHash, status: "ACTIVE" },
          orderBy: { version: "desc" },
        });
        if (dupByHash) {
          return { outcome: "DUPLICATE" as const, memory: dupByHash };
        }
        const created = await tx.campaignMemory.create({
          data: {
            key: normalizedKey,
            title: input.title.trim(),
            content: input.content.trim(),
            category: input.category,
            status: "ACTIVE",
            importance: input.importance,
            confidence: input.confidence,
            pinned: input.pinned,
            sourceType: forcedSourceType,
            sourceLabel: input.sourceLabel ?? null,
            sourceUrl: input.sourceUrl ?? null,
            contentHash,
            version: 1,
            accessCount: 0,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          },
        });
        const memoryRef: EntityRef = { entityType: "CAMPAIGN_MEMORY", entityId: created.id };
        try {
          for (const tagName of input.tags) {
            await tagEntityTx({ tx, entity: memoryRef, tagDisplay: tagName, source });
          }
          for (const rel of input.relationships) {
            const from: EntityRef = rel.direction === "outgoing"
              ? memoryRef
              : rel.entity;
            const to: EntityRef = rel.direction === "outgoing"
              ? rel.entity
              : memoryRef;
            await linkEntitiesTx({ tx, input: { from, to, relationType: rel.relationType, notes: rel.notes ?? null }, source });
          }
        } catch (txErr) {
          if (txErr instanceof MemoryTxError) throw txErr;
          throw txErr;
        }
        await createActivityTx(tx, {
          entityType: "CAMPAIGN_MEMORY",
          entityId: created.id,
          action: "MEMORY_CREATED",
          summary: `Remembered memory: ${created.title}`,
          source,
          metadata: {
            memoryId: created.id,
            category: created.category,
            hasKey: created.key !== null,
            tagCount: input.tags.length,
            relationshipCount: input.relationships.length,
          },
        });
        return { outcome: "CREATED" as const, memory: created };
      }, SUPERSESSION_TRANSACTION_OPTIONS);

      const dto = mapMemoryToDto(result.memory, { requestNow });
      const nextActions = computeNextActions(result.outcome, dto);
      return ok({
        outcome: result.outcome,
        memory: { ...dto, supersededById: await getSupersededById(result.memory.id) },
        nextActions,
      });
    } catch (error) {
      if (error instanceof MemoryTxError) {
        return mapTxErrorToServiceFailure(error);
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          const target = prismaUniqueTargetFromError(error) ?? "";
          if (target === "CampaignMemory_key_key" || target === "CampaignMemory_supersedesId_key") {
            return fail("VERSION_CONFLICT", "The memory key or supersession target changed concurrently; reread and retry.");
          }
          if (target === "CampaignMemory_active_content_hash_key") {
            continue;
          }
          continue;
        }
        if (error.code === "P2034") {
          continue;
        }
      }
      return handleServiceError(error);
    }
  }
  return fail("VERSION_CONFLICT", "Memory creation could not converge after repeated uniqueness conflicts. Reread and retry.");
}

function computeNextActions(
  outcome: "CREATED" | "DUPLICATE" | "ALREADY_CURRENT" | "KEY_CONFLICT",
  _memory: import("./memory-schemas").MemoryDto,
): import("./memory-schemas").MemoryNextAction[] {
  if (outcome === "CREATED") return [];
  const actions: import("./memory-schemas").MemoryNextAction[] = [{ tool: "campaign_get_memory" }];
  if (outcome === "DUPLICATE" || outcome === "ALREADY_CURRENT") {
    actions.push({ tool: "campaign_update_memory" });
  }
  if (outcome === "KEY_CONFLICT") {
    actions.push({ tool: "campaign_supersede_memory" });
    actions.push({ tool: "cancel" });
  }
  return actions;
}

async function getSupersededById(memoryId: string): Promise<string | null> {
  const prisma = getPrisma();
  const successor = await prisma.campaignMemory.findFirst({
    where: { supersedesId: memoryId },
    select: { id: true },
  });
  return successor?.id ?? null;
}

// ------------------------------------------------------------
// Update
// ------------------------------------------------------------

export async function updateMemory(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<import("./memory-schemas").MemoryUpdateOutputDto>> {
  const parsed = UpdateMemoryInputSchema.safeParse(rawInput);
  if (!parsed.success) return handleServiceError(parsed.error);
  const input: UpdateMemoryInput = parsed.data;
  const requestNow = new Date();
  const trimmedTitle = input.changes.title?.trim();
  const trimmedContent = input.changes.content?.trim();
  const normalizedKey = input.changes.key === undefined
    ? undefined
    : input.changes.key === null
      ? null
      : normalizeMemoryKey(input.changes.key);

  for (let attempt = 0; attempt < MEMORY_MAX_ATTEMPTS; attempt += 1) {
    try {
      const prisma = getPrisma();
      const result = await prisma.$transaction(async (tx) => {
        const existing = await loadMemoryOrThrowNull(tx, input.id);
        if (!existing) throw new Error("NOT_FOUND");
        if (existing.version !== input.expectedVersion) {
          throw new Error("VERSION_CONFLICT");
        }
        if (existing.status !== "ACTIVE") {
          throw new Error("NOT_ACTIVE");
        }

        const nextTitle = trimmedTitle ?? existing.title;
        const nextContent = trimmedContent ?? existing.content;
        const nextCategory = input.changes.category ?? existing.category;
        const nextHash = computeMemoryContentHash(nextCategory, nextTitle, nextContent);
        const nextImportance = input.changes.importance ?? existing.importance;
        const nextConfidence = input.changes.confidence ?? existing.confidence;
        const nextPinned = input.changes.pinned ?? existing.pinned;
        const nextKey = normalizedKey === undefined ? existing.key : normalizedKey;
        const nextSourceLabel = input.changes.sourceLabel === undefined
          ? existing.sourceLabel
          : input.changes.sourceLabel;
        const nextSourceUrl = input.changes.sourceUrl === undefined
          ? existing.sourceUrl
          : input.changes.sourceUrl;
        const nextExpiresAt = input.changes.expiresAt === undefined
          ? existing.expiresAt
          : input.changes.expiresAt === null
            ? null
            : new Date(input.changes.expiresAt);

        if (nextKey !== null) {
          const other = await tx.campaignMemory.findFirst({
            where: { key: nextKey, NOT: { id: existing.id } },
            select: { id: true, status: true },
          });
          if (other) {
            throw new Error("KEY_OWNED");
          }
        }
        if (nextHash !== existing.contentHash || existing.status === "ACTIVE") {
          const sameHashOther = await tx.campaignMemory.findFirst({
            where: { contentHash: nextHash, status: "ACTIVE", NOT: { id: existing.id } },
            select: { id: true },
          });
          if (sameHashOther) throw new Error("HASH_OWNED");
        }

        const isPinChange = nextPinned !== existing.pinned;
        const nochange =
          existing.title === nextTitle &&
          existing.content === nextContent &&
          existing.category === nextCategory &&
          existing.key === nextKey &&
          existing.importance === nextImportance &&
          existing.confidence === nextConfidence &&
          existing.pinned === nextPinned &&
          existing.sourceLabel === nextSourceLabel &&
          existing.sourceUrl === nextSourceUrl &&
          (existing.expiresAt?.getTime() ?? null) === (nextExpiresAt?.getTime() ?? null) &&
          existing.contentHash === nextHash;
        if (nochange) {
          return { memory: existing, changed: false };
        }

        const updated = await tx.campaignMemory.updateMany({
          where: { id: existing.id, version: existing.version, status: "ACTIVE" },
          data: {
            title: nextTitle,
            content: nextContent,
            category: nextCategory,
            key: nextKey,
            importance: nextImportance,
            confidence: nextConfidence,
            pinned: nextPinned,
            sourceLabel: nextSourceLabel,
            sourceUrl: nextSourceUrl,
            expiresAt: nextExpiresAt,
            contentHash: nextHash,
            version: existing.version + 1,
          },
        });
        if (updated.count === 0) throw new Error("VERSION_CONFLICT");

        const after = await loadMemoryOrThrowNull(tx, existing.id);
        if (!after) throw new Error("NOT_FOUND_AFTER_UPDATE");

        await createActivityTx(tx, {
          entityType: "CAMPAIGN_MEMORY",
          entityId: after.id,
          action: "MEMORY_UPDATED",
          summary: `Updated memory: ${after.title}`,
          source,
          metadata: {
            memoryId: after.id,
            changedFields: listChangedFields(existing, after),
            previousVersion: existing.version,
            newVersion: after.version,
          },
        });
        if (isPinChange) {
          await createActivityTx(tx, {
            entityType: "CAMPAIGN_MEMORY",
            entityId: after.id,
            action: after.pinned ? "MEMORY_PINNED" : "MEMORY_UNPINNED",
            summary: after.pinned ? `Pinned memory: ${after.title}` : `Unpinned memory: ${after.title}`,
            source,
            metadata: { memoryId: after.id, version: after.version },
          });
        }
        return { memory: after, changed: true };
      }, SUPERSESSION_TRANSACTION_OPTIONS);

      const dto = mapMemoryToDto(result.memory, { requestNow });
      return ok({
        memory: { ...dto, supersededById: await getSupersededById(result.memory.id) },
        changed: result.changed,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "NOT_FOUND") return fail("NOT_FOUND", `Memory ${input.id} not found.`);
        if (error.message === "NOT_ACTIVE") return fail("VALIDATION_ERROR", "Only ACTIVE memories can be updated.");
        if (error.message === "VERSION_CONFLICT") return fail("VERSION_CONFLICT", "Memory version changed; reread and retry.");
        if (error.message === "KEY_OWNED" || error.message === "HASH_OWNED") {
          return fail("ALREADY_EXISTS", `The memory's key or content already belongs to another row.`);
        }
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") continue;
        if (error.code === "P2034") continue;
      }
      return handleServiceError(error);
    }
  }
  return fail("VERSION_CONFLICT", "Memory update could not converge after repeated contention. Reread and retry.");
}

function listChangedFields(
  before: Prisma.CampaignMemoryGetPayload<Record<never, never>>,
  after: Prisma.CampaignMemoryGetPayload<Record<never, never>>,
): string[] {
  const fields: string[] = [];
  if (before.title !== after.title) fields.push("title");
  if (before.content !== after.content) fields.push("content");
  if (before.category !== after.category) fields.push("category");
  if (before.key !== after.key) fields.push("key");
  if (before.importance !== after.importance) fields.push("importance");
  if (before.confidence !== after.confidence) fields.push("confidence");
  if (before.pinned !== after.pinned) fields.push("pinned");
  if (before.sourceLabel !== after.sourceLabel) fields.push("sourceLabel");
  if (before.sourceUrl !== after.sourceUrl) fields.push("sourceUrl");
  if ((before.expiresAt?.getTime() ?? null) !== (after.expiresAt?.getTime() ?? null)) fields.push("expiresAt");
  return fields;
}

// ------------------------------------------------------------
// Archive
// ------------------------------------------------------------

export async function archiveMemory(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<import("./memory-schemas").MemoryUpdateOutputDto>> {
  const parsed = ArchiveMemoryInputSchema.safeParse(rawInput);
  if (!parsed.success) return handleServiceError(parsed.error);
  const input: ArchiveMemoryInput = parsed.data;
  const requestNow = new Date();

  for (let attempt = 0; attempt < MEMORY_MAX_ATTEMPTS; attempt += 1) {
    try {
      const prisma = getPrisma();
      const result = await prisma.$transaction(async (tx) => {
        const existing = await loadMemoryOrThrowNull(tx, input.id);
        if (!existing) throw new Error("NOT_FOUND");
        if (existing.status === "SUPERSEDED") throw new Error("SUPERSEDED");
        if (existing.status === "ARCHIVED") {
          if (existing.version === input.expectedVersion) {
            return { memory: existing, changed: false };
          }
          throw new Error("VERSION_CONFLICT");
        }
        if (existing.version !== input.expectedVersion) throw new Error("VERSION_CONFLICT");
        const archived = await tx.campaignMemory.updateMany({
          where: { id: existing.id, version: existing.version, status: "ACTIVE" },
          data: { status: "ARCHIVED", version: existing.version + 1 },
        });
        if (archived.count === 0) throw new Error("VERSION_CONFLICT");
        const after = await loadMemoryOrThrowNull(tx, existing.id);
        if (!after) throw new Error("NOT_FOUND_AFTER_UPDATE");
        await createActivityTx(tx, {
          entityType: "CAMPAIGN_MEMORY",
          entityId: after.id,
          action: "MEMORY_ARCHIVED",
          summary: `Archived memory: ${after.title}`,
          source,
          metadata: { memoryId: after.id, previousVersion: existing.version, newVersion: after.version },
        });
        return { memory: after, changed: true };
      }, SUPERSESSION_TRANSACTION_OPTIONS);

      const dto = mapMemoryToDto(result.memory, { requestNow });
      return ok({
        memory: { ...dto, supersededById: await getSupersededById(result.memory.id) },
        changed: result.changed,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "NOT_FOUND") return fail("NOT_FOUND", `Memory ${input.id} not found.`);
        if (error.message === "SUPERSEDED") {
          return fail("VALIDATION_ERROR", "SUPERSEDED memories cannot be archived again.");
        }
        if (error.message === "VERSION_CONFLICT") return fail("VERSION_CONFLICT", "Memory version changed; reread and retry.");
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2034") continue;
      }
      return handleServiceError(error);
    }
  }
  return fail("VERSION_CONFLICT", "Memory archive could not converge.");
}

// ------------------------------------------------------------
// Supersession
// ------------------------------------------------------------

export async function supersedeMemory(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<import("./memory-schemas").MemorySupersedeOutputDto>> {
  const parsed = SupersedeMemoryInputSchema.safeParse(rawInput);
  if (!parsed.success) return handleServiceError(parsed.error);
  const input: SupersedeMemoryInput = parsed.data;
  const requestNow = new Date();
  const newKeyNormalized = input.newMemory.key === undefined || input.newMemory.key === null
    ? null
    : normalizeMemoryKey(input.newMemory.key);
  const forcedSourceType: "HUMAN" | "MCP" | "ADMIN" | "IMPORT" | "SYSTEM" =
    source === "mcp" ? "MCP" : source === "system" ? "SYSTEM" : "ADMIN";
  const newHash = computeMemoryContentHash(input.newMemory.category, input.newMemory.title, input.newMemory.content);

  for (let attempt = 0; attempt < MEMORY_MAX_ATTEMPTS; attempt += 1) {
    try {
      const prisma = getPrisma();
      const result = await prisma.$transaction(async (tx) => {
        const predecessor = await loadMemoryOrThrowNull(tx, input.supersedesId);
        if (!predecessor) throw new Error("NOT_FOUND");
        if (predecessor.status !== "ACTIVE" && predecessor.status !== "ARCHIVED") {
          throw new Error("INVALID_PREDECESSOR_STATUS");
        }
        if (predecessor.version !== input.expectedVersion) throw new Error("VERSION_CONFLICT");
        const successor = await tx.campaignMemory.findFirst({
          where: { supersedesId: predecessor.id },
          select: { id: true },
        });
        if (successor) throw new Error("ALREADY_SUPERSEDED");

        let transferredKey: string | null;
        if (predecessor.key !== null) {
          if (newKeyNormalized === null) {
            transferredKey = predecessor.key;
          } else if (newKeyNormalized === predecessor.key.toLowerCase()) {
            transferredKey = predecessor.key;
          } else {
            throw new Error("KEY_NOT_INHERITED");
          }
        } else {
          if (newKeyNormalized !== null) {
            const other = await tx.campaignMemory.findFirst({
              where: { key: newKeyNormalized, NOT: { id: predecessor.id } },
              select: { id: true },
            });
            if (other) throw new Error("KEY_OWNED");
          }
          transferredKey = newKeyNormalized;
        }

        if (newHash !== predecessor.contentHash && predecessor.status === "ARCHIVED") {
          // ARCHIVED predecessors may be replaced with same content.
        }

        if (newHash === predecessor.contentHash && predecessor.status === "ACTIVE") {
          throw new Error("IDENTICAL_CONTENT");
        }

        const dupByHash = await tx.campaignMemory.findFirst({
          where: { contentHash: newHash, status: "ACTIVE", NOT: { id: predecessor.id } },
          select: { id: true },
        });
        if (dupByHash) throw new Error("HASH_OWNED");

        let inheritedTags: { name: string; slug: string }[] = [];
        let inheritedRelations: { edge: import("./tag-link-tx").DirectedLinkInput }[] = [];
        if (input.copyConnections) {
          const tagRows = await tx.entityTag.findMany({
            where: { entityType: "CAMPAIGN_MEMORY", entityId: predecessor.id },
            include: { tag: true },
          });
          inheritedTags = tagRows.map((row) => ({ name: row.tag.name, slug: row.tag.slug }));
          const relations = await tx.entityRelation.findMany({
            where: {
              OR: [
                { fromEntityType: "CAMPAIGN_MEMORY", fromEntityId: predecessor.id },
                { toEntityType: "CAMPAIGN_MEMORY", toEntityId: predecessor.id },
              ],
            },
          });
          inheritedRelations = relations.map((rel) => ({
            edge: {
              from: toMemoryEntityRef(rel.fromEntityType, rel.fromEntityId, predecessor.id),
              to: toMemoryEntityRef(rel.toEntityType, rel.toEntityId, predecessor.id),
              relationType: rel.relationType,
              notes: rel.notes,
            },
          }));
        }

        const predecessorUpdate = await tx.campaignMemory.updateMany({
          where: { id: predecessor.id, version: predecessor.version },
          data: {
            status: "SUPERSEDED",
            // A stable key belongs to the current row. Release it before the
            // successor insert so the global unique index remains satisfied.
            key: null,
            version: predecessor.version + 1,
          },
        });
        if (predecessorUpdate.count === 0) throw new Error("VERSION_CONFLICT");

        const created = await tx.campaignMemory.create({
          data: {
            key: transferredKey,
            title: input.newMemory.title.trim(),
            content: input.newMemory.content.trim(),
            category: input.newMemory.category,
            status: "ACTIVE",
            importance: input.newMemory.importance,
            confidence: input.newMemory.confidence,
            pinned: input.newMemory.pinned,
            sourceType: forcedSourceType,
            sourceLabel: input.newMemory.sourceLabel ?? null,
            sourceUrl: input.newMemory.sourceUrl ?? null,
            contentHash: newHash,
            version: 1,
            accessCount: 0,
            expiresAt: input.newMemory.expiresAt ? new Date(input.newMemory.expiresAt) : null,
            supersedesId: predecessor.id,
          },
        });

        const newMemoryRef: EntityRef = { entityType: "CAMPAIGN_MEMORY", entityId: created.id };

        try {
          const tagSeen = new Set<string>();
          for (const tag of input.newMemory.tags) {
            if (tagSeen.has(tag.toLowerCase())) continue;
            await tagEntityTx({ tx, entity: newMemoryRef, tagDisplay: tag, source });
            tagSeen.add(tag.toLowerCase());
          }
          for (const tag of inheritedTags) {
            const slugLower = tag.slug.toLowerCase();
            if (tagSeen.has(slugLower)) continue;
            await tagEntityTx({ tx, entity: newMemoryRef, tagDisplay: tag.name, source });
            tagSeen.add(slugLower);
          }
          const edgeSeen = new Set<string>();
          for (const rel of input.newMemory.relationships) {
            const from: EntityRef = rel.direction === "outgoing" ? newMemoryRef : rel.entity;
            const to: EntityRef = rel.direction === "outgoing" ? rel.entity : newMemoryRef;
            const key = `${from.entityType}:${from.entityId}>${to.entityType}:${to.entityId}:${rel.relationType}`;
            if (edgeSeen.has(key)) continue;
            try {
              await linkEntitiesTx({ tx, input: { from, to, relationType: rel.relationType, notes: rel.notes ?? null }, source });
            } catch (err) {
              if (err instanceof MemoryTxError && err.code === "RELATION_NOTE_CONFLICT") throw err;
              throw err;
            }
            edgeSeen.add(key);
          }
          for (const inherited of inheritedRelations) {
            const from = inherited.edge.from;
            const to = inherited.edge.to;
            const key = `${from.entityType}:${from.entityId}>${to.entityType}:${to.entityId}:${inherited.edge.relationType}`;
            if (edgeSeen.has(key)) continue;
            await linkEntitiesTx({ tx, input: inherited.edge, source });
            edgeSeen.add(key);
          }
        } catch (txErr) {
          if (txErr instanceof MemoryTxError) throw txErr;
          throw txErr;
        }

        const predecessorAfter = await loadMemoryOrThrowNull(tx, predecessor.id);
        if (!predecessorAfter) throw new Error("NOT_FOUND_AFTER_UPDATE");

        await createActivityTx(tx, {
          entityType: "CAMPAIGN_MEMORY",
          entityId: created.id,
          action: "MEMORY_CREATED",
          summary: `Supersede memory: ${created.title}`,
          source,
          metadata: {
            memoryId: created.id,
            supersededId: predecessor.id,
            transferredKey,
            copyConnections: input.copyConnections,
          },
        });
        await createActivityTx(tx, {
          entityType: "CAMPAIGN_MEMORY",
          entityId: predecessor.id,
          action: "MEMORY_SUPERSEDED",
          summary: `Superseded by new memory: ${created.title}`,
          source,
          metadata: {
            predecessorId: predecessor.id,
            newMemoryId: created.id,
            previousStatus: predecessor.status,
            previousVersion: predecessor.version,
            newVersion: created.version,
            transferredKey,
            copyConnections: input.copyConnections,
          },
        });

        return { predecessor: predecessorAfter, successor: created };
      }, SUPERSESSION_TRANSACTION_OPTIONS);

      const predecessorDto = mapMemoryToDto(result.predecessor, { requestNow });
      const successorDto = mapMemoryToDto(result.successor, { requestNow });
      return ok({
        memory: { ...successorDto, supersededById: null },
        supersededMemory: { ...predecessorDto, supersededById: result.successor.id },
      });
    } catch (error) {
      if (error instanceof MemoryTxError) {
        return mapTxErrorToServiceFailure(error);
      }
      if (error instanceof Error) {
        if (error.message === "NOT_FOUND") return fail("NOT_FOUND", `Memory ${input.supersedesId} not found.`);
        if (error.message === "INVALID_PREDECESSOR_STATUS") {
          return fail("VALIDATION_ERROR", "Predecessor must be ACTIVE or ARCHIVED.");
        }
        if (error.message === "ALREADY_SUPERSEDED") {
          return fail("VERSION_CONFLICT", "This memory already has a successor.");
        }
        if (error.message === "KEY_NOT_INHERITED") {
          return fail("VALIDATION_ERROR", "The new memory's key must match the predecessor's key or be omitted to inherit it.");
        }
        if (error.message === "KEY_OWNED" || error.message === "HASH_OWNED") {
          return fail("ALREADY_EXISTS", "New memory's key/content is already owned by another row.");
        }
        if (error.message === "IDENTICAL_CONTENT") {
          return fail("VALIDATION_ERROR", "Supersede with identical content: update metadata instead.");
        }
        if (error.message === "VERSION_CONFLICT") {
          return fail("VERSION_CONFLICT", "Predecessor version changed; reread and retry.");
        }
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") continue;
        if (error.code === "P2034") continue;
      }
      return handleServiceError(error);
    }
  }
  return fail("VERSION_CONFLICT", "Supersede could not converge after repeated contention.");
}

function toMemoryEntityRef(
  entityType: string,
  entityId: string,
  predecessorId: string,
): EntityRef {
  if (entityType === "CAMPAIGN_MEMORY" && entityId === predecessorId) {
    return { entityType: "CAMPAIGN_MEMORY", entityId: "__placeholder__" };
  }
  if ((entityType as CampaignEntityType) && VALID_MEMORY_ENDPOINTS.has(entityType as CampaignEntityType)) {
    return { entityType: entityType as CampaignEntityType, entityId };
  }
  throw new Error("RELATION_ENDPOINT_OUT_OF_SCOPE");
}

const VALID_MEMORY_ENDPOINTS: Set<CampaignEntityType> = new Set([
  "WORK_ITEM",
  "CANON_ENTRY",
  "DECISION",
  "ASSET",
  "WEBSITE",
  "CONTACT",
  "CONTENT_ITEM",
  "CAMPAIGN_MEMORY",
]);

// ------------------------------------------------------------
// Get, List, Recall, Health
// ------------------------------------------------------------

export async function getMemory(
  rawInput: unknown,
): Promise<ServiceResult<import("./memory-schemas").MemoryDetailDto>> {
  const parsed = GetMemoryInputSchema.safeParse(rawInput);
  if (!parsed.success) return handleServiceError(parsed.error);
  const input: GetMemoryInput = parsed.data;
  const requestNow = new Date();

  try {
    const prisma = getPrisma();
    const memoryRecord = input.id
      ? await prisma.campaignMemory.findUnique({ where: { id: input.id } })
      : await prisma.campaignMemory.findFirst({
          where: { key: input.key!.trim().toLowerCase() },
          orderBy: { version: "desc" },
        });
    let resolved = memoryRecord;
    if (resolved && input.key) {
      const successor = await prisma.campaignMemory.findFirst({
        where: { supersedesId: resolved.id },
        select: { id: true },
      });
      if (successor) {
        resolved = await prisma.campaignMemory.findUnique({ where: { id: successor.id } });
      }
    }
    if (!resolved) return fail("NOT_FOUND", `Memory matching ${input.id ?? input.key} not found.`);

    const tagRows = await prisma.entityTag.findMany({
      where: { entityType: "CAMPAIGN_MEMORY", entityId: resolved.id },
      include: { tag: true },
      orderBy: [{ tag: { slug: "asc" } }, { tagId: "asc" }],
    });
    const tagsTotal = tagRows.length;
    const tagPage = tagRows.slice(input.tagOffset, input.tagOffset + 50);
    const tagDtos: TagDto[] = tagPage.map((row) => ({
      id: row.tag.id,
      name: row.tag.name,
      slug: row.tag.slug,
      createdAt: row.tag.createdAt.toISOString(),
    }));

    const relations = await prisma.entityRelation.findMany({
      where: {
        OR: [
          { fromEntityType: "CAMPAIGN_MEMORY", fromEntityId: resolved.id },
          { toEntityType: "CAMPAIGN_MEMORY", toEntityId: resolved.id },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
    const relationshipsTotal = relations.length;
    const relationsPage = relations.slice(input.relationshipOffset, input.relationshipOffset + 50);
    const endpointRefs: EntityRef[] = [];
    for (const rel of relationsPage) {
      const narrow = toMemoryEntityRef(rel.fromEntityType, rel.fromEntityId, resolved.id);
      endpointRefs.push(narrow);
      const narrowTo = toMemoryEntityRef(rel.toEntityType, rel.toEntityId, resolved.id);
      endpointRefs.push(narrowTo);
    }
    const titles = await getEntityTitlesTx(prisma, endpointRefs).catch(async () => {
      // Transactionless fallback for endpoint titles.
      return await getEntityTitlesViaGlobalClient(endpointRefs);
    });

    const relationshipsDto = relationsPage.map((row) => {
      const from = toMemoryEntityRef(row.fromEntityType, row.fromEntityId, resolved!.id);
      const to = toMemoryEntityRef(row.toEntityType, row.toEntityId, resolved!.id);
      return {
        id: row.id,
        from,
        to,
        direction: row.fromEntityId === resolved!.id ? ("outgoing" as const) : ("incoming" as const),
        relationType: row.relationType,
        notes: row.notes ?? null,
        createdAt: row.createdAt.toISOString(),
        fromTitle: titles.get(`${from.entityType}:${from.entityId}`) ?? from.entityId,
        toTitle: titles.get(`${to.entityType}:${to.entityId}`) ?? to.entityId,
        fromHref: entityHref(from.entityType, from.entityId),
        toHref: entityHref(to.entityType, to.entityId),
      };
    });

    const predecessor = resolved.supersedesId
      ? await prisma.campaignMemory.findUnique({ where: { id: resolved.supersedesId } })
      : null;
    const successor = await prisma.campaignMemory.findFirst({
      where: { supersedesId: resolved.id },
      select: { id: true, title: true, key: true, category: true, status: true, importance: true, confidence: true, pinned: true, contentHash: true, sourceType: true, sourceLabel: true, sourceUrl: true, version: true, expiresAt: true, createdAt: true, updatedAt: true, accessCount: true, lastAccessedAt: true, supersedesId: true, content: true },
    });

    const summary = (record: typeof resolved): import("./memory-schemas").MemorySummaryDto => {
      if (!record) throw new Error("Missing summary source");
      const dto = mapMemoryToDto(record, { requestNow });
      return {
        id: dto.id,
        key: dto.key,
        title: dto.title,
        contentHash: dto.contentHash,
        category: dto.category,
        status: dto.status,
        importance: dto.importance,
        confidence: dto.confidence,
        pinned: dto.pinned,
        sourceType: dto.sourceType,
        sourceLabel: dto.sourceLabel,
        sourceUrl: dto.sourceUrl,
        version: dto.version,
        accessCount: dto.accessCount,
        lastAccessedAt: dto.lastAccessedAt,
        expiresAt: dto.expiresAt,
        isExpired: dto.isExpired,
        supersededById: dto.supersededById,
        supersedesId: dto.supersedesId,
        createdAt: dto.createdAt,
        updatedAt: dto.updatedAt,
        href: dto.href,
        contentExcerpt: excerptMemoryContent(dto.content, 240),
        sortedTagSlugs: [],
        tagsTotal: 0,
      };
    };

    const dto = mapMemoryToDto(resolved, { requestNow });
    return ok({
      memory: { ...dto, supersededById: successor?.id ?? null },
      tags: tagDtos,
      tagsTotal,
      tagLimit: 50,
      tagOffset: input.tagOffset,
      relationships: relationshipsDto,
      relationshipsTotal,
      relationshipLimit: 50,
      relationshipOffset: input.relationshipOffset,
      supersedes: predecessor ? summary(predecessor) : null,
      supersededBy: successor ? summary(successor) : null,
    });
  } catch (error) {
    return handleServiceError(error);
  }
}

async function getEntityTitlesViaGlobalClient(refs: EntityRef[]): Promise<Map<string, string>> {
  const { getEntityTitles } = await import("./entity-refs");
  return getEntityTitles(refs);
}

export async function listMemories(
  rawInput: unknown,
): Promise<ServiceResult<import("./memory-schemas").MemoryListOutputDto>> {
  const parsed = ListMemoriesQuerySchema.safeParse(rawInput);
  if (!parsed.success) return handleServiceError(parsed.error);
  const input: ListMemoriesQuery = parsed.data;
  const requestNow = new Date();
  const statusFilter = input.status === "ALL" ? undefined : input.status;

  try {
    const prisma = getPrisma();
    const where: Prisma.CampaignMemoryWhereInput = {};
    if (input.category) where.category = input.category;
    if (statusFilter) where.status = statusFilter;
    if (input.pinned !== undefined) where.pinned = input.pinned;
    if (input.minImportance !== undefined) where.importance = { gte: input.minImportance };
    if (input.includeExpired) {
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: requestNow } },
        ...(input.expiredOnly ? [{ expiresAt: { lte: requestNow } }] : []),
      ];
    } else {
      where.OR = [{ expiresAt: null }, { expiresAt: { gt: requestNow } }];
    }
    if (input.tag) {
      // Tag filtering requires joining EntityTag with Tag. Use raw SQL.
      const taggedRows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT m."id" FROM "CampaignMemory" m
        JOIN "EntityTag" et ON et."entityId" = m."id" AND et."entityType" = 'CAMPAIGN_MEMORY'
        JOIN "Tag" t ON t."id" = et."tagId"
        WHERE t."slug" = ${input.tag}
      `;
      const taggedIds = new Set(taggedRows.map((r) => r.id));
      if (taggedIds.size === 0) {
        return ok({ items: [], total: 0, limit: input.limit, offset: input.offset });
      }
      where.id = { in: Array.from(taggedIds) };
    }

    let rows: Prisma.CampaignMemoryGetPayload<Record<never, never>>[] = [];
    let total = 0;

    if (input.sort === "RELEVANCE") {
      // RELEVANCE requires non-empty search; do relevance ranking over the
      // filtered rows via the scanner; preserve exact totals and pagination.
      const queryText = (input.search ?? "").trim();
      const prepared = prepareRecallQuery(queryText, undefined, undefined);
      const candidates = await scanMemoryCandidates({
        prisma,
        where: {
          ...where,
          OR: [
            { title: { contains: queryText, mode: "insensitive" } },
            { content: { contains: queryText, mode: "insensitive" } },
            { key: { contains: queryText, mode: "insensitive" } },
            { sourceLabel: { contains: queryText, mode: "insensitive" } },
          ],
        } as Prisma.CampaignMemoryWhereInput,
      });
      const totalCandidates = candidates.length;
      const ranked = rankMemoryCandidates(candidates, prepared, { includePinned: false, limit: input.limit + input.offset }, requestNow);
      const sliced = ranked.slice(input.offset, input.offset + input.limit);
      rows = await loadMemoryRowsById(prisma, sliced.map((s) => s.candidate.id));
      total = totalCandidates;
    } else {
      const orderBy: Prisma.CampaignMemoryOrderByWithRelationInput[] = [];
      if (input.sort === "UPDATED_DESC") {
        orderBy.push({ updatedAt: "desc" }, { id: "asc" });
      } else if (input.sort === "IMPORTANCE_DESC") {
        orderBy.push({ importance: "desc" }, { updatedAt: "desc" }, { id: "asc" });
      } else if (input.sort === "ACCESSED_DESC") {
        orderBy.push({ lastAccessedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }, { id: "asc" });
      } else if (input.sort === "CREATED_ASC") {
        orderBy.push({ createdAt: "asc" }, { id: "asc" });
      }
      const [rowsResult, totalCount] = await Promise.all([
        prisma.campaignMemory.findMany({
          where,
          orderBy,
          take: input.limit,
          skip: input.offset,
        }),
        prisma.campaignMemory.count({ where }),
      ]);
      rows = rowsResult;
      total = totalCount;
    }

    const tagSlugsByMemory = await collectTagSlugsForMemoryIds(prisma, rows.map((r) => r.id));
    const items = rows.map((row) => {
      const summary = summarizeMemory(row, requestNow);
      const slugs = tagSlugsByMemory.get(row.id) ?? [];
      return { ...summary, sortedTagSlugs: slugs, tagsTotal: slugs.length };
    });

    return ok({ items, total, limit: input.limit, offset: input.offset });
  } catch (error) {
    return handleServiceError(error);
  }
}

async function loadMemoryRowsById(
  prisma: ReturnType<typeof getPrisma>,
  ids: string[],
): Promise<Prisma.CampaignMemoryGetPayload<Record<never, never>>[]> {
  if (ids.length === 0) return [];
  return prisma.campaignMemory.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" } });
}

async function collectTagSlugsForMemoryIds(
  prisma: ReturnType<typeof getPrisma>,
  ids: string[],
): Promise<Map<string, string[]>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.entityTag.findMany({
    where: { entityType: "CAMPAIGN_MEMORY", entityId: { in: ids } },
    include: { tag: true },
  });
  return groupTagsByEntitySlugs(rows);
}

function groupTagsByEntitySlugs(
  rows: { entityId: string; tag: { slug: string } }[],
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const row of rows) {
    const list = out.get(row.entityId) ?? [];
    list.push(row.tag.slug);
    out.set(row.entityId, list);
  }
  for (const list of out.values()) list.sort();
  return out;
}

function summarizeMemory(
  row: Prisma.CampaignMemoryGetPayload<Record<never, never>>,
  requestNow: Date,
): import("./memory-schemas").MemorySummaryDto {
  const dto = mapMemoryToDto(row, { requestNow });
  return {
    id: dto.id,
    key: dto.key,
    title: dto.title,
    contentHash: dto.contentHash,
    category: dto.category,
    status: dto.status,
    importance: dto.importance,
    confidence: dto.confidence,
    pinned: dto.pinned,
    sourceType: dto.sourceType,
    sourceLabel: dto.sourceLabel,
    sourceUrl: dto.sourceUrl,
    version: dto.version,
    accessCount: dto.accessCount,
    lastAccessedAt: dto.lastAccessedAt,
    expiresAt: dto.expiresAt,
    isExpired: dto.isExpired,
    supersededById: dto.supersededById,
    supersedesId: dto.supersedesId,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    href: dto.href,
    contentExcerpt: excerptMemoryContent(dto.content, 240),
    sortedTagSlugs: [],
    tagsTotal: 0,
  };
}

// ------------------------------------------------------------
// Recall (read-only)
// ------------------------------------------------------------

export async function recallMemories(
  rawInput: unknown,
): Promise<ServiceResult<import("./memory-schemas").RecallOutputDto>> {
  const parsed = RecallMemoriesInputSchema.safeParse(rawInput);
  if (!parsed.success) return handleServiceError(parsed.error);
  const input: RecallMemoriesInput = parsed.data;
  const requestNow = new Date();
  const prepared = prepareRecallQuery(input.query, input.tags, input.entityContext);

  try {
    const prisma = getPrisma();
    const baseFilter: Prisma.CampaignMemoryWhereInput = {
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: requestNow } }],
    };
    if (!input.includeExpired) {
      baseFilter.OR = [{ expiresAt: null }, { expiresAt: { gt: requestNow } }];
    }
    if (input.categories && input.categories.length > 0) {
      baseFilter.category = { in: input.categories };
    }
    const candidates = await scanMemoryCandidates({ prisma, where: baseFilter });
    const ranked = rankMemoryCandidates(candidates, prepared, {
      includePinned: input.includePinned,
      limit: input.limit,
    }, requestNow);

    const ids = ranked.map((r) => r.candidate.id);
    const rows = await loadMemoryRowsById(prisma, ids);
    const rowsById = new Map(rows.map((r) => [r.id, r]));
    const items: import("./memory-schemas").RecalledMemoryDto[] = ranked.map((rankedRow) => {
      const memoryRow = rowsById.get(rankedRow.candidate.id);
      if (!memoryRow) {
        throw new Error("INTERNAL_ERROR: ranked candidate row missing after read");
      }
      const truncated = truncateMemoryContent(memoryRow.content, 2000);
      return {
        id: memoryRow.id,
        key: memoryRow.key,
        title: memoryRow.title,
        content: truncated.text,
        contentTruncated: truncated.truncated,
        category: memoryRow.category as import("./memory-schemas").RecalledMemoryDto["category"],
        status: memoryRow.status,
        isExpired: (memoryRow.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY) <= requestNow.getTime(),
        importance: memoryRow.importance,
        confidence: memoryRow.confidence,
        pinned: memoryRow.pinned,
        version: memoryRow.version,
        expiresAt: memoryRow.expiresAt?.toISOString() ?? null,
        sourceType: memoryRow.sourceType,
        sourceLabel: memoryRow.sourceLabel,
        sourceUrl: memoryRow.sourceUrl,
        updatedAt: memoryRow.updatedAt.toISOString(),
        sortedTagSlugs: rankedRow.candidate.tagSlugs.slice().sort(),
        tagsTotal: rankedRow.candidate.tagSlugs.length,
        href: entityHref("CAMPAIGN_MEMORY", memoryRow.id),
        relevanceScore: rankedRow.score,
        relevanceReasons: rankedRow.breakdown.reasons,
      };
    });

    return ok({
      items,
      limit: input.limit,
      queryTokens: prepared.tokens,
      queryTokensTruncated: prepared.tokensTruncated,
    });
  } catch (error) {
    return handleServiceError(error);
  }
}

// Health counters: pure SQL aggregates using the same definitions as
// getMemoryHealth.

export interface MemoryHealth {
  active: number;
  pinned: number;
  superseded: number;
  archived: number;
  expired: number;
  possibleExactDuplicates: number;
}

export async function getMemoryHealth(): Promise<ServiceResult<MemoryHealth>> {
  try {
    const prisma = getPrisma();
    const requestNow = new Date();
    const rows = await prisma.campaignMemory.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const statusCounts: Record<string, number> = {};
    for (const row of rows) statusCounts[row.status] = row._count._all;
    const expiredActive = await prisma.campaignMemory.count({
      where: { status: "ACTIVE", expiresAt: { lte: requestNow } },
    });
    const pinnedActive = await prisma.campaignMemory.count({
      where: {
        status: "ACTIVE",
        pinned: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: requestNow } }],
      },
    });
    const activeUnexpired = await prisma.campaignMemory.count({
      where: {
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: requestNow } }],
      },
    });

    const hashGroups = await prisma.$queryRaw<Array<{ contenthash: string; count: bigint }>>`
      SELECT "contentHash" as contenthash, COUNT(*)::bigint as count
      FROM "CampaignMemory"
      WHERE "status" = 'ACTIVE'
        AND ("expiresAt" IS NULL OR "expiresAt" > ${requestNow})
      GROUP BY "contentHash"
      HAVING COUNT(*) > 1
    `;
    let possibleExactDuplicates = 0;
    for (const group of hashGroups) {
      possibleExactDuplicates += Number(group.count) - 1;
    }

    return ok({
      active: activeUnexpired,
      pinned: pinnedActive,
      superseded: statusCounts.SUPERSEDED ?? 0,
      archived: statusCounts.ARCHIVED ?? 0,
      expired: expiredActive,
      possibleExactDuplicates,
    });
  } catch (error) {
    return handleServiceError(error);
  }
}
