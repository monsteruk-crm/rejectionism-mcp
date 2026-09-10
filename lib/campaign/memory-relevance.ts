/**
 * Browser-safe pure relevance scoring for CampaignMemory recall (ADR 0007,
 * brief sections 8, 9; execution plan section 6).
 *
 * No database, framework, clock, or crypto dependencies. Scores and reasons
 * are derived deterministically from the candidate strings and the requestNow
 * timestamp. Constants are named and exported so unit tests can pin them
 * without depending on private arithmetic.
 *
 * The eligibility rules above matter: importance/recency/pin alone never
 * establish relevance. A memory must have at least one exact-key, title-phrase,
 * token, matching-tag, or matching-entity signal to appear as a normal match.
 * Pinned rows may additionally appear as bounded "ambient" pins, but never
 * displace normal matches.
 */

export const MEMORY_SCORE_EXACT_KEY = 1000;
export const MEMORY_SCORE_TITLE_PHRASE = 120;
export const MEMORY_SCORE_KEY_TOKEN = 30;
export const MEMORY_SCORE_KEY_TOKEN_CAP = 5;
export const MEMORY_SCORE_TITLE_MATCH = 40;
export const MEMORY_SCORE_TITLE_MATCH_CAP = 5;
export const MEMORY_SCORE_CONTENT_MATCH = 12;
export const MEMORY_SCORE_CONTENT_MATCH_CAP = 5;
export const MEMORY_SCORE_SOURCE_MATCH = 6;
export const MEMORY_SCORE_SOURCE_MATCH_CAP = 3;
export const MEMORY_SCORE_TAG_MATCH = 35;
export const MEMORY_SCORE_TAG_MATCH_CAP = 3;
export const MEMORY_SCORE_RELATION = 80;
export const MEMORY_SCORE_RELATION_CAP = 3;
export const MEMORY_SCORE_PINNED = 40;
export const MEMORY_SCORE_IMPORTANCE_MAX = 20;
export const MEMORY_SCORE_RECENCY_MAX = 10;
export const MEMORY_SCORE_RECENCY_HALFLIFE_DAYS = 90;
export const MEMORY_SCORE_FREQUENCY_MAX = 5;

export const MEMORY_QUERY_TOKEN_LIMIT = 16;
export const MEMORY_QUERY_MIN_TOKEN_LEN = 3;

const STOP_WORDS = new Set<string>([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "about",
  "please",
  "create",
  "make",
  "use",
  "using",
  "task",
  "what",
  "who",
  "how",
  "can",
  "could",
  "should",
  "would",
  "our",
  "are",
  "was",
  "were",
  "have",
  "has",
]);

export function normalizeMemoryQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/gu, " ");
}

export interface PreparedMemoryQuery {
  raw: string;
  normalized: string;
  fullNormalized: string;
  tokens: string[];
  tokensTruncated: boolean;
}

export function prepareMemoryQuery(raw: string): PreparedMemoryQuery {
  const fullNormalized = raw.trim().toLowerCase().replace(/\s+/gu, " ");
  const tokensAll: string[] = [];
  const regex = /\p{L}|\p{N}/gu;
  const full = fullNormalized;
  // Re-scan full string with strict run-of-letter/digit extraction.
  const clean = fullNormalized.replace(/[^\p{L}\p{N}\s]/gu, " ");
  const runs = clean.split(/\s+/u).filter(Boolean);
  for (const run of runs) {
    // Validate with regex (defensive in case a stray char slipped in).
    if (!regex.test(run)) continue;
    if (run.length < MEMORY_QUERY_MIN_TOKEN_LEN) continue;
    if (STOP_WORDS.has(run)) continue;
    if (!tokensAll.includes(run)) tokensAll.push(run);
    if (tokensAll.length > MEMORY_QUERY_TOKEN_LIMIT) break;
  }
  const truncated = runs.filter((r) => {
    if (r.length < MEMORY_QUERY_MIN_TOKEN_LEN) return false;
    if (STOP_WORDS.has(r)) return false;
    return true;
  }).length > MEMORY_QUERY_TOKEN_LIMIT;
  // Safe: only reserve first 16 meaningful tokens.
  const tokens = tokensAll.slice(0, MEMORY_QUERY_TOKEN_LIMIT);

  return {
    raw,
    normalized: fullNormalized,
    fullNormalized,
    tokens,
    tokensTruncated: truncated,
  };
}

