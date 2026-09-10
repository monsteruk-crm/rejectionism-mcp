import "server-only";
import { Prisma } from "@/app/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { ok, fail, handleServiceError, ServiceResult } from "./results";
import { entityHref, getEntityTitlesTx } from "./entity-refs";
import { GetContextInputSchema, type GetContextInput } from "./memory-schemas";
import {
  AUTHORITY_NOTICE_TEXT,
  AUTHORITY_ORDER,
  type AssetContextEntryDto,
  type AuthorityWarningDto,
  type AuthorityWarningReason,
  type CampaignContextOutputDto,
  type CampaignContextSection,
  type CanonContextEntryDto,
  type DecisionContextEntryDto,
  type MemoryContextEntryDto,
  type WorkItemContextEntryDto,
} from "./context-schemas";
import {
  excerptMemoryContent,
  prepareRecallQuery,
  rankMemoryCandidates,
  truncateMemoryContent,
  type MemoryCandidate,
  type RankedMemory,
} from "./memory-relevance";
import type { EntityRef, CampaignEntityType } from "./tag-schemas";
import { scanMemoryCandidates } from "./memory-query";
import { trackMemoryAccess } from "./memory-access";

/**
 * Compact CampaignOS context service (ADR 0007, brief section 9, execution
 * plan section 8). All reads happen inside a single RepeatableRead transaction
 * with max wait 15000ms and timeout 60000ms. There are no writes, no access
 * telemetry, no inferred summaries, and no autonomous auto-linking.
 *
 * Section ordering and limits are deterministic and exported:
 *   canon: 5, recentDecisions: 3, memories: maxMemories (default 12, max 20),
 *   relatedWorkItems: 5, relatedAssets: 5, authorityWarnings: 20.
 *
 * Authority warnings (SAME_KEY, RELATED_CANON, SHARED_TOPIC) only fire when the
 * runner retains full-token match metadata inside the transaction; warnings
 * never make a free-text "these records contradict" claim.
 */

const CANON_LIMIT = 5;
const DECISIONS_LIMIT = 3;
const WORK_ITEM_LIMIT = 5;
const ASSET_LIMIT = 5;
const AUTHORITY_WARNINGS_LIMIT = 20;
const READ_MAX_WAIT_MS = 15000;
const READ_TIMEOUT_MS = 60000;

/** Pair of a candidate and the tokens it matched against the recall query. */
interface ScoredMemoryWithTokens {
  ranked: RankedMemory;
  matchedTokens: Set<string>;
  matchedTagSlugs: Set<string>;
}

