import type { AssetDto } from "./assets";
import type { TagDto } from "./tag-schemas";
import type { RelationDto } from "./relation-schemas";

/**
 * DTO mappings for the focused asset APIs (upgrade plan section 4 "Common
 * DTOs"). Pure module: trusted origin is injected by the caller so browser-safe
 * code can reuse the shapes in later phases.
 *
 * Nulls are explicit. BigInt byteSize converts to a JSON number only when the
 * value is a safe integer; otherwise it is reported as null rather than
 * losing precision. BLOB open/download URLs are absolute authenticated
 * application file-route URLs built from the trusted origin; EXTERNAL_URL uses
 * the external URL for openUrl and has no download route.
 */

export type RepresentationStorageType = "BLOB" | "EXTERNAL_URL";

export interface RepresentationDto {
  id: string;
  assetRevisionId: string;
  storageType: RepresentationStorageType;
  label: string | null;
  notes: string | null;
  variant: string | null;
  format: string | null;
  sourceFilename: string | null;
  mimeType: string | null;
  byteSize: number | null;
  width: number | null;
  height: number | null;
  checksumSha256: string | null;
  blobUrl: string | null;
  blobPathname: string | null;
  externalUrl: string | null;
  isPrimary: boolean;
  createdAt: string;
  openUrl: string | null;
  downloadUrl: string | null;
}

export interface RevisionDto {
  id: string;
  assetId: string;
  revisionNumber: number;
  label: string | null;
  notes: string | null;
  createdAt: string;
  representations: RepresentationDto[];
}

export interface AssetDetailDto extends AssetDto {
  revisions: RevisionDto[];
  latestRevisionNumber: number | null;
  primaryRepresentationId: string | null;
  tags: TagDto[];
  relationships: RelationDto[];
  legacyReferenceWarning: boolean;
}

export interface AssetListDto extends AssetDto {
  revisionCount: number;
  latestRevisionNumber: number | null;
  primaryRepresentation: RepresentationDto | null;
  storageTypes: RepresentationStorageType[];
  /** Sorted tag slugs attached to the asset. */
  tags: string[];
  legacyReferenceWarning: boolean;
}

/** Minimal structural shape of an AssetRepresentation row for mapping. */
export interface RepresentationRowLike {
  id: string;
  assetRevisionId: string;
  storageType: string;
  label: string | null;
  notes: string | null;
  variant: string | null;
  format: string | null;
  sourceFilename: string | null;
  mimeType: string | null;
  byteSize: bigint | null;
  width: number | null;
  height: number | null;
  checksumSha256: string | null;
  blobUrl: string | null;
  blobPathname: string | null;
  externalUrl: string | null;
  isPrimary: boolean;
  createdAt: Date;
}

/** Minimal structural shape of an AssetRevision row for mapping. */
export interface RevisionRowLike {
  id: string;
  assetId: string;
  revisionNumber: number;
  label: string | null;
  notes: string | null;
  createdAt: Date;
  representations: RepresentationRowLike[];
}

function bigIntToSafeNumber(value: bigint | null): number | null {
  if (value === null) {
    return null;
  }
  const converted = Number(value);
  return Number.isSafeInteger(converted) ? converted : null;
}

export function mapRepresentationToDto(
  representation: RepresentationRowLike,
  trustedOrigin: string | null,
): RepresentationDto {
  const storageType = representation.storageType as RepresentationStorageType;

  let openUrl: string | null = null;
  let downloadUrl: string | null = null;
  if (storageType === "EXTERNAL_URL") {
    openUrl = representation.externalUrl;
  } else if (trustedOrigin !== null) {
    const fileRoute = `${trustedOrigin}/api/assets/representations/${representation.id}/file`;
    openUrl = fileRoute;
    downloadUrl = `${fileRoute}?download=1`;
  }

  return {
    id: representation.id,
    assetRevisionId: representation.assetRevisionId,
    storageType,
    label: representation.label,
    notes: representation.notes,
    variant: representation.variant,
    format: representation.format,
    sourceFilename: representation.sourceFilename,
    mimeType: representation.mimeType,
    byteSize: bigIntToSafeNumber(representation.byteSize),
    width: representation.width,
    height: representation.height,
    checksumSha256: representation.checksumSha256,
    blobUrl: representation.blobUrl,
    blobPathname: representation.blobPathname,
    externalUrl: representation.externalUrl,
    isPrimary: representation.isPrimary,
    createdAt: representation.createdAt.toISOString(),
    openUrl,
    downloadUrl,
  };
}

export function mapRevisionToDto(
  revision: RevisionRowLike,
  trustedOrigin: string | null,
): RevisionDto {
  // Representations sort createdAt ascending then id ascending.
  const representations = [...revision.representations]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((representation) => mapRepresentationToDto(representation, trustedOrigin));

  return {
    id: revision.id,
    assetId: revision.assetId,
    revisionNumber: revision.revisionNumber,
    label: revision.label,
    notes: revision.notes,
    createdAt: revision.createdAt.toISOString(),
    representations,
  };
}

/**
 * The legacy URL column is historical compatibility metadata. The warning
 * flags the case where the legacy URL and the latest primary pointer are two
 * different URLs, so they are never presented as competing primary pointers.
 */
export function computeLegacyReferenceWarning(
  legacyUrl: string | null,
  primaryExternalUrl: string | null,
): boolean {
  if (legacyUrl === null || legacyUrl.trim().length === 0) {
    return false;
  }
  return primaryExternalUrl !== null && primaryExternalUrl !== legacyUrl;
}

export function mapAssetDetailToDto(
  asset: {
    id: string;
    name: string;
    kind: string;
    status: string;
    sourceFilename: string | null;
    url: string | null;
    notes: string | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    revisions: RevisionRowLike[];
  },
  trustedOrigin: string | null,
  projections: {
    tags: TagDto[];
    relationships: RelationDto[];
  },
): AssetDetailDto {
  // Revisions sort revisionNumber descending.
  const revisions = [...asset.revisions]
    .sort((a, b) => b.revisionNumber - a.revisionNumber)
    .map((revision) => mapRevisionToDto(revision, trustedOrigin));

  const latestRevision = revisions[0] ?? null;
  const latestRevisionNumber = latestRevision?.revisionNumber ?? null;
  const primary = latestRevision?.representations.find((representation) => representation.isPrimary) ?? null;

  return {
    id: asset.id,
    name: asset.name,
    kind: asset.kind,
    status: asset.status as AssetDto["status"],
    sourceFilename: asset.sourceFilename,
    url: asset.url,
    notes: asset.notes,
    version: asset.version,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    revisions,
    latestRevisionNumber,
    primaryRepresentationId: primary?.id ?? null,
    tags: projections.tags,
    relationships: projections.relationships,
    legacyReferenceWarning: computeLegacyReferenceWarning(asset.url, primary?.externalUrl ?? null),
  };
}
