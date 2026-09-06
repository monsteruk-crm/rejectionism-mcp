import "server-only";
import { getPrisma } from "@/lib/prisma";
import { ok, fail, handleServiceError, ServiceResult } from "./results";
import {
  CreateWebsiteInputSchema,
  UpdateWebsiteInputSchema,
  ListWebsitesQuerySchema,
  WebsiteStatus,
  MutationSource,
} from "./schemas";
import { createActivityTx } from "./activity";
import { Prisma } from "@/app/generated/prisma/client";

export interface WebsiteDto {
  id: string;
  name: string;
  domain: string;
  purpose: string;
  status: WebsiteStatus;
  repositoryUrl: string | null;
  deploymentUrl: string | null;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export function mapWebsiteToDto(item: {
  id: string;
  name: string;
  domain: string;
  purpose: string;
  status: string;
  repositoryUrl: string | null;
  deploymentUrl: string | null;
  notes: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): WebsiteDto {
  return {
    id: item.id,
    name: item.name,
    domain: item.domain,
    purpose: item.purpose,
    status: item.status as WebsiteStatus,
    repositoryUrl: item.repositoryUrl,
    deploymentUrl: item.deploymentUrl,
    notes: item.notes,
    version: item.version,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function createWebsite(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<WebsiteDto>> {
  const parsed = CreateWebsiteInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;

  try {
    const prisma = getPrisma();
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.website.findUnique({
        where: { domain: input.domain },
      });

      if (existing) {
        throw new Error("ALREADY_EXISTS");
      }

      const created = await tx.website.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          name: input.name,
          domain: input.domain,
          purpose: input.purpose,
          status: input.status,
          repositoryUrl: input.repositoryUrl,
          deploymentUrl: input.deploymentUrl,
          notes: input.notes,
          version: 1,
        },
      });

      await createActivityTx(tx, {
        entityType: "WEBSITE",
        entityId: created.id,
        action: "CREATED",
        summary: `Created website: ${created.domain}`,
        source,
        metadata: {
          domain: created.domain,
          status: created.status,
          version: created.version,
        },
      });

      return created;
    });

    return ok(mapWebsiteToDto(result));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "ALREADY_EXISTS") {
      return fail("ALREADY_EXISTS", `Website with domain "${input.domain}" already exists.`);
    }
    return handleServiceError(error);
  }
}

export async function updateWebsite(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<WebsiteDto>> {
  const parsed = UpdateWebsiteInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;

  try {
    const prisma = getPrisma();
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.website.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      if (existing.version !== input.expectedVersion) {
        throw new Error("VERSION_CONFLICT");
      }

      const updateData: Prisma.WebsiteUpdateInput = {
        version: input.expectedVersion + 1,
      };

      if (input.changes.name !== undefined) updateData.name = input.changes.name;
      if (input.changes.purpose !== undefined) updateData.purpose = input.changes.purpose;
      if (input.changes.status !== undefined) updateData.status = input.changes.status;
      if (input.changes.repositoryUrl !== undefined)
        updateData.repositoryUrl = input.changes.repositoryUrl;
      if (input.changes.deploymentUrl !== undefined)
        updateData.deploymentUrl = input.changes.deploymentUrl;
      if (input.changes.notes !== undefined) updateData.notes = input.changes.notes;

      const updateResult = await tx.website.updateMany({
        where: {
          id: input.id,
          version: input.expectedVersion,
        },
        data: updateData,
      });

      if (updateResult.count === 0) {
        throw new Error("VERSION_CONFLICT");
      }

      await createActivityTx(tx, {
        entityType: "WEBSITE",
        entityId: input.id,
        action: "UPDATED",
        summary: `Updated website: ${existing.domain}`,
        source,
        metadata: {
          domain: existing.domain,
          changedFields: Object.keys(input.changes),
          oldVersion: input.expectedVersion,
          newVersion: input.expectedVersion + 1,
        },
      });

      const updated = await tx.website.findUnique({
        where: { id: input.id },
      });

      return updated!;
    });

    return ok(mapWebsiteToDto(result));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "NOT_FOUND") {
      return fail("NOT_FOUND", `Website with ID ${input.id} not found.`);
    }
    if (msg === "VERSION_CONFLICT") {
      return fail(
        "VERSION_CONFLICT",
        `Version conflict on website ${input.id}. Expected version ${input.expectedVersion}.`,
      );
    }
    return handleServiceError(error);
  }
}

export async function getWebsiteById(id: string): Promise<ServiceResult<WebsiteDto>> {
  try {
    const prisma = getPrisma();
    const item = await prisma.website.findUnique({
      where: { id },
    });

    if (!item) {
      return fail("NOT_FOUND", `Website with ID ${id} not found.`);
    }

    return ok(mapWebsiteToDto(item));
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function listWebsites(
  rawQuery: unknown = {},
): Promise<ServiceResult<{ items: WebsiteDto[]; total: number; limit: number; offset: number }>> {
  const parsed = ListWebsitesQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const { limit, offset } = parsed.data;

  try {
    const prisma = getPrisma();
    const [items, total] = await Promise.all([
      prisma.website.findMany({
        orderBy: [{ name: "asc" }, { domain: "asc" }, { id: "asc" }],
        take: limit,
        skip: offset,
      }),
      prisma.website.count(),
    ]);

    return ok({
      items: items.map(mapWebsiteToDto),
      total,
      limit,
      offset,
    });
  } catch (error) {
    return handleServiceError(error);
  }
}
