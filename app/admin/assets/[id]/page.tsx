import { requireAdminPage } from "@/lib/auth/boundaries";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminServiceError } from "../../_components/service-error";
import { getAssetById, listActivity } from "@/lib/campaign";
import { StatusBadge } from "../../_components/badge";
import { EntityConnections } from "../../_components/entity-connections";
import {
  AssetMetadataForm,
  AssetStatusForm,
  CreateRevisionForm,
  AddRepresentationForm,
  SetPrimaryButton,
} from "../_components/asset-detail-forms";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isRasterMime(mime: string | null): boolean {
  if (!mime) return false;
  return (
    mime === "image/png" ||
    mime === "image/jpeg" ||
    mime === "image/gif" ||
    mime === "image/webp"
  );
}

export default async function EditAssetPage(props: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const params = await props.params;
  const result = await getAssetById(params.id);

  if (!result.ok) {
    if (result.error.code === "NOT_FOUND") {
      notFound();
    }

    return <AdminServiceError error={result.error} />;
  }

  const asset = result.data;

  // Load audit activities for this asset
  const activityRes = await listActivity({ entityType: "ASSET", limit: 30 });
  const activities = activityRes.ok
    ? (activityRes.data.items as Array<{
        id: string;
        entityId: string;
        action: string;
        summary: string;
        createdAt: Date;
        metadata: any;
      }>).filter((a) => a.entityId === asset.id)
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-wider text-rejection-red">
            Visual Asset // ID: {asset.id}
          </p>
          <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
            {asset.name}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/admin/assets/upload"
            className="border-2 border-ink bg-ink px-3 py-1.5 font-heading text-xs font-bold uppercase text-cream hover:bg-rejection-red"
          >
            Upload Files &rarr;
          </Link>
          <Link
            href="/admin/assets"
            className="text-xs font-bold uppercase tracking-wider text-ink/70 hover:text-ink"
          >
            &larr; All Assets
          </Link>
        </div>
      </div>

      {/* Legacy Reference Warning Banner */}
      {asset.legacyReferenceWarning && (
        <div className="border-2 border-blood-red bg-paper p-4 font-sans text-xs text-ink shadow-[4px_4px_0px_0px_rgba(200,16,46,1)]">
          <p className="font-heading font-black uppercase text-blood-red">
            Legacy Reference Discrepancy
          </p>
          <p className="mt-1 text-ink/80">
            This asset has a legacy URL reference that differs from the primary representation of
            the latest revision. The legacy URL is preserved below for provenance and will never
            silently override your verified files.
          </p>
        </div>
      )}

      {/* Top Grid: Status & Metadata */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Workflow Status Box */}
        <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
          <div className="mb-4 flex items-center justify-between border-b border-ink/20 pb-2">
            <span className="font-heading text-xs font-bold uppercase text-ink/60">
              Workflow Status
            </span>
            <span className="font-mono text-xs text-ink/70">v{asset.version}</span>
          </div>

          <div className="mb-4 flex items-center gap-2">
            <StatusBadge status={asset.status} />
            <span className="font-mono text-xs uppercase text-ink/70">{asset.kind}</span>
          </div>

          <AssetStatusForm
            id={asset.id}
            version={asset.version}
            currentStatus={asset.status}
          />
        </div>

        {/* Metadata Editing Box */}
        <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)] lg:col-span-2">
          <h2 className="border-b-2 border-ink pb-2 font-heading text-xl font-black uppercase">
            Asset Metadata
          </h2>
          <div className="mt-4">
            <AssetMetadataForm
              id={asset.id}
              version={asset.version}
              name={asset.name}
              kind={asset.kind}
              notes={asset.notes}
            />
          </div>
        </div>
      </div>

      {/* Revisions & Representations Section */}
      <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
        <div className="flex flex-col gap-2 border-b-2 border-ink pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-2xl font-black uppercase">
              Revisions & Deliverables ({asset.revisions.length})
            </h2>
            <p className="font-sans text-xs text-ink/70">
              Append-only revision history with verified file representations.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {asset.revisions.map((rev) => (
            <div
              key={rev.id}
              className="border-2 border-ink bg-cream p-5 shadow-[2px_2px_0px_0px_rgba(13,13,13,1)]"
            >
              {/* Revision Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/20 pb-3">
                <div className="flex items-center gap-3">
                  <span className="border-2 border-ink bg-ink px-2.5 py-1 font-heading text-xs font-black uppercase text-cream">
                    Revision {rev.revisionNumber}
                  </span>
                  {rev.label && (
                    <span className="font-heading text-sm font-bold text-ink">{rev.label}</span>
                  )}
                </div>
                <span className="font-mono text-xs text-ink/60">
                  Created {new Date(rev.createdAt).toLocaleString()}
                </span>
              </div>

              {rev.notes && (
                <p className="mt-2 text-xs italic text-ink/70">{rev.notes}</p>
              )}

              {/* Representations under this revision */}
              <div className="mt-4 space-y-3">
                <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-ink/60">
                  Representations ({rev.representations.length})
                </h4>

                {rev.representations.length === 0 ? (
                  <p className="rounded border border-dashed border-ink/30 p-3 text-xs italic text-ink/60">
                    No representations attached to this revision yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {rev.representations.map((rep) => {
                      const isRaster = rep.storageType === "BLOB" && isRasterMime(rep.mimeType);

                      return (
                        <div
                          key={rep.id}
                          className="flex flex-col gap-4 border border-ink/30 bg-paper p-4 sm:flex-row sm:items-start"
                        >
                          {/* Mini Preview / Icon */}
                          <div className="flex h-20 w-20 shrink-0 items-center justify-center border border-ink bg-cream overflow-hidden">
                            {isRaster && rep.openUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={rep.openUrl}
                                alt={rep.sourceFilename || "Preview"}
                                className="h-full w-full object-contain"
                              />
                            ) : rep.storageType === "EXTERNAL_URL" ? (
                              <span className="font-heading text-xl font-black text-ink/40">🔗</span>
                            ) : (
                              <span className="font-heading text-xs font-black uppercase text-ink/50">
                                {rep.format || "BLOB"}
                              </span>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 space-y-1 font-sans text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`border px-2 py-0.5 font-heading text-[10px] font-bold uppercase ${
                                  rep.storageType === "BLOB"
                                    ? "border-ink bg-ink text-cream"
                                    : "border-ink bg-cream text-ink"
                                }`}
                              >
                                {rep.storageType === "BLOB" ? "Blob Storage" : "External URL"}
                              </span>

                              {rep.isPrimary ? (
                                <span className="border border-blood-red bg-blood-red px-2 py-0.5 font-heading text-[10px] font-bold uppercase text-cream">
                                  ★ Primary
                                </span>
                              ) : (
                                <SetPrimaryButton
                                  assetId={asset.id}
                                  representationId={rep.id}
                                  version={asset.version}
                                />
                              )}
                            </div>

                            <p className="font-heading text-sm font-bold text-ink">
                              {rep.label || rep.sourceFilename || rep.externalUrl || "Untitled representation"}
                            </p>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] text-ink/70 sm:grid-cols-4">
                              {rep.sourceFilename && (
                                <p className="col-span-2">
                                  <span className="font-bold">File:</span> {rep.sourceFilename}
                                </p>
                              )}
                              {rep.byteSize !== null && (
                                <p>
                                  <span className="font-bold">Size:</span> {formatBytes(rep.byteSize)}
                                </p>
                              )}
                              {rep.width && rep.height && (
                                <p>
                                  <span className="font-bold">Dim:</span> {rep.width}×{rep.height}
                                </p>
                              )}
                              {rep.format && (
                                <p>
                                  <span className="font-bold">Format:</span> {rep.format}
                                </p>
                              )}
                              {rep.variant && (
                                <p>
                                  <span className="font-bold">Variant:</span> {rep.variant}
                                </p>
                              )}
                              {rep.mimeType && (
                                <p className="col-span-2">
                                  <span className="font-bold">MIME:</span> {rep.mimeType}
                                </p>
                              )}
                              {rep.checksumSha256 && (
                                <p className="col-span-2 line-clamp-1">
                                  <span className="font-bold">SHA-256:</span> {rep.checksumSha256}
                                </p>
                              )}
                            </div>

                            {rep.notes && (
                              <p className="mt-1 text-ink/80">{rep.notes}</p>
                            )}

                            {/* Actions */}
                            <div className="flex flex-wrap items-center gap-3 pt-2 font-heading text-xs uppercase">
                              {rep.openUrl && (
                                <a
                                  href={rep.openUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="border border-ink bg-cream px-3 py-1 font-bold text-ink hover:bg-ink hover:text-cream"
                                >
                                  Open Resource &rarr;
                                </a>
                              )}
                              {rep.downloadUrl && (
                                <a
                                  href={rep.downloadUrl}
                                  download
                                  className="border border-ink bg-cream px-3 py-1 font-bold text-ink hover:bg-ink hover:text-cream"
                                >
                                  Download File
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Append form */}
                <AddRepresentationForm
                  assetId={asset.id}
                  revisionId={rev.id}
                  version={asset.version}
                />
              </div>
            </div>
          ))}

          {/* New Revision Form */}
          <CreateRevisionForm assetId={asset.id} version={asset.version} />
        </div>
      </div>

      {/* Legacy Reference Panel */}
      {(asset.sourceFilename || asset.url) && (
        <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
          <h3 className="border-b border-ink/20 pb-2 font-heading text-lg font-black uppercase text-ink">
            Legacy Compatibility Data
          </h3>
          <div className="mt-3 space-y-2 font-sans text-xs">
            {asset.sourceFilename && (
              <p>
                <span className="font-bold">Legacy Source Filename:</span>{" "}
                <span className="font-mono">{asset.sourceFilename}</span>
              </p>
            )}
            {asset.url && (
              <div>
                <span className="font-bold">Legacy URL String:</span>
                <p className="mt-0.5 font-mono text-[11px] text-ink/80 break-all">{asset.url}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tags & Relationships */}
      <EntityConnections
        entityType="ASSET"
        entityId={asset.id}
        tags={asset.tags}
        relationships={asset.relationships}
        currentHref={`/admin/assets/${asset.id}`}
      />

      {/* Audit Activity */}
      {activities.length > 0 && (
        <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
          <h3 className="border-b border-ink/20 pb-2 font-heading text-lg font-black uppercase">
            Audit Activity
          </h3>
          <ul className="mt-3 divide-y divide-ink/15 font-sans text-xs">
            {activities.map((act) => (
              <li key={act.id} className="flex items-center justify-between py-2">
                <div>
                  <span className="font-heading font-bold uppercase">{act.action}:</span>{" "}
                  <span className="text-ink/80">{act.summary}</span>
                </div>
                <span className="font-mono text-[10px] text-ink/50">
                  {new Date(act.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