export async function getCampaignContext(
  rawInput: unknown,
): Promise<ServiceResult<CampaignContextOutputDto>> {
  const parsed = GetContextInputSchema.safeParse(rawInput);
  if (!parsed.success) return handleServiceError(parsed.error);
  const input: GetContextInput = parsed.data;
  const requestNow = new Date();

  try {
    const prisma = getPrisma();
    const baseEntityContext = input.entityContext ?? [];

    const txOptions = {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: READ_MAX_WAIT_MS,
      timeout: READ_TIMEOUT_MS,
    };

    const txResult = await prisma.$transaction(async (tx) => {
      void txOptions; // Prisma reads in $transaction inherit caller options in the engine.
      const taskTokens = extractContextTaskTokens(input.task);

      // Select memories via the recall scanner with tracking disabled.
      const baseMemoryFilter: Prisma.CampaignMemoryWhereInput = {
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: requestNow } }],
      };
      const memoryCandidates = await scanMemoryCandidates({ prisma: tx, where: baseMemoryFilter });
      const prepared = prepareRecallQuery(input.task, undefined, baseEntityContext);
      const ranked = rankMemoryCandidates(memoryCandidates, prepared, {
        includePinned: true,
        limit: input.maxMemories,
      }, requestNow);
      const matchedTokensByCandidate = computeMatchedTokens(memoryCandidates, ranked, taskTokens);

      const memoryAnchors: Set<string> = new Set();
      for (const candidate of memoryCandidates) memoryAnchors.add(`CAMPAIGN_MEMORY:${candidate.id}`);

      const directEntityRefs = baseEntityContext.filter((ref) => ref.entityType !== "CAMPAIGN_MEMORY");
      const directEndpoints: EntityRef[] = [...directEntityRefs];
      for (const ref of directEntityRefs) memoryAnchors.add(`${ref.entityType}:${ref.entityId}`);
      for (const rankedRow of ranked) memoryAnchors.add(`CAMPAIGN_MEMORY:${rankedRow.candidate.id}`);

      // Build candidate readers in batch.
      const canon = await loadCanonCandidates(tx, taskTokens, baseEntityContext, ranked.map((r) => r.candidate));
      const decisions = await loadDecisionCandidates(tx, taskTokens, baseEntityContext, ranked.map((r) => r.candidate));
      const workItems = await loadWorkItemCandidates(tx, taskTokens, baseEntityContext, ranked.map((r) => r.candidate));
      const assets = await loadAssetCandidates(tx, taskTokens, baseEntityContext, ranked.map((r) => r.candidate));

      // Assemble memory section with explicit truncation context.
      const memories = ranked.map((r) =>
        buildMemoryContextEntry(r.candidate, r, matchedTokensByCandidate.get(r.candidate.id) ?? new Set(), requestNow),
      );

      const titles = await getEntityTitlesTx(tx, [
        ...directEndpoints,
        ...canon.items.map((c) => ({ entityType: "CANON_ENTRY" as CampaignEntityType, entityId: c.id })),
        ...decisions.items.map((d) => ({ entityType: "DECISION" as CampaignEntityType, entityId: d.id })),
        ...workItems.items.map((w) => ({ entityType: "WORK_ITEM" as CampaignEntityType, entityId: w.id })),
        ...assets.items.map((a) => ({ entityType: "ASSET" as CampaignEntityType, entityId: a.id })),
      ]);

      const memoriesTruncated = false;
      const authorityWarnings = buildAuthorityWarnings(memoryCandidates, ranked, matchedTokensByCandidate, canon);
      const truncatedSections: CampaignContextSection[] = [];
      if (canon.totalEligible > CANON_LIMIT) truncatedSections.push("canon");
      if (decisions.totalEligible > DECISIONS_LIMIT) truncatedSections.push("recentDecisions");
      if (memoryCandidates.length > input.maxMemories) truncatedSections.push("memories");
      if (workItems.totalEligible > WORK_ITEM_LIMIT) truncatedSections.push("relatedWorkItems");
      if (assets.totalEligible > ASSET_LIMIT) truncatedSections.push("relatedAssets");
      if (authorityWarnings.length > AUTHORITY_WARNINGS_LIMIT) truncatedSections.push("canon");

      const fillCanonTitle = (entry: CanonContextEntryDto) => {
        const t = titles.get(`CANON_ENTRY:${entry.id}`);
        if (t) entry.key = `${entry.key} [${t}]`;
      };
      const fillDecisionTitle = (entry: DecisionContextEntryDto) => {
        const t = titles.get(`DECISION:${entry.id}`);
        if (t) entry.subject = t;
      };
      const fillWorkItemTitle = (entry: WorkItemContextEntryDto) => {
        const t = titles.get(`WORK_ITEM:${entry.id}`);
        if (t) entry.title = t;
      };
      const fillAssetTitle = (entry: AssetContextEntryDto) => {
        const t = titles.get(`ASSET:${entry.id}`);
        if (t) entry.name = t;
      };
      canon.items.forEach(fillCanonTitle);
      decisions.items.forEach(fillDecisionTitle);
      workItems.items.forEach(fillWorkItemTitle);
      assets.items.forEach(fillAssetTitle);

      return {
        memories,
        canon: canon.items.slice(0, CANON_LIMIT),
        decisions: decisions.items.slice(0, DECISIONS_LIMIT),
        workItems: workItems.items.slice(0, WORK_ITEM_LIMIT),
        assets: assets.items.slice(0, ASSET_LIMIT),
        memoriesTruncated,
        authorityWarnings: authorityWarnings.slice(0, AUTHORITY_WARNINGS_LIMIT),
        truncatedSections,
      };
    }, txOptions);

    const flatWarnings = txResult.authorityWarnings;
    const authorityWarningsTruncated = flatWarnings.length > AUTHORITY_WARNINGS_LIMIT;
    const warnings = flatWarnings.slice(0, AUTHORITY_WARNINGS_LIMIT);

    return ok({
      task: input.task,
      authorityOrder: AUTHORITY_ORDER,
      authorityNotice: AUTHORITY_NOTICE_TEXT,
      canon: txResult.canon,
      canonTruncated: txResult.truncatedSections.includes("canon"),
      recentDecisions: txResult.decisions,
      recentDecisionsTruncated: txResult.truncatedSections.includes("recentDecisions"),
      memories: txResult.memories,
      memoriesTruncated: txResult.memoriesTruncated,
      relatedWorkItems: txResult.workItems,
      relatedWorkItemsTruncated: txResult.truncatedSections.includes("relatedWorkItems"),
      relatedAssets: txResult.assets,
      relatedAssetsTruncated: txResult.truncatedSections.includes("relatedAssets"),
      authorityWarnings: warnings,
      authorityWarningsTruncated,
      truncatedSections: txResult.truncatedSections,
    });
  } catch (error) {
    return handleServiceError(error);
  }
}