export interface MemoryCandidate {
  id: string;
  key: string | null;
  title: string;
  content: string;
  sourceLabel: string | null;
  category: string;
  status: "ACTIVE" | "SUPERSEDED" | "ARCHIVED";
  confidence: number;
  sourceType: "HUMAN" | "MCP" | "ADMIN" | "IMPORT" | "SYSTEM";
  sourceUrl: string | null;
  version: number;
  expiresAt: Date | null;
  tagSlugs: string[];
  tagNames: string[];
  importance: number;
  pinned: boolean;
  updatedAt: Date;
  accessCount: number;
  /** Set of entityRef keys (e.g. `ASSET:abc`) the candidate is related to. */
  relationKeys: Set<string>;
}

export interface ScoreBreakdown {
  exactKey: boolean;
  titlePhrase: boolean;
  keyTokens: string[];
  titleTokens: string[];
  contentTokens: string[];
  sourceTokens: string[];
  matchedTagSlugs: string[];
  matchedRelationEntities: string[];
  pinned: boolean;
  importanceContribution: number;
  recencyDays: number;
  recencyContribution: number;
  accessFrequencyContribution: number;
  reasons: string[];
}

export interface ScoredMemory {
  candidate: MemoryCandidate;
  score: number;
  breakdown: ScoreBreakdown;
}

