import "server-only";
import { getPrisma } from "@/lib/prisma";
import { isTestModeEnabled } from "./test-mode";
import { ok, testModeDisabledResult, handleServiceError, ServiceResult } from "./results";
import {
  SEED_CANON_ENTRIES,
  SEED_WEBSITES,
  SEED_WORK_ITEMS,
  SEED_ASSETS,
} from "../../prisma/seed-data";
import { createActivityTx } from "./activity";
import { Prisma } from "@/app/generated/prisma/client";

export interface SeedResultSummary {
  canon: { created: number; updated: number; unchanged: number };
  websites: { created: number; updated: number; unchanged: number };
  workItems: { created: number; updated: number; unchanged: number };
  assets: { created: number; updated: number; unchanged: number };
}

export async function seedCampaignData(): Promise<ServiceResult<SeedResultSummary>> {
  if (!isTestModeEnabled()) {
    return testModeDisabledResult();
  }

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

        // 4. Seed Assets (Sections 4A, 4B, 4C)
        for (const item of SEED_ASSETS) {
          const existing = await tx.asset.findUnique({
            where: { id: item.id },
          });

          if (!existing) {
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
          } else {
            // Check if seed-owned metadata changed; preserve user-updated status/url
            const hasChange =
              existing.name !== item.name ||
              existing.kind !== item.kind ||
              existing.sourceFilename !== item.sourceFilename ||
              existing.notes !== item.notes;

            if (hasChange) {
              await tx.asset.update({
                where: { id: existing.id },
                data: {
                  name: item.name,
                  kind: item.kind,
                  sourceFilename: item.sourceFilename,
                  notes: item.notes,
                  version: existing.version + 1,
                },
              });

              await createActivityTx(tx, {
                entityType: "ASSET",
                entityId: existing.id,
                action: "UPDATED",
                summary: `Refreshed seed asset metadata: ${item.name}`,
                source: "seed",
                metadata: { id: existing.id, oldVersion: existing.version },
              });

              summary.assets.updated++;
            } else {
              summary.assets.unchanged++;
            }
          }
        }
      },
      {
        maxWait: 5000,
        timeout: 20000,
      },
    );

    return ok(summary);
  } catch (error) {
    return handleServiceError(error);
  }
}
