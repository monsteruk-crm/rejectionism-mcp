import "server-only";
import { getPrisma } from "@/lib/prisma";
import { ok, fail, handleServiceError, ServiceResult } from "./results";
import { createActivityTx } from "./activity";
import { generateUploadToken, hashUploadToken } from "./upload-tokens";
import { resolveUploadTargetTx, getEffectiveUploadRequestStatus, mapUploadRequestError } from "./upload-requests";
import type { UploadRequestDto } from "./upload-requests";
import type { MutationSource } from "./schemas";

const MS_PER_DAY = 86_400_000;

export interface CreateAdminUploadSessionInput {
  targetAssetId?: string | null;
  targetRevisionId?: string | null;
}

export interface AdminUploadSessionDto {
  id: string;
  status: "OPEN" | "SUBMITTED" | "REVOKED";
  effectiveStatus: "OPEN" | "SUBMITTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  maxItems: number;
  targetAssetId: string | null;
  targetRevisionId: string | null;
  targetAssetVersion: number | null;
  createdAt: string;
  submittedAt: string | null;
}

function mapSessionToDto(row: any): AdminUploadSessionDto {
  return {
    id: row.id,
    status: row.status,
    effectiveStatus: getEffectiveUploadRequestStatus(row.status, row.expiresAt),
    expiresAt: row.expiresAt.toISOString(),
    maxItems: row.maxItems,
    targetAssetId: row.targetAssetId,
    targetRevisionId: row.targetRevisionId,
    targetAssetVersion: row.targetAssetVersion,
    createdAt: row.createdAt.toISOString(),
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
  };
}

export async function createAdminUploadSession(
  input: CreateAdminUploadSessionInput = {},
  source: MutationSource = "admin",
): Promise<ServiceResult<AdminUploadSessionDto>> {
  try {
    const prisma = getPrisma();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + MS_PER_DAY); // Fixed 24h
    const rawToken = generateUploadToken();
    const tokenHash = await hashUploadToken(rawToken);

    const created = await prisma.$transaction(
      async (tx) => {
        const target = await resolveUploadTargetTx(tx, {
          targetAssetId: input.targetAssetId,
          targetRevisionId: input.targetRevisionId,
        });

        const request = await tx.uploadRequest.create({
          data: {
            tokenHash,
            purpose: "ADMIN_INTERNAL",
            title: "Internal Admin Upload Session",
            instructions: "",
            status: "OPEN",
            expiresAt,
            maxItems: 50,
            targetAssetId: target.targetAssetId,
            targetRevisionId: target.targetRevisionId,
            targetAssetVersion: target.targetAssetVersion,
            createdAt: now,
          },
        });

        await createActivityTx(tx, {
          entityType: "UPLOAD_REQUEST",
          entityId: request.id,
          action: "ADMIN_UPLOAD_SESSION_CREATED",
          summary: "Created internal admin upload session",
          source,
          metadata: {
            targetAssetId: target.targetAssetId,
            targetRevisionId: target.targetRevisionId,
          },
        });

        return request;
      },
      { maxWait: 15000, timeout: 60000 },
    );

    return ok(mapSessionToDto(created));
  } catch (error) {
    return mapUploadRequestError(error);
  }
}

export async function listAdminUploadSessions(query: {
  limit?: number;
  offset?: number;
} = {}): Promise<ServiceResult<{ items: AdminUploadSessionDto[]; total: number; limit: number; offset: number }>> {
  const limit = Math.min(100, Math.max(1, query.limit ?? 25));
  const offset = Math.max(0, query.offset ?? 0);

  try {
    const prisma = getPrisma();
    const where = { purpose: "ADMIN_INTERNAL" as const };

    const [rows, total] = await Promise.all([
      prisma.uploadRequest.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
        skip: offset,
      }),
      prisma.uploadRequest.count({ where }),
    ]);

    return ok({
      items: rows.map(mapSessionToDto),
      total,
      limit,
      offset,
    });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function cancelAdminUploadSession(
  id: string,
  source: MutationSource = "admin",
): Promise<ServiceResult<{ id: string; status: "REVOKED" }>> {
  try {
    const prisma = getPrisma();

    const result = await prisma.$transaction(
      async (tx) => {
        const session = await tx.uploadRequest.findUnique({
          where: { id },
        });

        if (!session) {
          throw new Error("NOT_FOUND");
        }
        if (session.purpose !== "ADMIN_INTERNAL") {
          throw new Error("FORBIDDEN");
        }
        if (session.status === "SUBMITTED") {
          throw new Error("UPLOAD_ALREADY_SUBMITTED");
        }
        if (session.status === "REVOKED") {
          return { id: session.id, status: "REVOKED" as const };
        }

        await tx.uploadRequest.update({
          where: { id },
          data: { status: "REVOKED", revokedAt: new Date() },
        });

        await createActivityTx(tx, {
          entityType: "UPLOAD_REQUEST",
          entityId: id,
          action: "ADMIN_UPLOAD_SESSION_CANCELED",
          summary: "Canceled internal upload session",
          source,
          metadata: null,
        });

        return { id, status: "REVOKED" as const };
      },
      { maxWait: 15000, timeout: 60000 },
    );

    return ok(result);
  } catch (error) {
    return mapUploadRequestError(error, id);
  }
}
