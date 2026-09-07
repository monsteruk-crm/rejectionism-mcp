import "server-only";
import { getPrisma } from "@/lib/prisma";
import { ok, handleServiceError, ServiceResult } from "./results";
import { entityHref } from "./entity-refs";
import type { OriginalEntityType } from "./tag-schemas";

export interface EntityLookupItem {
  id: string;
  entityType: OriginalEntityType;
  title: string;
  href: string;
  version?: number;
  status?: string | null;
}

export interface EntityLookupResult {
  items: EntityLookupItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AssetRevisionLookupItem {
  id: string;
  assetId: string;
  revisionNumber: number;
  label: string | null;
  notes: string | null;
  representationCount: number;
  createdAt: string;
}

export interface AssetRevisionLookupResult {
  items: AssetRevisionLookupItem[];
  total: number;
  limit: number;
  offset: number;
}

const ALL_LOOKUP_TYPES: OriginalEntityType[] = [
  "WORK_ITEM",
  "CANON_ENTRY",
  "DECISION",
  "ASSET",
  "WEBSITE",
  "CONTENT_ITEM",
  "CONTACT",
];

export async function lookupEntities(params: {
  query?: string;
  entityTypes?: OriginalEntityType[];
  limit?: number;
  offset?: number;
}): Promise<ServiceResult<EntityLookupResult>> {
  const query = params.query?.trim() || "";
  const targetTypes = params.entityTypes && params.entityTypes.length > 0 ? params.entityTypes : ALL_LOOKUP_TYPES;
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const offset = Math.max(0, params.offset ?? 0);

  try {
    const prisma = getPrisma();
    const items: EntityLookupItem[] = [];
    let totalCount = 0;

    for (const type of targetTypes) {
      if (type === "WORK_ITEM") {
        const where = query
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" as const } },
                { description: { contains: query, mode: "insensitive" as const } },
              ],
            }
          : {};
        const [rows, count] = await Promise.all([
          prisma.workItem.findMany({
            where,
            select: { id: true, title: true, version: true, status: true },
            orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
            take: limit,
            skip: offset,
          }),
          prisma.workItem.count({ where }),
        ]);
        totalCount += count;
        for (const r of rows) {
          items.push({
            id: r.id,
            entityType: "WORK_ITEM",
            title: r.title,
            href: entityHref("WORK_ITEM", r.id),
            version: r.version,
            status: r.status,
          });
        }
      } else if (type === "CANON_ENTRY") {
        const where = query
          ? {
              OR: [
                { key: { contains: query, mode: "insensitive" as const } },
                { value: { contains: query, mode: "insensitive" as const } },
              ],
            }
          : {};
        const [rows, count] = await Promise.all([
          prisma.canonEntry.findMany({
            where,
            select: { id: true, key: true, version: true, category: true },
            orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
            take: limit,
            skip: offset,
          }),
          prisma.canonEntry.count({ where }),
        ]);
        totalCount += count;
        for (const r of rows) {
          items.push({
            id: r.id,
            entityType: "CANON_ENTRY",
            title: `${r.key} (${r.category})`,
            href: entityHref("CANON_ENTRY", r.id),
            version: r.version,
            status: null,
          });
        }
      } else if (type === "DECISION") {
        const where = query
          ? {
              OR: [
                { subject: { contains: query, mode: "insensitive" as const } },
                { decision: { contains: query, mode: "insensitive" as const } },
              ],
            }
          : {};
        const [rows, count] = await Promise.all([
          prisma.decision.findMany({
            where,
            select: { id: true, subject: true },
            orderBy: [{ decidedAt: "desc" }, { id: "asc" }],
            take: limit,
            skip: offset,
          }),
          prisma.decision.count({ where }),
        ]);
        totalCount += count;
        for (const r of rows) {
          items.push({
            id: r.id,
            entityType: "DECISION",
            title: r.subject,
            href: entityHref("DECISION", r.id),
          });
        }
      } else if (type === "ASSET") {
        const where = query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" as const } },
                { kind: { contains: query, mode: "insensitive" as const } },
              ],
            }
          : {};
        const [rows, count] = await Promise.all([
          prisma.asset.findMany({
            where,
            select: { id: true, name: true, kind: true, version: true, status: true },
            orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
            take: limit,
            skip: offset,
          }),
          prisma.asset.count({ where }),
        ]);
        totalCount += count;
        for (const r of rows) {
          items.push({
            id: r.id,
            entityType: "ASSET",
            title: `${r.name} (${r.kind})`,
            href: entityHref("ASSET", r.id),
            version: r.version,
            status: r.status,
          });
        }
      } else if (type === "WEBSITE") {
        const where = query
          ? {
              OR: [
                { domain: { contains: query, mode: "insensitive" as const } },
                { name: { contains: query, mode: "insensitive" as const } },
              ],
            }
          : {};
        const [rows, count] = await Promise.all([
          prisma.website.findMany({
            where,
            select: { id: true, domain: true, name: true, version: true, status: true },
            orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
            take: limit,
            skip: offset,
          }),
          prisma.website.count({ where }),
        ]);
        totalCount += count;
        for (const r of rows) {
          items.push({
            id: r.id,
            entityType: "WEBSITE",
            title: `${r.domain} — ${r.name}`,
            href: entityHref("WEBSITE", r.id),
            version: r.version,
            status: r.status,
          });
        }
      } else if (type === "CONTENT_ITEM") {
        const where = query
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" as const } },
                { channel: { contains: query, mode: "insensitive" as const } },
              ],
            }
          : {};
        const [rows, count] = await Promise.all([
          prisma.contentItem.findMany({
            where,
            select: { id: true, title: true, channel: true, version: true, status: true },
            orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
            take: limit,
            skip: offset,
          }),
          prisma.contentItem.count({ where }),
        ]);
        totalCount += count;
        for (const r of rows) {
          items.push({
            id: r.id,
            entityType: "CONTENT_ITEM",
            title: `${r.title} [${r.channel}]`,
            href: entityHref("CONTENT_ITEM", r.id),
            version: r.version,
            status: r.status,
          });
        }
      } else if (type === "CONTACT") {
        const where = query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" as const } },
                { organization: { contains: query, mode: "insensitive" as const } },
              ],
            }
          : {};
        const [rows, count] = await Promise.all([
          prisma.contact.findMany({
            where,
            select: { id: true, name: true, organization: true, version: true, status: true },
            orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
            take: limit,
            skip: offset,
          }),
          prisma.contact.count({ where }),
        ]);
        totalCount += count;
        for (const r of rows) {
          items.push({
            id: r.id,
            entityType: "CONTACT",
            title: r.organization ? `${r.name} (${r.organization})` : r.name,
            href: entityHref("CONTACT", r.id),
            version: r.version,
            status: r.status,
          });
        }
      }
    }

    return ok({
      items: items.slice(0, limit),
      total: totalCount,
      limit,
      offset,
    });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function lookupAssetRevisions(params: {
  assetId: string;
  limit?: number;
  offset?: number;
}): Promise<ServiceResult<AssetRevisionLookupResult>> {
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const offset = Math.max(0, params.offset ?? 0);

  try {
    const prisma = getPrisma();
    const where = { assetId: params.assetId };

    const [rows, total] = await Promise.all([
      prisma.assetRevision.findMany({
        where,
        include: { representations: { select: { id: true } } },
        orderBy: { revisionNumber: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.assetRevision.count({ where }),
    ]);

    const items: AssetRevisionLookupItem[] = rows.map((r) => ({
      id: r.id,
      assetId: r.assetId,
      revisionNumber: r.revisionNumber,
      label: r.label,
      notes: r.notes,
      representationCount: r.representations.length,
      createdAt: r.createdAt.toISOString(),
    }));

    return ok({
      items,
      total,
      limit,
      offset,
    });
  } catch (err) {
    return handleServiceError(err);
  }
}
