import "server-only";
import { getPrisma } from "@/lib/prisma";
import { ok, handleServiceError, ServiceResult } from "./results";
import { createActivityTx } from "./activity";
import { getTrustedOrigin } from "../auth/origin";
import {
  mapRepresentationToDto,
  RepresentationDto,
  RepresentationRowLike,
} from "./asset-dtos";
import {
  AddAssetRepresentationInputSchema,
  SetPrimaryAssetRepresentationInputSchema,
  ExternalRepresentationInput,
} from "./asset-schemas";
import type { MutationSource } from "./schemas";
import { mapRevisionServiceError } from "./asset-revisions";
import { Prisma } from "@/app/generated/prisma/client";

/**
 * Asset representation services (upgrade plan section 7 "AssetRepresentation").
 *
 * - Only EXTERNAL_URL representations are creatable through these APIs; BLOB
 *   bytes arrive exclusively through upload links (Phase 5).
 * - The first representation on an empty revision becomes primary; appends to
 *   a revision that already has representations never change the primary.
 * - Adding content to an APPROVED Asset sets NEEDS_WORK; other statuses are
 *   retained. SUPERSEDED rejects appends and primary changes.
 * - Primary switching CAS-updates the parent version, clears the previous
 *   primary of that revision, and selects the new one in one transaction. An
 *   already-primary representation with a current expectedVersion is a no-op:
 *   unchanged version and no Activity.
 */

type Tx = Prisma.TransactionClient;

export interface AppendRepresentationTxParams {
  assetId: string;
  assetStatus: "MISSING" | "DRAFT" | "NEEDS_WORK" | "APPROVED" | "SUPERSEDED";
  revisionId: string;
  input: ExternalRepresentationInput;
  /**
   * legacyAssetId marker: set on the appended representation only when the
   * asset has no marker on an earlier representation (section 2 rule), so a
   * later backfill can never duplicate the reference.
   */
  legacyAssetId: string | null;
  source: MutationSource;
  expectedVersion: number;
}

interface AppendRepresentationTxResult {
  representation: RepresentationRowLike;
  statusAfter: "MISSING" | "DRAFT" | "NEEDS_WORK" | "APPROVED" | "SUPERSEDED";
}

export async function appendExternalRepresentationTx(
  tx: Tx,
  params: AppendRepresentationTxParams,
): Promise<AppendRepresentationTxResult> {
  const existingCount = await tx.assetRepresentation.count({
    where: { assetRevisionId: params.revisionId },
  });

  const representation = await tx.assetRepresentation.create({
    data: {
      assetRevisionId: params.revisionId,
      storageType: "EXTERNAL_URL",
      label: params.input.label ?? null,
      notes: params.input.notes ?? null,
      variant: params.input.variant ?? null,
      format: params.input.format ?? null,
      sourceFilename: params.input.sourceFilename ?? null,
      externalUrl: params.input.externalUrl,
      legacyAssetId: params.legacyAssetId,
      // The first representation on an empty revision becomes primary.
      isPrimary: existingCount === 0,
    },
  });

  // Adding content to an APPROVED Asset sets NEEDS_WORK; other statuses retained.
  const statusAfter = params.assetStatus === "APPROVED" ? "NEEDS_WORK" : params.assetStatus;
  if (statusAfter !== params.assetStatus) {
    await tx.asset.update({
      where: { id: params.assetId },
      data: { status: statusAfter },
    });
  }

  await createActivityTx(tx, {
    entityType: "ASSET",
    entityId: params.assetId,
    action: "ASSET_REPRESENTATION_ADDED",
    summary: "Added external URL representation to revision",
    source: params.source,
    metadata: {
      representationId: representation.id,
      revisionId: params.revisionId,
      storageType: "EXTERNAL_URL",
      isPrimary: representation.isPrimary,
      oldVersion: params.expectedVersion,
      newVersion: params.expectedVersion + 1,
    },
  });

  return { representation, statusAfter };
}

