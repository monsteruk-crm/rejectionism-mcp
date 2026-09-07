import "server-only";
import { getPrisma } from "@/lib/prisma";
import { ok, handleServiceError, ServiceResult } from "./results";
import { entityHref } from "./entity-refs";
import {
  SearchQuerySchema,
  SearchResultDto,
  SearchOutputDto,
} from "./search-schemas";
import { OriginalEntityType } from "./tag-schemas";
import { Prisma } from "@/app/generated/prisma/client";

/**
 * Global search service across all seven campaign registers
 * (upgrade plan section 4 tool 42, section 5).
 *
 * - Case-insensitive literal substring matching.
 * - Wildcard characters %, _, \ are escaped so user input is literal.
 * - Text-or-tag matching is ANDed with entityTypes and all requested tag slugs.
 * - Global ordering: updatedAt desc, then fixed entityType order, then id asc.
 * - Snippet: first matching allowed field (collapsed whitespace, max 240 chars)
 *   or "Tags: <matching slugs>". Contact private email/notes are NEVER searched
 *   or exposed in snippets.
 */

const ALL_ENTITY_TYPES: OriginalEntityType[] = [
  "WORK_ITEM",
  "CANON_ENTRY",
  "DECISION",
  "ASSET",
  "WEBSITE",
  "CONTENT_ITEM",
  "CONTACT",
];

const ENTITY_TYPE_ORDER: Record<OriginalEntityType, number> = {
  WORK_ITEM: 1,
  CANON_ENTRY: 2,
  DECISION: 3,
  ASSET: 4,
  WEBSITE: 5,
  CONTENT_ITEM: 6,
  CONTACT: 7,
};

export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, "\\$&");
}

function collapseAndTruncate(text: string, maxLen = 240): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLen) return collapsed;
  return `${collapsed.slice(0, maxLen - 3)}...`;
}

function extractSnippet(
  fields: Array<string | null | undefined>,
  query: string,
  matchingTagSlugs: string[],
): string {
  const qLower = query.toLowerCase();
  for (const field of fields) {
    if (field && field.toLowerCase().includes(qLower)) {
      return collapseAndTruncate(field);
    }
  }
  if (matchingTagSlugs.length > 0) {
    return collapseAndTruncate(`Tags: ${matchingTagSlugs.join(", ")}`);
  }
  // Fallback if matched via tag or fallback
  const firstNonEmpty = fields.find((f) => f && f.trim().length > 0);
  return firstNonEmpty ? collapseAndTruncate(firstNonEmpty) : "";
}

function compareSearchResults(a: SearchResultDto, b: SearchResultDto): number {
  const timeA = new Date(a.updatedAt).getTime();
  const timeB = new Date(b.updatedAt).getTime();
  if (timeA !== timeB) {
    return timeB - timeA; // Descending
  }
  const orderA = ENTITY_TYPE_ORDER[a.entityType];
  const orderB = ENTITY_TYPE_ORDER[b.entityType];
  if (orderA !== orderB) {
    return orderA - orderB;
  }
  return a.id.localeCompare(b.id);
}

