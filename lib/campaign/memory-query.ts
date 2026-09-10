import "server-only";
import { Prisma, type PrismaClient } from "@/app/generated/prisma/client";
import type { MemoryCandidate } from "./memory-relevance";

/**
 * Bounded-memory, paged scanner for CampaignMemory (ADR 0007, execution plan
 * section 6.3). For the initial small database, ranking reads all eligible
 * memory rows in 100-row ID batches under a RepeatableRead transaction; token
 * matches and scoring happen in the pure relevance module. There is no silent
 * maximum-candidate count: if the transaction times out, the call returns a
 * service failure.
 */

export type MemoryPrisma = PrismaClient | Prisma.TransactionClient;

export interface ScanMemoryOptions {
  prisma: MemoryPrisma;
  where: Prisma.CampaignMemoryWhereInput;
  /** Optional entity-context references; the scanner primes relation sets. */
  entityContextRefs?: { entityType: string; entityId: string }[];
  /** Optional explicit tag slugs an admin/list caller wants to filter on. */
  tagSlug?: string;
  /** Optional override (tests). */
  batchSize?: number;
}

const DEFAULT_BATCH_SIZE = 100;

export interface BatchScanner {
  /**
   * Yield successive ID-ordered batches of memory rows that satisfy the base
   * Prisma filter. The caller is responsible for stopping the iteration; the
   * scanner does not silently truncate.
   */
  next(): Promise<Prisma.CampaignMemoryGetPayload<Record<never, never>>[]>;
  hasMore(): boolean;
}

export function buildMemoryScanner(options: ScanMemoryOptions): BatchScanner {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  let lastSeenId: string | undefined = undefined;
  let exhausted = false;

  return {
    async next() {
      if (exhausted) return [];
      const where: Prisma.CampaignMemoryWhereInput = { ...options.where };
      if (lastSeenId !== undefined) {
        const existingIdFilter = where.id;
        const idGt: Prisma.CampaignMemoryWhereInput = { id: { gt: lastSeenId } };
        if (existingIdFilter !== undefined) {
          // Compound with keyset cursor via top-level AND; spread the existing
          // identifier constraint alongside the greater-than cursor.
          delete where.id;
          const idEquals: Prisma.CampaignMemoryWhereInput = { id: existingIdFilter as Prisma.StringFilter<"CampaignMemory"> };
          const existingAnd = options.where.AND;
          if (existingAnd) {
            const arr = Array.isArray(existingAnd) ? existingAnd : [existingAnd];
            options.where.AND = [...arr, { AND: [idEquals, idGt] }];
          } else {
            options.where.AND = [{ AND: [idEquals, idGt] }];
          }
        } else {
          where.id = { gt: lastSeenId };
        }
      }
      const rows: Prisma.CampaignMemoryGetPayload<Record<never, never>>[] = await (
        options.prisma as PrismaClient
      ).campaignMemory.findMany({
        where,
        orderBy: { id: "asc" },
        take: batchSize,
      });
      if (rows.length < batchSize) {
        exhausted = true;
      } else {
        lastSeenId = rows[rows.length - 1]!.id;
      }
      return rows;
    },
    hasMore() {
      return !exhausted;
    },
  };
}

interface TaggedEntityRow {
  entityId: string;
  tag: { slug: string; name: string };
}

interface RelationEndpointRow {
  id: string;
  fromEntityType: string;
  fromEntityId: string;
  toEntityType: string;
  toEntityId: string;
}

export interface ScanMemoryCandidatesResult {
  candidates: MemoryCandidate[];
  totalReadBatches: number;
  totalRowsScanned: number;
}

/**
 * Walk all eligible batches and return equivalent MemoryCandidate projections
 * for the relevance scorer. Tags and relation sets are loaded in batched
 * queries per ID batch; the caller's transaction (if any) is the outer
 * transaction context.
 */
export async function scanMemoryCandidates(
  options: ScanMemoryOptions,
): Promise<MemoryCandidate[]> {
  const result = await scanMemoryCandidatesWithMeta(options);
  return result.candidates;
}

export async function scanMemoryCandidatesWithMeta(
  options: ScanMemoryOptions,
): Promise<ScanMemoryCandidatesResult> {
  const candidates: MemoryCandidate[] = [];
  const scanner = buildMemoryScanner(options);
  let batchIndex = 0;
  let totalRows = 0;
  while (scanner.hasMore()) {
    const rows = await scanner.next();
    if (rows.length === 0) break;
    totalRows += rows.length;
    batchIndex += 1;
    const ids = rows.map((r) => r.id);
    const prisma = options.prisma as PrismaClient;

    const tagRows: TaggedEntityRow[] = await prisma.entityTag.findMany({
      where: { entityType: "CAMPAIGN_MEMORY", entityId: { in: ids } },
      include: { tag: true },
    });
    const tagsByEntity = new Map<string, { slugs: string[]; names: string[] }>();
    for (const t of tagRows) {
      const entry = tagsByEntity.get(t.entityId) ?? { slugs: [], names: [] };
      entry.slugs.push(t.tag.slug);
      entry.names.push(t.tag.name);
      tagsByEntity.set(t.entityId, entry);
    }

    const relationRows: RelationEndpointRow[] = await prisma.entityRelation.findMany({
      where: {
        OR: [
          { fromEntityType: "CAMPAIGN_MEMORY", fromEntityId: { in: ids } },
          { toEntityType: "CAMPAIGN_MEMORY", toEntityId: { in: ids } },
        ],
      },
      select: { id: true, fromEntityType: true, fromEntityId: true, toEntityType: true, toEntityId: true },
    });
    const relationKeysByEntity = new Map<string, Set<string>>();
    const recordKey = (key: string, entityId: string) => {
      const set = relationKeysByEntity.get(entityId) ?? new Set<string>();
      set.add(key);
      relationKeysByEntity.set(entityId, set);
    };
    for (const rel of relationRows) {
      const fromKey = `${rel.fromEntityType}:${rel.fromEntityId}`;
      const toKey = `${rel.toEntityType}:${rel.toEntityId}`;
      if (rel.fromEntityType === "CAMPAIGN_MEMORY") recordKey(toKey, rel.fromEntityId);
      if (rel.toEntityType === "CAMPAIGN_MEMORY") recordKey(fromKey, rel.toEntityId);
    }

    for (const row of rows) {
      const tags = tagsByEntity.get(row.id);
      candidates.push({
        id: row.id,
        key: row.key,
        title: row.title,
        content: row.content,
        sourceLabel: row.sourceLabel,
        category: row.category,
        status: row.status,
        confidence: row.confidence,
        sourceType: row.sourceType,
        sourceUrl: row.sourceUrl,
        version: row.version,
        expiresAt: row.expiresAt,
        tagSlugs: tags?.slugs ?? [],
        tagNames: tags?.names ?? [],
        importance: row.importance,
        pinned: row.pinned,
        updatedAt: row.updatedAt,
        accessCount: row.accessCount,
        relationKeys: relationKeysByEntity.get(row.id) ?? new Set<string>(),
      });
    }
  }

  return { candidates, totalReadBatches: batchIndex, totalRowsScanned: totalRows };
}
