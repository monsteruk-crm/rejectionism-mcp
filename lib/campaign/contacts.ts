import "server-only";
import { getPrisma } from "@/lib/prisma";
import { ok, fail, handleServiceError, ServiceResult } from "./results";
import {
  CreateContactInputSchema,
  UpdateContactInputSchema,
  ListContactsQuerySchema,
  MutationSource,
} from "./schemas";
import { createActivityTx } from "./activity";
import { Prisma } from "@/app/generated/prisma/client";

export interface ContactDto {
  id: string;
  name: string;
  organization: string | null;
  role: string | null;
  email?: string | null;
  status: string;
  notes?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContactSummaryDto {
  id: string;
  name: string;
  organization: string | null;
  role: string | null;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContactDetailDto extends ContactSummaryDto {
  email: string | null;
  notes: string | null;
}

export function mapContactToDto(
  item: {
    id: string;
    name: string;
    organization: string | null;
    role: string | null;
    email: string | null;
    status: string;
    notes: string | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  },
  includePrivateFields: boolean = false,
): ContactDto {
  const summary: ContactSummaryDto = {
    id: item.id,
    name: item.name,
    organization: item.organization,
    role: item.role,
    status: item.status,
    version: item.version,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };

  if (!includePrivateFields) {
    return summary;
  }

  return {
    ...summary,
    email: item.email,
    notes: item.notes,
  };
}

export async function createContact(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<ContactDto>> {
  const parsed = CreateContactInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;

  try {
    const prisma = getPrisma();
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.contact.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          name: input.name,
          organization: input.organization,
          role: input.role,
          email: input.email,
          status: input.status,
          notes: input.notes,
          version: 1,
        },
      });

      await createActivityTx(tx, {
        entityType: "CONTACT",
        entityId: created.id,
        action: "CREATED",
        summary: `Created contact: ${created.name}`,
        source,
        metadata: {
          name: created.name,
          organization: created.organization,
          version: created.version,
        },
      });

      return created;
    });

    return ok(mapContactToDto(result, false));
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function updateContact(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<ContactDto>> {
  const parsed = UpdateContactInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;

  try {
    const prisma = getPrisma();
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.contact.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      if (existing.version !== input.expectedVersion) {
        throw new Error("VERSION_CONFLICT");
      }

      const updateData: Prisma.ContactUpdateInput = {
        version: input.expectedVersion + 1,
      };

      if (input.changes.name !== undefined) updateData.name = input.changes.name;
      if (input.changes.organization !== undefined)
        updateData.organization = input.changes.organization;
      if (input.changes.role !== undefined) updateData.role = input.changes.role;
      if (input.changes.email !== undefined) updateData.email = input.changes.email;
      if (input.changes.status !== undefined) updateData.status = input.changes.status;
      if (input.changes.notes !== undefined) updateData.notes = input.changes.notes;

      const updateResult = await tx.contact.updateMany({
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
        entityType: "CONTACT",
        entityId: input.id,
        action: "UPDATED",
        summary: `Updated contact: ${input.changes.name ?? existing.name}`,
        source,
        metadata: {
          changedFields: Object.keys(input.changes),
          oldVersion: input.expectedVersion,
          newVersion: input.expectedVersion + 1,
        },
      });

      const updated = await tx.contact.findUnique({
        where: { id: input.id },
      });

      return updated!;
    });

    return ok(mapContactToDto(result, false));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "NOT_FOUND") {
      return fail("NOT_FOUND", `Contact with ID ${input.id} not found.`);
    }
    if (msg === "VERSION_CONFLICT") {
      return fail(
        "VERSION_CONFLICT",
        `Version conflict on contact ${input.id}. Expected version ${input.expectedVersion}.`,
      );
    }
    return handleServiceError(error);
  }
}

export async function getContactById(
  id: string,
  includePrivateFields: boolean = false,
): Promise<ServiceResult<ContactDto>> {
  try {
    const prisma = getPrisma();
    const item = await prisma.contact.findUnique({
      where: { id },
    });

    if (!item) {
      return fail("NOT_FOUND", `Contact with ID ${id} not found.`);
    }

    return ok(mapContactToDto(item, includePrivateFields));
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function listContacts(
  rawQuery: unknown = {},
): Promise<ServiceResult<{ items: ContactDto[]; total: number; limit: number; offset: number }>> {
  const parsed = ListContactsQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const { includePrivateFields, limit, offset } = parsed.data;

  try {
    const prisma = getPrisma();
    const [items, total] = await Promise.all([
      prisma.contact.findMany({
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: limit,
        skip: offset,
      }),
      prisma.contact.count(),
    ]);

    return ok({
      items: items.map((item) => mapContactToDto(item, includePrivateFields)),
      total,
      limit,
      offset,
    });
  } catch (error) {
    return handleServiceError(error);
  }
}
