import { describe, it, expect } from "vitest";
import {
  computeMemoryScore,
  prepareMemoryQuery,
  prepareRecallQuery,
  rankMemoryCandidates,
  MEMORY_SCORE_EXACT_KEY,
  MEMORY_SCORE_TITLE_PHRASE,
  type MemoryCandidate,
} from "@/lib/campaign/memory-relevance";

describe("lib/campaign/memory-relevance", () => {
  const fixedNow = new Date("2026-09-10T12:00:00Z");

  const makeCandidate = (overrides: Partial<MemoryCandidate> = {}): MemoryCandidate => ({
    id: "mem-1",
    key: null,
    title: "Papal artwork guidelines",
    content: "Papal imagery should look authentically ecclesiastical before the joke becomes obvious.",
    sourceLabel: null,
    tagSlugs: ["church", "pope"],
    tagNames: ["church", "pope"],
    importance: 80,
    pinned: false,
    updatedAt: new Date("2026-09-09T12:00:00Z"),
    accessCount: 5,
    relationKeys: new Set(["CANON_ENTRY:pope.name"]),
    ...overrides,
  });

  it("gives massive boost to exact key match", () => {
    const candidate = makeCandidate({ key: "visual.papal.realism" });
    const query = prepareRecallQuery("visual.papal.realism", undefined, undefined);
    const scored = computeMemoryScore(candidate, query, fixedNow, { includePinned: true });

    expect(scored.breakdown.exactKey).toBe(true);
    expect(scored.score).toBeGreaterThanOrEqual(MEMORY_SCORE_EXACT_KEY);
    expect(scored.breakdown.reasons).toContain("exact_key");
  });

  it("gives title phrase match bonus when entire query appears in title", () => {
    const candidate = makeCandidate({ title: "Authentic papal artwork" });
    const query = prepareRecallQuery("papal artwork", undefined, undefined);
    const scored = computeMemoryScore(candidate, query, fixedNow, { includePinned: true });

    expect(scored.breakdown.titlePhrase).toBe(true);
    expect(scored.breakdown.reasons).toContain("title_phrase");
  });

  it("matches tags and relations from context", () => {
    const candidate = makeCandidate();
    const query = prepareRecallQuery(
      "something else entirely",
      ["pope"],
      [{ entityType: "CANON_ENTRY", entityId: "pope.name" }],
    );
    const scored = computeMemoryScore(candidate, query, fixedNow, { includePinned: true });

    expect(scored.breakdown.matchedTagSlugs).toContain("pope");
    expect(scored.breakdown.matchedRelationEntities).toContain("CANON_ENTRY:pope.name");
    expect(scored.breakdown.reasons).toContain("tag:pope");
    expect(scored.breakdown.reasons).toContain("related:CANON_ENTRY:pope.name");
  });

  it("ambient pinned candidates do not displace normal matches", () => {
    const matchingUnpinned = makeCandidate({
      id: "unpinned-match",
      title: "Targeted search term",
      pinned: false,
    });
    const irrelevantPinned = makeCandidate({
      id: "pinned-irrelevant",
      title: "Completely unrelated subject",
      content: "Nothing in common",
      tagSlugs: [],
      tagNames: [],
      relationKeys: new Set(),
      pinned: true,
    });

    const query = prepareRecallQuery("Targeted search term", undefined, undefined);
    const ranked = rankMemoryCandidates(
      [irrelevantPinned, matchingUnpinned],
      query,
      { includePinned: true, limit: 10 },
      fixedNow,
    );

    expect(ranked[0]?.candidate.id).toBe("unpinned-match");
    expect(ranked[0]?.tier).toBe("normal");
    expect(ranked[1]?.candidate.id).toBe("pinned-irrelevant");
    expect(ranked[1]?.tier).toBe("ambient");
    expect(ranked[1]?.breakdown.reasons).toContain("ambient_pinned");
  });

  it("limits ambient pinned candidates to at most 3", () => {
    const pinnedItems: MemoryCandidate[] = Array.from({ length: 6 }, (_, i) =>
      makeCandidate({
        id: `pinned-${i}`,
        title: `Irrelevant ${i}`,
        content: `No match ${i}`,
        tagSlugs: [],
        tagNames: [],
        relationKeys: new Set(),
        pinned: true,
      }),
    );

    const query = prepareRecallQuery("nonexistent query phrase", undefined, undefined);
    const ranked = rankMemoryCandidates(pinnedItems, query, { includePinned: true, limit: 10 }, fixedNow);

    const ambientOnly = ranked.filter((r) => r.tier === "ambient");
    expect(ambientOnly.length).toBeLessThanOrEqual(3);
  });
});
