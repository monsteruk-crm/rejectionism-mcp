import "server-only";
import { getPrisma } from "@/lib/prisma";
import { ok, handleServiceError, ServiceResult } from "./results";
import {
  SEED_CANON_ENTRIES,
  SEED_WEBSITES,
  SEED_WORK_ITEMS,
  SEED_ASSETS,
} from "../../prisma/seed-data";
import { createActivityTx } from "./activity";
import { isExternalHttpUrl } from "./external-url";
import { Prisma } from "@/app/generated/prisma/client";

export interface SeedResultSummary {
  canon: { created: number; updated: number; unchanged: number };
  websites: { created: number; updated: number; unchanged: number };
  workItems: { created: number; updated: number; unchanged: number };
  assets: { created: number; updated: number; unchanged: number };
}

export async function seedCampaignData(): Promise<ServiceResult<SeedResultSummary>> {

  const summary: SeedResultSummary = {
    canon: { created: 0, updated: 0, unchanged: 0 },
    websites: { created: 0, updated: 0, unchanged: 0 },
    workItems: { created: 0, updated: 0, unchanged: 0 },
    assets: { created: 0, updated: 0, unchanged: 0 },
  };

  try {
    const prisma = getPrisma();

    await prisma.$transaction(
      async (tx) => {
        // 1. Seed Canon Entries
        for (const item of SEED_CANON_ENTRIES) {
          const existing = await tx.canonEntry.findUnique({
            where: { key: item.key },
          });

          if (!existing) {
            const created = await tx.canonEntry.create({
              data: {
                key: item.key,
                value: item.value,
                category: item.category,
                notes: item.notes,
                version: 1,
              },
            });

            await createActivityTx(tx, {
              entityType: "CANON_ENTRY",
              entityId: created.id,
              action: "CREATED",
              summary: `Seeded canon entry: ${created.key}`,
              source: "seed",
              metadata: { key: created.key, category: created.category },
            });

            summary.canon.created++;
          } else {
            const hasChange =
              existing.value !== item.value ||
              existing.category !== item.category ||
              existing.notes !== item.notes;

            if (hasChange) {
              await tx.canonEntry.update({
                where: { id: existing.id },
                data: {
                  value: item.value,
                  category: item.category,
                  notes: item.notes,
                  version: existing.version + 1,
                },
              });

              await createActivityTx(tx, {
                entityType: "CANON_ENTRY",
                entityId: existing.id,
                action: "UPDATED",
                summary: `Refreshed seed canon entry: ${existing.key}`,
                source: "seed",
                metadata: { key: existing.key, oldVersion: existing.version },
              });

              summary.canon.updated++;
            } else {
              summary.canon.unchanged++;
            }
          }
        }

        // 2. Seed Websites
        for (const item of SEED_WEBSITES) {
          const existing = await tx.website.findUnique({
            where: { domain: item.domain },
          });

          if (!existing) {
            const created = await tx.website.create({
              data: {
                name: item.name,
                domain: item.domain,
                purpose: item.purpose,
                status: item.status,
                repositoryUrl: item.repositoryUrl,
                deploymentUrl: item.deploymentUrl,
                notes: item.notes,
                version: 1,
              },
            });

            await createActivityTx(tx, {
              entityType: "WEBSITE",
              entityId: created.id,
              action: "CREATED",
              summary: `Seeded website: ${created.domain}`,
              source: "seed",
              metadata: { domain: created.domain, status: created.status },
            });

            summary.websites.created++;
          } else {
            // Only update seed-owned descriptive fields if changed; preserve operational fields
            const hasChange =
              existing.name !== item.name ||
              existing.purpose !== item.purpose ||
              existing.notes !== item.notes;

            if (hasChange) {
              await tx.website.update({
                where: { id: existing.id },
                data: {
                  name: item.name,
                  purpose: item.purpose,
                  notes: item.notes,
                  version: existing.version + 1,
                },
              });

              await createActivityTx(tx, {
                entityType: "WEBSITE",
                entityId: existing.id,
                action: "UPDATED",
                summary: `Refreshed seed website metadata: ${existing.domain}`,
                source: "seed",
                metadata: { domain: existing.domain, oldVersion: existing.version },
              });

              summary.websites.updated++;
            } else {
              summary.websites.unchanged++;
            }
          }
        }

        // 3. Seed Work Items
        for (const item of SEED_WORK_ITEMS) {
          const existing = await tx.workItem.findUnique({
            where: { id: item.id },
          });

          if (!existing) {
            const created = await tx.workItem.create({
              data: {
                id: item.id,
                title: item.title,
                description: item.description,
                status: item.status,
                priority: item.priority,
                version: 1,
              },
            });

            await createActivityTx(tx, {
              entityType: "WORK_ITEM",
              entityId: created.id,
              action: "CREATED",
              summary: `Seeded work item: ${created.title}`,
              source: "seed",
              metadata: {
                priority: created.priority,
                status: created.status,
              },
            });

            summary.workItems.created++;
          } else {
            // Check if seed-owned fields changed; preserve user status/evidence/completionNote
            const hasChange =
              existing.title !== item.title ||
              existing.description !== item.description ||
              existing.priority !== item.priority;

            if (hasChange) {
              await tx.workItem.update({
                where: { id: existing.id },
                data: {
                  title: item.title,
                  description: item.description,
                  priority: item.priority,
                  version: existing.version + 1,
                },
              });

              await createActivityTx(tx, {
                entityType: "WORK_ITEM",
                entityId: existing.id,
                action: "UPDATED",
                summary: `Refreshed seed work item: ${item.title}`,
                source: "seed",
                metadata: { id: existing.id, oldVersion: existing.version },
              });

              summary.workItems.updated++;
            } else {
              summary.workItems.unchanged++;
            }
          }
        }

        // 4. Seed Assets. Existing seed Assets are left completely unchanged
        // (metadata, version, revisions, and representations): rerunning the
        // seed must never overwrite human-edited artwork metadata.
        for (const item of SEED_ASSETS) {
          const existing = await tx.asset.findUnique({
            where: { id: item.id },
          });

          if (existing) {
            summary.assets.unchanged++;
            continue;
          }

          const created = await tx.asset.create({
            data: {
              id: item.id,
              name: item.name,
              kind: item.kind,
              status: item.status,
              sourceFilename: item.sourceFilename,
              url: item.url,
              notes: item.notes,
              version: 1,
            },
          });

          // New seed Assets get revision 1 and, when a valid seed URL exists,
          // a primary EXTERNAL_URL representation carrying the legacyAssetId
          // marker so a later backfill cannot duplicate the reference.
          const revision = await tx.assetRevision.create({
            data: {
              assetId: created.id,
              revisionNumber: 1,
            },
            select: { id: true },
          });

          if (typeof item.url === "string" && item.url.length > 0 && isExternalHttpUrl(item.url)) {
            await tx.assetRepresentation.create({
              data: {
                assetRevisionId: revision.id,
                storageType: "EXTERNAL_URL",
                sourceFilename: item.sourceFilename,
                externalUrl: item.url,
                legacyAssetId: created.id,
                isPrimary: true,
              },
            });
          }

          await createActivityTx(tx, {
            entityType: "ASSET",
            entityId: created.id,
            action: "CREATED",
            summary: `Seeded asset: ${created.name}`,
            source: "seed",
            metadata: {
              name: created.name,
              kind: created.kind,
              status: created.status,
            },
          });

          summary.assets.created++;
        }
      },
      {
        // The seed performs ~200 sequential queries in one atomic transaction;
        // remote/serverless PostgreSQL latency (e.g. Prisma Postgres) exceeds
        // the default 20s interactive-transaction budget, so allow up to 2
        // minutes. Applies to the authorized CLI seed only.
        maxWait: 10000,
        timeout: 120000,
      },
    );

    return ok(summary);
  } catch (error) {
    // The seed runs as an authorized CLI script; surface the raw error so the
    // operator sees the real failure instead of a generic INTERNAL_ERROR.
    console.error("Seed transaction failed with raw error:", error);
    return handleServiceError(error);
  }
}
