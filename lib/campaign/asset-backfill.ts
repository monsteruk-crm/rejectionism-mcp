import "server-only";
import { createHash } from "node:crypto";
import { getPrisma } from "@/lib/prisma";
import { ok, handleServiceError, ServiceResult } from "./results";
import { createActivityTx } from "./activity";
import { isExternalHttpUrl } from "./external-url";
import { Prisma } from "@/app/generated/prisma/client";

/**
 * Idempotent backfill of legacy Asset data onto the revision/representation
 * structures (upgrade plan section 2, "Migration and legacy-data procedure").
 *
 * The migration inserts revision 1 for every existing Asset; this service
 * creates an EXTERNAL_URL representation on revision 1 when a legacy URL is
 * present and passes the strict external-URL validator. Rules:
 * - sourceFilename alone is not proof of a file and creates nothing.
 * - Invalid URLs remain untouched in the legacy column (rendered as plain
 *   text elsewhere); they are never migrated.
 * - A previously migrated representation is never updated; the unique
 *   legacyAssetId marker skips repeat runs.
 * - Existing Asset columns, version, and timestamps are never modified.
 */

export interface LegacyAssetBackfillSummary {
  totalAssets: number;
  revisionsCreated: number;
  representationsCreated: number;
  alreadyMigrated: number;
  withoutLegacyUrl: number;
  invalidUrls: number;
}

export function legacyRevisionId(assetId: string): string {
  return `legacy-revision-${createHash("md5").update(assetId).digest("hex")}`;
}

function isLegacyMigrationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

export async function backfillLegacyAssets(): Promise<
  ServiceResult<LegacyAssetBackfillSummary>
> {
  try {
    const prisma = getPrisma();

    const summary: LegacyAssetBackfillSummary = {
      totalAssets: 0,
      revisionsCreated: 0,
      representationsCreated: 0,
      alreadyMigrated: 0,
      withoutLegacyUrl: 0,
      invalidUrls: 0,
    };

    // Deterministic order for stable, reportable runs.
    const assets = await prisma.asset.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        url: true,
        sourceFilename: true,
        createdAt: true,
      },
    });
    summary.totalAssets = assets.length;

    for (const asset of assets) {
      await prisma.$transaction(async (tx) => {
        // 1. Read the unchanged legacy columns and revision 1.
        let revision = await tx.assetRevision.findUnique({
          where: {
            assetId_revisionNumber: { assetId: asset.id, revisionNumber: 1 },
          },
          select: { id: true },
        });

        if (!revision) {
          // The migration normally guarantees revision 1; create it
          // deterministically for any asset that predates the structures
          // without one (e.g. seeded after a partial cutover).
          revision = await tx.assetRevision.create({
            data: {
              id: legacyRevisionId(asset.id),
              assetId: asset.id,
              revisionNumber: 1,
              createdAt: asset.createdAt,
            },
            select: { id: true },
          });
          summary.revisionsCreated += 1;
        }

        // 2. A null/empty URL creates no representation; sourceFilename alone
        // is not proof of a file.
        const legacyUrl = asset.url;
        if (typeof legacyUrl !== "string" || legacyUrl.trim().length === 0) {
          summary.withoutLegacyUrl += 1;
          return;
        }

        // 3. Use the unique legacyAssetId marker to skip a second backfill.
        // A previously migrated representation is never updated, even when
        // the legacy column changes afterwards.
        const existing = await tx.assetRepresentation.findFirst({
          where: { legacyAssetId: asset.id },
          select: { id: true },
        });
        if (existing) {
          summary.alreadyMigrated += 1;
          return;
        }

        // 4. Invalid URLs remain untouched in the legacy column.
        if (!isExternalHttpUrl(legacyUrl)) {
          summary.invalidUrls += 1;
          return;
        }

        // 5. Preserve the original URL string and legacy sourceFilename;
        // unverified technical metadata stays null.
        const primaryCount = await tx.assetRepresentation.count({
          where: { assetRevisionId: revision.id, isPrimary: true },
        });

        try {
          const created = await tx.assetRepresentation.create({
            data: {
              assetRevisionId: revision.id,
              storageType: "EXTERNAL_URL",
              label: "Legacy reference",
              sourceFilename: asset.sourceFilename,
              externalUrl: legacyUrl,
              legacyAssetId: asset.id,
              isPrimary: primaryCount === 0,
            },
            select: { id: true },
          });

          // 6. Audit only actual representation creation. The Asset row itself
          // (version, timestamps, columns) is intentionally untouched.
          await createActivityTx(tx, {
            entityType: "ASSET",
            entityId: asset.id,
            action: "ASSET_LEGACY_REFERENCE_MIGRATED",
            summary: `Migrated legacy URL reference to revision 1 for asset: ${asset.name}`,
            source: "system",
            metadata: {
              revisionId: revision.id,
              representationId: created.id,
              isPrimary: primaryCount === 0,
            },
          });

          summary.representationsCreated += 1;
        } catch (error) {
          // A concurrent backfill won the unique legacyAssetId race; treat the
          // asset as already migrated rather than failing the run.
          if (isLegacyMigrationConflict(error)) {
            summary.alreadyMigrated += 1;
            return;
          }
          throw error;
        }
      });
    }

    return ok(summary);
  } catch (error) {
    return handleServiceError(error);
  }
}