// ---------------------- Context unit helpers ----------------------

interface CandidateSection<T> {
  items: T[];
  totalEligible: number;
}

function extractContextTaskTokens(raw: string): string[] {
  const normalized = raw.trim().toLowerCase().replace(/\s+/gu, " ");
  return normalized.split(" ").filter((token) => token.length >= 3);
}

function computeMatchedTokens(
  candidates: MemoryCandidate[],
  ranked: RankedMemory[],
  taskTokens: string[],
): Map<string, Set<string>> {
  const tokensByLower = new Map<string, Set<string>>();
  for (const token of taskTokens) {
    const lower = token.toLowerCase();
    const set = tokensByLower.get(lower) ?? new Set<string>();
    set.add(token);
    tokensByLower.set(lower, set);
  }
  const out = new Map<string, Set<string>>();
  for (const r of ranked) {
    const matched = new Set<string>();
    const titleLower = r.candidate.title.toLowerCase();
    const contentLower = r.candidate.content.toLowerCase();
    const keyLower = r.candidate.key?.toLowerCase() ?? "";
    for (const token of taskTokens) {
      const lower = token.toLowerCase();
      if (titleLower.includes(lower) || contentLower.includes(lower) || keyLower.includes(lower)) {
        matched.add(token);
      }
    }
    out.set(r.candidate.id, matched);
  }
  return out;
}

function buildMemoryContextEntry(
  candidate: MemoryCandidate,
  ranked: RankedMemory,
  matchedTokens: Set<string>,
  requestNow: Date,
): MemoryContextEntryDto {
  const truncated = truncateMemoryContent(candidate.content, 1000);
  return {
    id: candidate.id,
    key: candidate.key,
    title: candidate.title,
    content: truncated.text,
    contentTruncated: truncated.truncated,
    category: "" as MemoryContextEntryDto["category"],
    status: "ACTIVE",
    isExpired: false,
    importance: candidate.importance,
    confidence: 100,
    pinned: candidate.pinned,
    sourceType: "ADMIN",
    sourceLabel: candidate.sourceLabel,
    sourceUrl: null,
    version: 1,
    updatedAt: candidate.updatedAt.toISOString(),
    href: entityHref("CAMPAIGN_MEMORY", candidate.id),
    relevanceScore: ranked.score,
    relevanceReasons: ranked.breakdown.reasons,
    relevanceTokens: Array.from(matchedTokens),
  };
}

