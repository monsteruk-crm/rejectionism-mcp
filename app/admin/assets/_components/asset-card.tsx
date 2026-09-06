import Link from "next/link";
import type { AssetListDto } from "@/lib/campaign";
import { StatusBadge } from "../../_components/badge";

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "";
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

export function AssetCard({ asset }: { asset: AssetListDto }) {
  const primary = asset.primaryRepresentation;
  const isRaster = primary?.storageType === "BLOB" && isRasterMime(primary.mimeType);

  return (
    <div className="flex flex-col justify-between border-2 border-ink bg-paper p-5 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)] transition-transform hover:-translate-y-0.5">
      <div>
        {/* Thumbnail / Format Preview */}
        <div className="relative mb-4 flex h-44 w-full items-center justify-center overflow-hidden border-2 border-ink bg-cream">
          {isRaster && primary?.openUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primary.openUrl}
              alt={asset.name}
              className="h-full w-full object-contain p-2"
              loading="lazy"
            />
          ) : primary?.storageType === "EXTERNAL_URL" ? (
            <div className="flex flex-col items-center justify-center p-4 text-center">
              <span className="font-heading text-2xl font-black text-ink/40">🔗</span>
              <p className="mt-1 font-heading text-xs font-bold uppercase tracking-wider text-ink/70">
                External Resource
              </p>
              <p className="line-clamp-2 mt-1 max-w-xs font-mono text-[10px] text-ink/50 break-all">
                {primary.externalUrl}
              </p>
            </div>
          ) : primary?.storageType === "BLOB" ? (
            <div className="flex flex-col items-center justify-center p-4 text-center">
              <span className="font-heading text-3xl font-black uppercase tracking-tight text-ink/40">
                {primary.format || (primary.mimeType ? primary.mimeType.split("/")[1] : "FILE")}
              </span>
              <p className="mt-1 font-heading text-[10px] font-bold uppercase tracking-wider text-ink/60">
                Private Blob File
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-4 text-center">
              <span className="font-heading text-xs font-bold uppercase tracking-widest text-ink/40">
                Metadata Only
              </span>
              <p className="mt-1 text-[11px] italic text-ink/50">No files attached</p>
            </div>
          )}

          {/* Storage Badges Overlay */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {asset.storageTypes.map((st) => (
              <span
                key={st}
                className={`border px-1.5 py-0.5 font-heading text-[9px] font-bold uppercase tracking-wider ${
                  st === "BLOB"
                    ? "border-ink bg-ink text-cream"
                    : "border-ink bg-cream text-ink"
                }`}
              >
                {st === "BLOB" ? "Blob" : "External"}
              </span>
            ))}
          </div>
        </div>

        {/* Card Header & Metadata */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link
              href={`/admin/assets/${asset.id}`}
              className="font-heading text-base font-black uppercase tracking-tight text-ink hover:text-rejection-red"
            >
              {asset.name}
            </Link>
            <p className="font-mono text-xs uppercase text-ink/60">{asset.kind}</p>
          </div>
          <StatusBadge status={asset.status} />
        </div>

        {/* Primary representation info */}
        <div className="mt-3 space-y-1 border-t border-ink/15 pt-2 font-sans text-xs">
          <p className="text-ink/80">
            <span className="font-bold">Revision:</span>{" "}
            <span className="font-mono">
              v{asset.latestRevisionNumber ?? 1} ({asset.revisionCount} rev{asset.revisionCount !== 1 ? "s" : ""})
            </span>
          </p>

          {primary ? (
            <div className="space-y-0.5 text-ink/70">
              <p className="line-clamp-1 font-mono text-[11px]">
                <span className="font-bold text-ink">Primary:</span>{" "}
                {primary.sourceFilename || primary.label || primary.externalUrl || "Untitled"}
              </p>
              <p className="font-mono text-[10px] text-ink/60">
                {formatBytes(primary.byteSize)}
                {primary.width && primary.height ? ` • ${primary.width}×${primary.height}` : ""}
                {primary.format ? ` • ${primary.format}` : ""}
              </p>
            </div>
          ) : (
            <p className="text-[11px] italic text-ink/50">No primary representation</p>
          )}

          {/* Legacy Warning */}
          {asset.legacyReferenceWarning && (
            <div className="mt-2 border border-blood-red bg-cream p-1.5 font-sans text-[11px] text-blood-red">
              <strong>Warning:</strong> Legacy URL differs from latest primary representation.
            </div>
          )}
        </div>

        {/* Tags */}
        {asset.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {asset.tags.map((slug) => (
              <span
                key={slug}
                className="border border-ink/30 bg-cream px-1.5 py-0.5 font-mono text-[10px] text-ink/80"
              >
                #{slug}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer Action */}
      <div className="mt-4 border-t border-ink/20 pt-3">
        <Link
          href={`/admin/assets/${asset.id}`}
          className="block w-full border border-ink bg-cream py-1.5 text-center font-heading text-xs font-bold uppercase tracking-wider text-ink hover:bg-ink hover:text-cream"
        >
          View Details &rarr;
        </Link>
      </div>
    </div>
  );
}