export function stableCompareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function clampPositive(n: number, fallback: number): number {
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

export function computeMemoryScore(
  candidate: MemoryCandidate,
  query: PreparedRecallQuery,
  requestNow: Date,
  options: { includePinned: boolean },
): ScoredMemory {
  const exactKey =
    query.fullNormalized.length > 0 &&
    candidate.key !== null &&
    candidate.key.trim().toLowerCase() === query.fullNormalized;

  const queryHasMeaningfulToken = query.tokens.length > 0;
  const titlePhrase =
    queryHasMeaningfulToken &&
    query.fullNormalized.length >= MEMORY_QUERY_MIN_TOKEN_LEN &&
    candidate.title.trim().toLowerCase().includes(query.fullNormalized);

  const matchedKeyTokens: string[] = [];
  const matchedTitleTokens: string[] = [];
  const matchedContentTokens: string[] = [];
  const matchedSourceTokens: string[] = [];

  const keyLower = candidate.key?.trim().toLowerCase() ?? null;
  const titleLower = candidate.title.toLowerCase();
  const contentLower = candidate.content.toLowerCase();
  const sourceLower = candidate.sourceLabel?.trim().toLowerCase() ?? null;

  for (const token of query.tokens) {
    if (keyLower && keyLower.includes(token) && !matchedKeyTokens.includes(token)) {
      matchedKeyTokens.push(token);
    }
    if (titleLower.includes(token) && !matchedTitleTokens.includes(token)) {
      matchedTitleTokens.push(token);
    }
    if (contentLower.includes(token) && !matchedContentTokens.includes(token)) {
      matchedContentTokens.push(token);
    }
    if (sourceLower && sourceLower.includes(token) && !matchedSourceTokens.includes(token)) {
      matchedSourceTokens.push(token);
    }
  }

  // Tag matching: slug exact OR slug/name contains a query token.
  const matchedTagSlugs: string[] = [];
  for (const slug of candidate.tagSlugs) {
    const slugLower = slug.toLowerCase();
    let matched = false;
    if (query.tagsExplicit.includes(slugLower)) matched = true;
    if (!matched) {
      for (const token of query.tokens) {
        if (slugLower.includes(token) || slugLower === token) {
          matched = true;
          break;
        }
      }
    }
    if (!matched && candidate.tagNames.length > 0) {
      for (const name of candidate.tagNames) {
        const nameLower = name.toLowerCase();
        if (query.tagsExplicit.includes(nameLower)) matched = true;
        if (!matched) {
          for (const token of query.tokens) {
            if (nameLower.includes(token)) {
              matched = true;
              break;
            }
          }
        }
        if (matched) break;
      }
    }
    if (matched) matchedTagSlugs.push(slug);
  }

  // Entity relation matching: count distinct context refs matched, cap at 3.
  const matchedEntities: string[] = [];
  for (const contextKey of query.entityContextKeys) {
    if (candidate.relationKeys.has(contextKey)) matchedEntities.push(contextKey);
  }

  const reasons: string[] = [];
  let total = 0;
  if (exactKey) {
    total += MEMORY_SCORE_EXACT_KEY;
    reasons.push("exact_key");
  }
  if (titlePhrase) {
    total += MEMORY_SCORE_TITLE_PHRASE;
    reasons.push("title_phrase");
  }
  const keyedToken = matchedKeyTokens.slice(0, MEMORY_SCORE_KEY_TOKEN_CAP);
  if (keyedToken.length > 0) {
    total += MEMORY_SCORE_KEY_TOKEN * keyedToken.length;
    reasons.push("key_match");
  }
  const titleTokens = matchedTitleTokens.slice(0, MEMORY_SCORE_TITLE_MATCH_CAP);
  if (titleTokens.length > 0) {
    total += MEMORY_SCORE_TITLE_MATCH * titleTokens.length;
    reasons.push("title_match");
  }
  const contentTokens = matchedContentTokens.slice(0, MEMORY_SCORE_CONTENT_MATCH_CAP);
  if (contentTokens.length > 0) {
    total += MEMORY_SCORE_CONTENT_MATCH * contentTokens.length;
    reasons.push("content_match");
  }
  const sourceTokens = matchedSourceTokens.slice(0, MEMORY_SCORE_SOURCE_MATCH_CAP);
  if (sourceTokens.length > 0) {
    total += MEMORY_SCORE_SOURCE_MATCH * sourceTokens.length;
    reasons.push("source_match");
  }
  const tagSlugs = matchedTagSlugs.slice(0, MEMORY_SCORE_TAG_MATCH_CAP).sort(stableCompareStrings);
  if (tagSlugs.length > 0) {
    total += MEMORY_SCORE_TAG_MATCH * tagSlugs.length;
    for (const slug of tagSlugs) reasons.push(`tag:${slug}`);
  }
  const matchedEntitiesSorted = matchedEntities
    .slice(0, MEMORY_SCORE_RELATION_CAP)
    .sort(stableCompareStrings);
  if (matchedEntitiesSorted.length > 0) {
    total += MEMORY_SCORE_RELATION * matchedEntitiesSorted.length;
    for (const entity of matchedEntitiesSorted) reasons.push(`related:${entity}`);
  }

  const importanceContribution = clampPositive(candidate.importance, 0) / 5;
  const importanceCapped = Math.min(MEMORY_SCORE_IMPORTANCE_MAX, importanceContribution);
  if (importanceCapped > 0) {
    total += importanceCapped;
    reasons.push("importance");
  }

  const ageMs = Math.max(0, requestNow.getTime() - candidate.updatedAt.getTime());
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const recencyContribution = Math.max(
    0,
    MEMORY_SCORE_RECENCY_MAX * (1 - ageDays / MEMORY_SCORE_RECENCY_HALFLIFE_DAYS),
  );
  if (recencyContribution > 0) {
    total += recencyContribution;
    reasons.push("recency");
  }

  const accessFrequencyContribution = Math.min(
    MEMORY_SCORE_FREQUENCY_MAX,
    Math.log2(1 + Math.max(0, candidate.accessCount)),
  );
  if (accessFrequencyContribution > 0 && candidate.accessCount > 0) {
    total += accessFrequencyContribution;
    reasons.push("access_frequency");
  }

  const pinnedMatching = options.includePinned && candidate.pinned;
  if (pinnedMatching) {
    total += MEMORY_SCORE_PINNED;
    reasons.push("pinned");
  }

  const score = Math.round(total * 1000) / 1000;

  return {
    candidate,
    score,
    breakdown: {
      exactKey,
      titlePhrase,
      keyTokens: keyedToken,
      titleTokens,
      contentTokens,
      sourceTokens,
      matchedTagSlugs: tagSlugs,
      matchedRelationEntities: matchedEntitiesSorted,
      pinned: pinnedMatching,
      importanceContribution: importanceCapped,
      recencyDays: ageDays,
      recencyContribution,
      accessFrequencyContribution,
      reasons,
    },
  };
}

export interface PreparedRecallQuery extends PreparedMemoryQuery {
  tagsExplicit: string[];
  entityContextKeys: string[];
}

export function prepareRecallQuery(
  raw: string,
  tags: string[] | undefined,
  entityContextRefs: { entityType: string; entityId: string }[] | undefined,
): PreparedRecallQuery {
  const base = prepareMemoryQuery(raw);
  const tagsExplicit = (tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean);
  const entityContextKeys = (entityContextRefs ?? []).map((r) => `${r.entityType}:${r.entityId}`);
  return { ...base, tagsExplicit, entityContextKeys };
}

/**
 * Determine whether a candidate has at least one matching signal beyond
 * metadata-only boosts. Used to decide normal-match eligibility; importance,
 * recency, access frequency, and pin alone do not establish relevance.
 */
export function hasMatchingSignal(scored: ScoredMemory): boolean {
  return (
    scored.breakdown.exactKey ||
    scored.breakdown.titlePhrase ||
    scored.breakdown.keyTokens.length > 0 ||
    scored.breakdown.titleTokens.length > 0 ||
    scored.breakdown.contentTokens.length > 0 ||
    scored.breakdown.sourceTokens.length > 0 ||
    scored.breakdown.matchedTagSlugs.length > 0 ||
    scored.breakdown.matchedRelationEntities.length > 0
  );
}

export interface RankedMemory extends ScoredMemory {
  /** "normal" = matched by signal; "ambient" = eligible pinned fallback only. */
  tier: "normal" | "ambient";
}

export function rankMemoryCandidates(
  candidates: MemoryCandidate[],
  query: PreparedRecallQuery,
  options: { includePinned: boolean; limit: number },
  requestNow: Date,
): RankedMemory[] {
  const AMBIENT_PIN_LIMIT = 3;
  const scored = candidates.map((candidate) => ({
    ...computeMemoryScore(candidate, query, requestNow, { includePinned: options.includePinned }),
  }));

  const normals = scored.filter(hasMatchingSignal).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const t = b.candidate.updatedAt.getTime() - a.candidate.updatedAt.getTime();
    if (t !== 0) return t;
    return stableCompareStrings(a.candidate.id, b.candidate.id);
  });

  const result: RankedMemory[] = [];
  for (const s of normals.slice(0, options.limit)) {
    result.push({ ...s, tier: "normal" });
  }

  const capacityLeft = options.limit - result.length;
  if (capacityLeft > 0 && options.includePinned) {
    const ambientPool = scored.filter((s) => !hasMatchingSignal(s));
    const ambientSorted = ambientPool.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const t = b.candidate.updatedAt.getTime() - a.candidate.updatedAt.getTime();
      if (t !== 0) return t;
      return stableCompareStrings(a.candidate.id, b.candidate.id);
    });
    let taken = 0;
    for (const s of ambientSorted) {
      if (taken >= AMBIENT_PIN_LIMIT) break;
      if (!s.candidate.pinned) continue;
      const reasons = [...s.breakdown.reasons, "ambient_pinned"];
      result.push({
        ...s,
        tier: "ambient",
        breakdown: { ...s.breakdown, reasons },
      });
      taken += 1;
    }
  }

  return result;
}

export function excerptMemoryContent(content: string, maxLength = 240): string {
  const collapsed = content.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength - 3)}...`;
}

export function truncateMemoryContent(content: string, maxLength = 2000): {
  text: string;
  truncated: boolean;
} {
  if (content.length <= maxLength) return { text: content, truncated: false };
  return { text: `${content.slice(0, maxLength)}...`, truncated: true };
}