export async function addAssetRepresentation(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<ServiceResult<{ assetId: string; assetVersion: number; representation: RepresentationDto }>> {
  const parsed = AddAssetRepresentationInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;

  try {
    const prisma = getPrisma();
    const trustedOrigin = getTrustedOrigin();

    const result = await prisma.$transaction(async (tx) => {
      const revision = await tx.assetRevision.findUnique({
        where: { id: input.assetRevisionId },
        include: { asset: { select: { id: true, status: true, version: true } } },
      });

      if (!revision) {
        throw new Error("NOT_FOUND");
      }

      const asset = revision.asset;

      if (asset.status === "SUPERSEDED") {
        throw new Error("SUPERSEDED_REJECTED");
      }

      const cas = await tx.asset.updateMany({
        where: { id: asset.id, version: input.expectedVersion },
        data: { version: input.expectedVersion + 1 },
      });
      if (cas.count === 0) {
        throw new Error("VERSION_CONFLICT");
      }

      // The legacy marker moves onto the appended representation only when no
      // earlier representation carries it.
      const marker = await tx.assetRepresentation.findFirst({
        where: { legacyAssetId: asset.id },
        select: { id: true },
      });

      const { representation } = await appendExternalRepresentationTx(tx, {
        assetId: asset.id,
        assetStatus: asset.status,
        revisionId: revision.id,
        input: input.representation,
        legacyAssetId: marker ? null : asset.id,
        source,
        expectedVersion: input.expectedVersion,
      });

      return {
        assetId: asset.id,
        assetVersion: input.expectedVersion + 1,
        representation,
      };
    });

    return ok({
      assetId: result.assetId,
      assetVersion: result.assetVersion,
      representation: mapRepresentationToDto(result.representation, trustedOrigin),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return handleServiceError(new Error("VALIDATION_ERROR"));
    }
    return mapRevisionServiceError(error);
  }
}

export async function setPrimaryAssetRepresentation(
  rawInput: unknown,
  source: MutationSource = "admin",
): Promise<
  ServiceResult<{
    assetId: string;
    assetVersion: number;
    assetRevisionId: string;
    primaryRepresentationId: string;
  }>
> {
  const parsed = SetPrimaryAssetRepresentationInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return handleServiceError(parsed.error);
  }

  const input = parsed.data;

  try {
    const prisma = getPrisma();

    const result = await prisma.$transaction(async (tx) => {
      const representation = await tx.assetRepresentation.findUnique({
        where: { id: input.representationId },
        include: {
          assetRevision: {
            include: { asset: { select: { id: true, status: true, version: true } } },
          },
        },
      });

      if (!representation) {
        throw new Error("NOT_FOUND");
      }

      const asset = representation.assetRevision.asset;

      if (asset.status === "SUPERSEDED") {
        throw new Error("SUPERSEDED_REJECTED");
      }

      // Stale versions still conflict, even for an already-primary target.
      if (asset.version !== input.expectedVersion) {
        throw new Error("VERSION_CONFLICT");
      }

      if (representation.isPrimary) {
        // No-op: unchanged version and no Activity.
        return {
          assetId: asset.id,
          assetVersion: asset.version,
          assetRevisionId: representation.assetRevisionId,
          primaryRepresentationId: representation.id,
        };
      }

      const cas = await tx.asset.updateMany({
        where: { id: asset.id, version: input.expectedVersion },
        data: { version: input.expectedVersion + 1 },
      });
      if (cas.count === 0) {
        throw new Error("VERSION_CONFLICT");
      }

      await tx.assetRepresentation.updateMany({
        where: { assetRevisionId: representation.assetRevisionId, isPrimary: true },
        data: { isPrimary: false },
      });

      await tx.assetRepresentation.update({
        where: { id: representation.id },
        data: { isPrimary: true },
      });

      await createActivityTx(tx, {
        entityType: "ASSET",
        entityId: asset.id,
        action: "ASSET_PRIMARY_CHANGED",
        summary: "Changed primary representation of revision",
        source,
        metadata: {
          representationId: representation.id,
          revisionId: representation.assetRevisionId,
          oldVersion: input.expectedVersion,
          newVersion: input.expectedVersion + 1,
        },
      });

      return {
        assetId: asset.id,
        assetVersion: input.expectedVersion + 1,
        assetRevisionId: representation.assetRevisionId,
        primaryRepresentationId: representation.id,
      };
    });

    return ok(result);
  } catch (error) {
    return mapRevisionServiceError(error, input?.representationId, input?.expectedVersion);
  }
}