export async function searchCampaign(rawInput: unknown): Promise<ServiceResult<SearchOutputDto>> {
  const parsed = SearchQuerySchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const { query, entityTypes, tags, limit, offset } = parsed.data;
  const deduplicatedTags = tags && tags.length > 0 ? Array.from(new Set(tags)) : undefined;
  const targetTypes = entityTypes && entityTypes.length > 0 ? entityTypes : ALL_ENTITY_TYPES;
  const maxCandidateRows = limit + offset;
  const escapedQuery = escapeLikePattern(query);

  try {
    const prisma = getPrisma();

    // Execute within a transaction for a consistent snapshot
    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Resolve tag filtering IDs if tags are requested
        const requiredTagIdsByType = new Map<OriginalEntityType, Set<string>>();

        if (deduplicatedTags && deduplicatedTags.length > 0) {
          const tagRows = await tx.tag.findMany({
            where: { slug: { in: deduplicatedTags } },
            select: { id: true },
          });

          // Unknown requested slug produces 0 results globally
          if (tagRows.length !== deduplicatedTags.length) {
            return { items: [], total: 0, limit, offset };
          }

          const tagIdList = tagRows.map((t) => t.id);

          for (const type of targetTypes) {
            const memberships = await tx.entityTag.findMany({
              where: {
                entityType: type,
                tagId: { in: tagIdList },
              },
              select: { entityId: true },
            });

            const counts = new Map<string, number>();
            for (const m of memberships) {
              counts.set(m.entityId, (counts.get(m.entityId) ?? 0) + 1);
            }

            const qualifiedIds = new Set<string>();
            for (const [id, count] of counts.entries()) {
              if (count >= deduplicatedTags.length) {
                qualifiedIds.add(id);
              }
            }

            requiredTagIdsByType.set(type, qualifiedIds);
          }
        }

        // 2. Query each targeted entity type
        const allCandidates: SearchResultDto[] = [];
        let grandTotal = 0;

        // Helper to get tag matches for an entity type
        const getTagMatchedEntityIds = async (type: OriginalEntityType): Promise<Map<string, string[]>> => {
          const entityTagRows = await tx.entityTag.findMany({
            where: {
              entityType: type,
              tag: {
                OR: [
                  { name: { contains: escapedQuery, mode: "insensitive" } },
                  { slug: { contains: escapedQuery, mode: "insensitive" } },
                ],
              },
            },
            include: { tag: true },
          });

          const map = new Map<string, string[]>();
          for (const row of entityTagRows) {
            const existing = map.get(row.entityId) ?? [];
            existing.push(row.tag.slug);
            map.set(row.entityId, existing);
          }
          return map;
        };

        for (const type of targetTypes) {
          const requiredIds = requiredTagIdsByType.get(type);
          if (deduplicatedTags && requiredIds && requiredIds.size === 0) {
            // No entities of this type have all required tags
            continue;
          }

          const tagMatches = await getTagMatchedEntityIds(type);
          const tagMatchedIds = Array.from(tagMatches.keys());

          if (type === "WORK_ITEM") {
            const textWhere: Prisma.WorkItemWhereInput = {
              OR: [
                { title: { contains: escapedQuery, mode: "insensitive" } },
                { description: { contains: escapedQuery, mode: "insensitive" } },
                { blockedReason: { contains: escapedQuery, mode: "insensitive" } },
                { completionNote: { contains: escapedQuery, mode: "insensitive" } },
                ...(tagMatchedIds.length > 0 ? [{ id: { in: tagMatchedIds } }] : []),
              ],
            };

            const where: Prisma.WorkItemWhereInput = requiredIds
              ? { AND: [textWhere, { id: { in: Array.from(requiredIds) } }] }
              : textWhere;

            const [count, rows] = await Promise.all([
              tx.workItem.count({ where }),
              tx.workItem.findMany({
                where,
                orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
                take: maxCandidateRows,
              }),
            ]);

            grandTotal += count;

            // Load tags for candidates
            const candidateIds = rows.map((r) => r.id);
            const entityTags = await tx.entityTag.findMany({
              where: { entityType: "WORK_ITEM", entityId: { in: candidateIds } },
              include: { tag: true },
            });
            const tagsByEntity = new Map<string, string[]>();
            for (const et of entityTags) {
              const list = tagsByEntity.get(et.entityId) ?? [];
              list.push(et.tag.slug);
              tagsByEntity.set(et.entityId, list);
            }

            for (const row of rows) {
              const rowTags = (tagsByEntity.get(row.id) ?? []).sort();
              const matchingTags = rowTags.filter(
                (slug) => slug.toLowerCase().includes(query.toLowerCase()),
              );
              const snippet = extractSnippet(
                [row.title, row.description, row.blockedReason, row.completionNote],
                query,
                matchingTags,
              );

              allCandidates.push({
                entityType: "WORK_ITEM",
                id: row.id,
                title: row.title,
                snippet,
                status: row.status,
                tags: rowTags,
                updatedAt: row.updatedAt.toISOString(),
                href: entityHref("WORK_ITEM", row.id),
              });
            }
          } else if (type === "CANON_ENTRY") {
            const textWhere: Prisma.CanonEntryWhereInput = {
              OR: [
                { key: { contains: escapedQuery, mode: "insensitive" } },
                { value: { contains: escapedQuery, mode: "insensitive" } },
                { category: { contains: escapedQuery, mode: "insensitive" } },
                { notes: { contains: escapedQuery, mode: "insensitive" } },
                ...(tagMatchedIds.length > 0 ? [{ id: { in: tagMatchedIds } }] : []),
              ],
            };

            const where: Prisma.CanonEntryWhereInput = requiredIds
              ? { AND: [textWhere, { id: { in: Array.from(requiredIds) } }] }
              : textWhere;

            const [count, rows] = await Promise.all([
              tx.canonEntry.count({ where }),
              tx.canonEntry.findMany({
                where,
                orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
                take: maxCandidateRows,
              }),
            ]);

            grandTotal += count;

            const candidateIds = rows.map((r) => r.id);
            const entityTags = await tx.entityTag.findMany({
              where: { entityType: "CANON_ENTRY", entityId: { in: candidateIds } },
              include: { tag: true },
            });
            const tagsByEntity = new Map<string, string[]>();
            for (const et of entityTags) {
              const list = tagsByEntity.get(et.entityId) ?? [];
              list.push(et.tag.slug);
              tagsByEntity.set(et.entityId, list);
            }

            for (const row of rows) {
              const rowTags = (tagsByEntity.get(row.id) ?? []).sort();
              const matchingTags = rowTags.filter(
                (slug) => slug.toLowerCase().includes(query.toLowerCase()),
              );
              const snippet = extractSnippet(
                [row.key, row.value, row.category, row.notes],
                query,
                matchingTags,
              );

              allCandidates.push({
                entityType: "CANON_ENTRY",
                id: row.id,
                title: row.key,
                snippet,
                status: null, // Status is null for Canon per Section 4
                tags: rowTags,
                updatedAt: row.updatedAt.toISOString(),
                href: entityHref("CANON_ENTRY", row.id),
              });
            }
          } else if (type === "DECISION") {
            const textWhere: Prisma.DecisionWhereInput = {
              OR: [
                { subject: { contains: escapedQuery, mode: "insensitive" } },
                { decision: { contains: escapedQuery, mode: "insensitive" } },
                { rationale: { contains: escapedQuery, mode: "insensitive" } },
                ...(tagMatchedIds.length > 0 ? [{ id: { in: tagMatchedIds } }] : []),
              ],
            };

            const where: Prisma.DecisionWhereInput = requiredIds
              ? { AND: [textWhere, { id: { in: Array.from(requiredIds) } }] }
              : textWhere;

            const [count, rows] = await Promise.all([
              tx.decision.count({ where }),
              tx.decision.findMany({
                where,
                include: { supersededBy: { select: { id: true } } },
                orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
                take: maxCandidateRows,
              }),
            ]);

            grandTotal += count;

            const candidateIds = rows.map((r) => r.id);
            const entityTags = await tx.entityTag.findMany({
              where: { entityType: "DECISION", entityId: { in: candidateIds } },
              include: { tag: true },
            });
            const tagsByEntity = new Map<string, string[]>();
            for (const et of entityTags) {
              const list = tagsByEntity.get(et.entityId) ?? [];
              list.push(et.tag.slug);
              tagsByEntity.set(et.entityId, list);
            }

            for (const row of rows) {
              const rowTags = (tagsByEntity.get(row.id) ?? []).sort();
              const matchingTags = rowTags.filter(
                (slug) => slug.toLowerCase().includes(query.toLowerCase()),
              );
              const snippet = extractSnippet(
                [row.subject, row.decision, row.rationale],
                query,
                matchingTags,
              );

              allCandidates.push({
                entityType: "DECISION",
                id: row.id,
                title: row.subject,
                snippet,
                status: row.supersededBy ? "SUPERSEDED" : "CURRENT",
                tags: rowTags,
                updatedAt: row.updatedAt.toISOString(),
                href: entityHref("DECISION", row.id),
              });
            }
          } else if (type === "ASSET") {
            const textWhere: Prisma.AssetWhereInput = {
              OR: [
                { name: { contains: escapedQuery, mode: "insensitive" } },
                { kind: { contains: escapedQuery, mode: "insensitive" } },
                { notes: { contains: escapedQuery, mode: "insensitive" } },
                { sourceFilename: { contains: escapedQuery, mode: "insensitive" } },
                {
                  revisions: {
                    some: {
                      representations: {
                        some: {
                          OR: [
                            { label: { contains: escapedQuery, mode: "insensitive" } },
                            { notes: { contains: escapedQuery, mode: "insensitive" } },
                            { sourceFilename: { contains: escapedQuery, mode: "insensitive" } },
                          ],
                        },
                      },
                    },
                  },
                },
                ...(tagMatchedIds.length > 0 ? [{ id: { in: tagMatchedIds } }] : []),
              ],
            };

            const where: Prisma.AssetWhereInput = requiredIds
              ? { AND: [textWhere, { id: { in: Array.from(requiredIds) } }] }
              : textWhere;

            const [count, rows] = await Promise.all([
              tx.asset.count({ where }),
              tx.asset.findMany({
                where,
                include: {
                  revisions: {
                    include: { representations: true },
                  },
                },
                orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
                take: maxCandidateRows,
              }),
            ]);

            grandTotal += count;

            const candidateIds = rows.map((r) => r.id);
            const entityTags = await tx.entityTag.findMany({
              where: { entityType: "ASSET", entityId: { in: candidateIds } },
              include: { tag: true },
            });
            const tagsByEntity = new Map<string, string[]>();
            for (const et of entityTags) {
              const list = tagsByEntity.get(et.entityId) ?? [];
              list.push(et.tag.slug);
              tagsByEntity.set(et.entityId, list);
            }

            for (const row of rows) {
              const rowTags = (tagsByEntity.get(row.id) ?? []).sort();
              const matchingTags = rowTags.filter(
                (slug) => slug.toLowerCase().includes(query.toLowerCase()),
              );

              const representationFields: string[] = [];
              for (const rev of row.revisions) {
                for (const rep of rev.representations) {
                  if (rep.label) representationFields.push(rep.label);
                  if (rep.notes) representationFields.push(rep.notes);
                  if (rep.sourceFilename) representationFields.push(rep.sourceFilename);
                }
              }

              const snippet = extractSnippet(
                [row.name, row.kind, row.notes, row.sourceFilename, ...representationFields],
                query,
                matchingTags,
              );

              allCandidates.push({
                entityType: "ASSET",
                id: row.id,
                title: row.name,
                snippet,
                status: row.status,
                tags: rowTags,
                updatedAt: row.updatedAt.toISOString(),
                href: entityHref("ASSET", row.id),
              });
            }
          } else if (type === "WEBSITE") {
            const textWhere: Prisma.WebsiteWhereInput = {
              OR: [
                { name: { contains: escapedQuery, mode: "insensitive" } },
                { domain: { contains: escapedQuery, mode: "insensitive" } },
                { purpose: { contains: escapedQuery, mode: "insensitive" } },
                { notes: { contains: escapedQuery, mode: "insensitive" } },
                ...(tagMatchedIds.length > 0 ? [{ id: { in: tagMatchedIds } }] : []),
              ],
            };

            const where: Prisma.WebsiteWhereInput = requiredIds
              ? { AND: [textWhere, { id: { in: Array.from(requiredIds) } }] }
              : textWhere;

            const [count, rows] = await Promise.all([
              tx.website.count({ where }),
              tx.website.findMany({
                where,
                orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
                take: maxCandidateRows,
              }),
            ]);

            grandTotal += count;

            const candidateIds = rows.map((r) => r.id);
            const entityTags = await tx.entityTag.findMany({
              where: { entityType: "WEBSITE", entityId: { in: candidateIds } },
              include: { tag: true },
            });
            const tagsByEntity = new Map<string, string[]>();
            for (const et of entityTags) {
              const list = tagsByEntity.get(et.entityId) ?? [];
              list.push(et.tag.slug);
              tagsByEntity.set(et.entityId, list);
            }

            for (const row of rows) {
              const rowTags = (tagsByEntity.get(row.id) ?? []).sort();
              const matchingTags = rowTags.filter(
                (slug) => slug.toLowerCase().includes(query.toLowerCase()),
              );
              const snippet = extractSnippet(
                [row.name, row.domain, row.purpose, row.notes],
                query,
                matchingTags,
              );

              allCandidates.push({
                entityType: "WEBSITE",
                id: row.id,
                title: row.name,
                snippet,
                status: row.status,
                tags: rowTags,
                updatedAt: row.updatedAt.toISOString(),
                href: entityHref("WEBSITE", row.id),
              });
            }
          } else if (type === "CONTENT_ITEM") {
            const textWhere: Prisma.ContentItemWhereInput = {
              OR: [
                { title: { contains: escapedQuery, mode: "insensitive" } },
                { format: { contains: escapedQuery, mode: "insensitive" } },
                { channel: { contains: escapedQuery, mode: "insensitive" } },
                { notes: { contains: escapedQuery, mode: "insensitive" } },
                ...(tagMatchedIds.length > 0 ? [{ id: { in: tagMatchedIds } }] : []),
              ],
            };

            const where: Prisma.ContentItemWhereInput = requiredIds
              ? { AND: [textWhere, { id: { in: Array.from(requiredIds) } }] }
              : textWhere;

            const [count, rows] = await Promise.all([
              tx.contentItem.count({ where }),
              tx.contentItem.findMany({
                where,
                orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
                take: maxCandidateRows,
              }),
            ]);

            grandTotal += count;

            const candidateIds = rows.map((r) => r.id);
            const entityTags = await tx.entityTag.findMany({
              where: { entityType: "CONTENT_ITEM", entityId: { in: candidateIds } },
              include: { tag: true },
            });
            const tagsByEntity = new Map<string, string[]>();
            for (const et of entityTags) {
              const list = tagsByEntity.get(et.entityId) ?? [];
              list.push(et.tag.slug);
              tagsByEntity.set(et.entityId, list);
            }

            for (const row of rows) {
              const rowTags = (tagsByEntity.get(row.id) ?? []).sort();
              const matchingTags = rowTags.filter(
                (slug) => slug.toLowerCase().includes(query.toLowerCase()),
              );
              const snippet = extractSnippet(
                [row.title, row.format, row.channel, row.notes],
                query,
                matchingTags,
              );

              allCandidates.push({
                entityType: "CONTENT_ITEM",
                id: row.id,
                title: row.title,
                snippet,
                status: row.status,
                tags: rowTags,
                updatedAt: row.updatedAt.toISOString(),
                href: entityHref("CONTENT_ITEM", row.id),
              });
            }
          } else if (type === "CONTACT") {
            // Note: Contact email and notes are NEVER searched (Section 4 rules)
            const textWhere: Prisma.ContactWhereInput = {
              OR: [
                { name: { contains: escapedQuery, mode: "insensitive" } },
                { organization: { contains: escapedQuery, mode: "insensitive" } },
                { role: { contains: escapedQuery, mode: "insensitive" } },
                { status: { contains: escapedQuery, mode: "insensitive" } },
                ...(tagMatchedIds.length > 0 ? [{ id: { in: tagMatchedIds } }] : []),
              ],
            };

            const where: Prisma.ContactWhereInput = requiredIds
              ? { AND: [textWhere, { id: { in: Array.from(requiredIds) } }] }
              : textWhere;

            const [count, rows] = await Promise.all([
              tx.contact.count({ where }),
              tx.contact.findMany({
                where,
                orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
                take: maxCandidateRows,
              }),
            ]);

            grandTotal += count;

            const candidateIds = rows.map((r) => r.id);
            const entityTags = await tx.entityTag.findMany({
              where: { entityType: "CONTACT", entityId: { in: candidateIds } },
              include: { tag: true },
            });
            const tagsByEntity = new Map<string, string[]>();
            for (const et of entityTags) {
              const list = tagsByEntity.get(et.entityId) ?? [];
              list.push(et.tag.slug);
              tagsByEntity.set(et.entityId, list);
            }

            for (const row of rows) {
              const rowTags = (tagsByEntity.get(row.id) ?? []).sort();
              const matchingTags = rowTags.filter(
                (slug) => slug.toLowerCase().includes(query.toLowerCase()),
              );
              // Contact snippet only uses name, organization, role, status - NEVER email or notes
              const snippet = extractSnippet(
                [row.name, row.organization, row.role, row.status],
                query,
                matchingTags,
              );

              allCandidates.push({
                entityType: "CONTACT",
                id: row.id,
                title: row.name,
                snippet,
                status: row.status,
                tags: rowTags,
                updatedAt: row.updatedAt.toISOString(),
                href: entityHref("CONTACT", row.id),
              });
            }
          }
        }

        // 3. Sort globally using the deterministic comparator
        allCandidates.sort(compareSearchResults);

        // 4. Slice globally at offset and limit
        const pagedItems = allCandidates.slice(offset, offset + limit);

        return {
          items: pagedItems,
          total: grandTotal,
          limit,
          offset,
        };
      },
      { isolationLevel: "RepeatableRead", maxWait: 15000, timeout: 60000 },
    );

    return ok(result);
  } catch (error) {
    return handleServiceError(error);
  }
}