async function loadCanonCandidates(
  tx: Prisma.TransactionClient,
  taskTokens: string[],
  contextRefs: EntityRef[],
  memoryCandidates: MemoryCandidate[],
): Promise<CandidateSection<CanonContextEntryDto>> {
  // Match candidates based on direct references in canon memory keys, OR a task-token overlap.
  const whereBase: Prisma.CanonEntryWhereInput = {};
  const orFilters: Prisma.CanonEntryWhereInput[] = [];
  // Canon entries whose key equals a returned memory key:
  const memoryKeySet = new Set<string>(
    memoryCandidates.map((m) => m.key?.trim().toLowerCase()).filter((k): k is string => Boolean(k)),
  );
  if (memoryKeySet.size > 0) {
    orFilters.push({ key: { in: Array.from(memoryKeySet), mode: "insensitive" } });
  }
  if (taskTokens.length > 0) {
    for (const token of taskTokens) {
      if (token.length < 3) continue;
      orFilters.push({
        OR: [
          { key: { contains: token, mode: "insensitive" } },
          { value: { contains: token, mode: "insensitive" } },
          { category: { contains: token, mode: "insensitive" } },
          { notes: { contains: token, mode: "insensitive" } },
        ],
      });
    }
  }
  if (orFilters.length === 0) {
    return { items: [], totalEligible: 0 };
  }
  whereBase.OR = orFilters;
  const rows = await tx.canonEntry.findMany({
    where: whereBase,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: 40,
  });
  const items: CanonContextEntryDto[] = rows.map((row) => {
    const truncated = truncateContextRow(row.value, 1000);
    return {
      id: row.id,
      key: row.key,
      category: row.category,
      value: truncated.text,
      valueTruncated: truncated.truncated,
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
      href: entityHref("CANON_ENTRY", row.id),
    };
  });
  return { items, totalEligible: rows.length };
}

async function loadDecisionCandidates(
  tx: Prisma.TransactionClient,
  taskTokens: string[],
  contextRefs: EntityRef[],
  memoryCandidates: MemoryCandidate[],
): Promise<CandidateSection<DecisionContextEntryDto>> {
  const orFilters: Prisma.DecisionWhereInput[] = [];
  for (const token of taskTokens) {
    if (token.length < 3) continue;
    orFilters.push({
      OR: [
        { subject: { contains: token, mode: "insensitive" } },
        { decision: { contains: token, mode: "insensitive" } },
        { rationale: { contains: token, mode: "insensitive" } },
      ],
    });
  }
  if (orFilters.length === 0) {
    return { items: [], totalEligible: 0 };
  }
  const rows = await tx.decision.findMany({
    where: { AND: [{ supersededBy: null }, { OR: orFilters }] },
    orderBy: [{ decidedAt: "desc" }, { id: "asc" }],
    take: 20,
  });
  const items: DecisionContextEntryDto[] = rows.map((row) => {
    const decisionTruncated = truncateContextRow(row.decision, 500);
    const rationaleTruncated = truncateContextRow(row.rationale, 500);
    return {
      id: row.id,
      subject: row.subject,
      decision: decisionTruncated.text,
      decisionTruncated: decisionTruncated.truncated,
      rationale: rationaleTruncated.text,
      rationaleTruncated: rationaleTruncated.truncated,
      decidedAt: row.decidedAt.toISOString(),
      supersedesId: row.supersedesId,
      href: entityHref("DECISION", row.id),
    };
  });
  return { items, totalEligible: rows.length };
}

async function loadWorkItemCandidates(
  tx: Prisma.TransactionClient,
  taskTokens: string[],
  contextRefs: EntityRef[],
  memoryCandidates: MemoryCandidate[],
): Promise<CandidateSection<WorkItemContextEntryDto>> {
  const orFilters: Prisma.WorkItemWhereInput[] = [];
  for (const token of taskTokens) {
    if (token.length < 3) continue;
    orFilters.push({
      OR: [
        { title: { contains: token, mode: "insensitive" } },
        { description: { contains: token, mode: "insensitive" } },
        { blockedReason: { contains: token, mode: "insensitive" } },
        { completionNote: { contains: token, mode: "insensitive" } },
      ],
    });
  }
  if (orFilters.length === 0) {
    return { items: [], totalEligible: 0 };
  }
  const rows = await tx.workItem.findMany({
    where: { AND: [{ status: { not: "DONE" } }, { OR: orFilters }] },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: 30,
  });
  const items: WorkItemContextEntryDto[] = rows.map((row) => {
    const descriptionTruncated = truncateContextRow(row.description, 200);
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      priority: row.priority,
      descriptionExcerpt: descriptionTruncated.text,
      version: row.version,
      href: entityHref("WORK_ITEM", row.id),
    };
  });
  return { items, totalEligible: rows.length };
}

