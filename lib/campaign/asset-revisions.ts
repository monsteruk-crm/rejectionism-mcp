import "server-only";
import { getPrisma } from "@/lib/prisma";
import { ok, fail, handleServiceError, ServiceResult } from "./results";
import { createActivityTx } from "./activity";
import { getTrustedOrigin } from "../auth/origin";
import { mapRevisionToDto, RevisionDto } from "./asset-dtos";
import { CreateAssetRevisionInputSchema } from "./asset-schemas";
import type { MutationSource } from "./schemas";
import { Prisma } from "@/app/generated/prisma/client";

/**
 * Asset revision services (upgrade plan section 7 "AssetRevision").
 *
 * - The parent Asset row is CAS-updated ({id, version: expectedVersion}) BEFORE
 *   any child write; the next revision number is computed only after that
 *   update succeeds, which serializes concurrent writers.
 * - Revisions are immutable and never renumbered or reused.
 * - Creating an empty revision sets the conceptual Asset status to DRAFT when
 *   previously MISSING, APPROVED, or DRAFT; NEEDS_WORK remains NEEDS_WORK.
 * - SUPERSEDED Assets reject new revisions until an explicit status update
 *   restores them.
 *
 * Transaction helpers accept Prisma.TransactionClient so compound operations
 * (e.g. the legacy-URL update) can compose them without nested transactions.
 */

type Tx = Prisma.TransactionClient;

interface CreateRevisionTxParams {
  assetId: string;
  label: string | null;
  notes: string | null;
  assetStatus: "MISSING" | "DRAFT" | "NEEDS_WORK" | "APPROVED" | "SUPERSEDED";
  source: MutationSource;
  expectedVersion: number;
}

interface CreateRevisionTxResult {
  revision: {
    id: string;
    assetId: string;
    revisionNumber: number;
    label: string | null;
    notes: string | null;
    createdAt: Date;
    representations: never[];
  };
  statusAfter: "MISSING" | "DRAFT" | "NEEDS_WORK" | "APPROVED" | "SUPERSEDED";
}

export async function nextRevisionNumberTx(tx: Tx, assetId: string): Promise<number> {
  const aggregate = await tx.assetRevision.aggregate({
    _max: { revisionNumber: true },
    where: { assetId },
  });
  return (aggregate._max.revisionNumber ?? 0) + 1;
}

export async function createRevisionTx(
  tx: Tx,
  params: CreateRevisionTxParams,
): Promise<CreateRevisionTxResult> {
  const revisionNumber = await nextRevisionNumberTx(tx, params.assetId);

  const created = await tx.assetRevision.create({
    data: {
      assetId: params.assetId,
      revisionNumber,
      label: params.label,
      notes: params.notes,
    },
  });

  // Empty new revision: DRAFT when previously MISSING, APPROVED, or DRAFT;
  // NEEDS_WORK remains NEEDS_WORK. SUPERSEDED never reaches this helper.
  const statusAfter =
    params.assetStatus === "NEEDS_WORK" ? "NEEDS_WORK" : "DRAFT";

  if (statusAfter !== params.assetStatus) {
    await tx.asset.update({
      where: { id: params.assetId },
      data: { status: statusAfter },
    });
  }

  await createActivityTx(tx, {
    entityType: "ASSET",
    entityId: params.assetId,
    action: "ASSET_REVISION_CREATED",
    summary: `Created revision ${revisionNumber} for asset`,
    source: params.source,
    metadata: {
      revisionId: created.id,
      revisionNumber,
      oldVersion: params.expectedVersion,
      newVersion: params.expectedVersion + 1,
    },
  });

  return {
    revision: { ...created, representations: [] },
    statusAfter,
  };
}

export async function createAssetRevision(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<{ assetId: string; assetVersion: number; revision: RevisionDto }>> {
  const parsed = CreateAssetRevisionInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;

  try {
    const prisma = getPrisma();
    const trustedOrigin = getTrustedOrigin();

    const result = await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({
        where: { id: input.assetId },
        select: { id: true, status: true, version: true },
      });

      if (!asset) {
        throw new Error("NOT_FOUND");
      }

      if (asset.status === "SUPERSEDED") {
        throw new Error("SUPERSEDED_REJECTED");
      }

      // Serialize writers on the parent Asset before computing the number.
      const cas = await tx.asset.updateMany({
        where: { id: asset.id, version: input.expectedVersion },
        data: { version: input.expectedVersion + 1 },
      });
      if (cas.count === 0) {
        throw new Error("VERSION_CONFLICT");
      }

      const { revision } = await createRevisionTx(tx, {
        assetId: asset.id,
        label: input.label ?? null,
        notes: input.notes ?? null,
        assetStatus: asset.status,
        source,
        expectedVersion: input.expectedVersion,
      });

      return { assetId: asset.id, assetVersion: input.expectedVersion + 1, revision };
    });

    return ok({
      assetId: result.assetId,
      assetVersion: result.assetVersion,
      revision: mapRevisionToDto(result.revision, trustedOrigin),
    });
  } catch (error) {
    return mapRevisionServiceError(error, input?.assetId, input?.expectedVersion);
  }
}

export function mapRevisionServiceError(
  error: unknown,
  assetId?: string,
  expectedVersion?: number,
): ServiceResult<never> {
  const message = error instanceof Error ? error.message : "";

  if (message === "NOT_FOUND") {
    return fail("NOT_FOUND", `Asset ${assetId ?? ""} not found.`.trim());
  }
  if (message === "VERSION_CONFLICT") {
    return fail(
      "VERSION_CONFLICT",
      `Version conflict on asset ${assetId ?? ""}. Expected version ${expectedVersion ?? "?"}.`,
    );
  }
  if (message === "SUPERSEDED_REJECTED") {
    return fail(
      "VALIDATION_ERROR",
      "Asset is SUPERSEDED; content changes are rejected until an explicit status update restores it.",
    );
  }
  return handleServiceError(error);
}