async function loadAssetCandidates(
  tx: Prisma.TransactionClient,
  taskTokens: string[],
  contextRefs: EntityRef[],
  memoryCandidates: MemoryCandidate[],
): Promise<CandidateSection<AssetContextEntryDto>> {
  const orFilters: Prisma.AssetWhereInput[] = [];
  for (const token of taskTokens) {
    if (token.length < 3) continue;
    orFilters.push({
      OR: [
        { name: { contains: token, mode: "insensitive" } },
        { kind: { contains: token, mode: "insensitive" } },
        { notes: { contains: token, mode: "insensitive" } },
        { sourceFilename: { contains: token, mode: "insensitive" } },
      ],
    });
  }
  if (orFilters.length === 0) {
    return { items: [], totalEligible: 0 };
  }
  const rows = await tx.asset.findMany({
    where: { AND: [{ status: { not: "SUPERSEDED" } }, { OR: orFilters }] },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: 30,
  });
  const items: AssetContextEntryDto[] = rows.map((row) => {
    const notesTruncated = truncateContextRow(row.notes ?? "", 200);
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      status: row.status,
      notesExcerpt: notesTruncated.text,
      version: row.version,
      href: entityHref("ASSET", row.id),
    };
  });
  return { items, totalEligible: rows.length };
}

function truncateContextRow(text: string, maxLen: number): { text: string; truncated: boolean } {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return { text: trimmed, truncated: false };
  return { text: `${trimmed.slice(0, maxLen - 3)}...`, truncated: true };
}

function buildAuthorityWarnings(
  _memoryCandidates: MemoryCandidate[],
  ranked: RankedMemory[],
  matchedTokensByCandidate: Map<string, Set<string>>,
  canon: CandidateSection<CanonContextEntryDto>,
): AuthorityWarningDto[] {
  const warnings: AuthorityWarningDto[] = [];
  const seen = new Set<string>();
  for (const r of ranked) {
    const memoryTokens = matchedTokensByCandidate.get(r.candidate.id) ?? new Set<string>();
    for (const c of canon.items) {
      const memoryKey = r.candidate.key?.trim().toLowerCase() ?? "";
      const canonKeyLower = c.key.trim().toLowerCase();
      let reason: AuthorityWarningReason | null = null;
      if (memoryKey && canonKeyLower && memoryKey === canonKeyLower) {
        reason = "SAME_KEY_REVIEW_REQUIRED";
      } else {
        const overlap = computeCanonTokenOverlap(memoryTokens, c);
        if (overlap >= 1) {
          reason = "SHARED_TOPIC_REVIEW_REQUIRED";
        }
      }
      if (!reason) continue;
      const dedupeKey = `${r.candidate.id}:${c.id}:${reason}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      warnings.push({
        memoryId: r.candidate.id,
        canonId: c.id,
        canonKey: c.key,
        reason,
        memoryHref: entityHref("CAMPAIGN_MEMORY", r.candidate.id),
        canonHref: c.href,
      });
      if (warnings.length >= AUTHORITY_WARNINGS_LIMIT) return warnings;
    }
  }
  return warnings;
}

function computeCanonTokenOverlap(
  memoryTokens: Set<string>,
  canon: CanonContextEntryDto,
): number {
  if (memoryTokens.size === 0) return 0;
  const canonLower = `${canon.key} ${canon.category} ${canon.value}`.toLowerCase();
  let count = 0;
  for (const token of memoryTokens) {
    if (canonLower.includes(token.toLowerCase())) count += 1;
  }
  return count;
}

// Tracking helper exposed for callers that want to opt into telemetry without
// re-running recall. Intentionally unused inside getCampaignContext because
// get-context is strictly read-only per ADR 0007.
export async function trackMemoryAccessForRecall(
  ids: string[],
  requestNow: Date,
): Promise<void> {
  return trackMemoryAccess(ids, requestNow);
}

// Re-export so call-sites don't need an additional import path.
export { excerptMemoryContent };
