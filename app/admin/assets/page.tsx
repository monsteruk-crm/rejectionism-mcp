import Link from "next/link";
import { listAssets, AssetStatus } from "@/lib/campaign";
import { StatusBadge } from "../_components/badge";
import { createAssetAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AssetsListPage(props: {
  searchParams: Promise<{ status?: string; kind?: string }>;
}) {
  const searchParams = await props.searchParams;
  const statusFilter = searchParams.status as AssetStatus | undefined;
  const kindFilter = searchParams.kind;

  const result = await listAssets({
    status: statusFilter,
    kind: kindFilter,
    limit: 100,
  });

  const assets = result.ok ? result.data.items : [];
  const total = result.ok ? result.data.total : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-wider text-rejection-red">
            Visual Propaganda & Deliverables
          </p>
          <h1 className="font-heading text-4xl font-black uppercase tracking-tight">
            Visual Assets ({total})
          </h1>
        </div>
        <Link
          href="/admin"
          className="text-xs font-bold uppercase tracking-wider text-ink/70 hover:text-ink"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 border-2 border-ink bg-paper p-3 font-heading text-xs uppercase">
        <span className="font-bold">Filter Status:</span>
        {[
          { label: "All", value: undefined },
          { label: "Missing", value: "MISSING" },
          { label: "Needs Work", value: "NEEDS_WORK" },
          { label: "Draft", value: "DRAFT" },
          { label: "Approved", value: "APPROVED" },
          { label: "Superseded", value: "SUPERSEDED" },
        ].map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/admin/assets?status=${f.value}` : "/admin/assets"}
            className={`border px-3 py-1 font-bold ${
              statusFilter === f.value || (!statusFilter && !f.value)
                ? "border-ink bg-ink text-cream"
                : "border-ink/30 bg-cream text-ink hover:border-ink"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Assets Table */}
        <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)] lg:col-span-2">
          {assets.length === 0 ? (
            <p className="text-xs italic text-ink/70">No assets match the filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-xs">
                <thead className="border-b-2 border-ink font-heading uppercase text-ink">
                  <tr>
                    <th className="py-2 pr-4">Name / Filename</th>
                    <th className="py-2 pr-2">Kind</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/15">
                  {assets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-cream">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/admin/assets/${asset.id}`}
                          className="font-heading text-sm font-bold text-ink hover:text-rejection-red"
                        >
                          {asset.name}
                        </Link>
                        {asset.sourceFilename && (
                          <p className="font-mono text-[11px] text-ink/60">
                            Source: {asset.sourceFilename}
                          </p>
                        )}
                        {asset.url && (
                          <a
                            href={asset.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-[11px] text-rejection-red underline"
                          >
                            {asset.url}
                          </a>
                        )}
                      </td>
                      <td className="py-3 pr-2 font-mono text-xs uppercase text-ink/70 whitespace-nowrap">
                        {asset.kind}
                      </td>
                      <td className="py-3 pr-2 whitespace-nowrap">
                        <StatusBadge status={asset.status} />
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/assets/${asset.id}`}
                          className="border border-ink bg-cream px-2 py-1 font-heading text-[11px] font-bold uppercase hover:bg-ink hover:text-cream"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Register Asset Form */}
        <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
          <h2 className="border-b-2 border-ink pb-2 font-heading text-xl font-black uppercase">
            Register Asset Metadata
          </h2>

          <form action={createAssetAction} className="mt-4 space-y-4 text-xs font-sans">
            <div>
              <label htmlFor="name" className="block font-heading font-bold uppercase text-ink">
                Asset Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                maxLength={200}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="e.g. Primary Seal Vector Master"
              />
            </div>

            <div>
              <label htmlFor="kind" className="block font-heading font-bold uppercase text-ink">
                Kind *
              </label>
              <input
                type="text"
                id="kind"
                name="kind"
                required
                maxLength={200}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="e.g. logo, banner, poster, artwork"
              />
            </div>

            <div>
              <label htmlFor="status" className="block font-heading font-bold uppercase text-ink">
                Workflow Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue="DRAFT"
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              >
                <option value="MISSING">MISSING</option>
                <option value="DRAFT">DRAFT</option>
                <option value="NEEDS_WORK">NEEDS_WORK</option>
                <option value="APPROVED">APPROVED</option>
                <option value="SUPERSEDED">SUPERSEDED</option>
              </select>
            </div>

            <div>
              <label htmlFor="sourceFilename" className="block font-heading font-bold uppercase text-ink">
                Source Filename
              </label>
              <input
                type="text"
                id="sourceFilename"
                name="sourceFilename"
                maxLength={20000}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="e.g. official logo and slogan.png"
              />
            </div>

            <div>
              <label htmlFor="url" className="block font-heading font-bold uppercase text-ink">
                Asset URL (HTTP/HTTPS)
              </label>
              <input
                type="url"
                id="url"
                name="url"
                maxLength={2048}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="https://example.com/asset.png"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block font-heading font-bold uppercase text-ink">
                Production Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                maxLength={20000}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="Export requirements, resolution, or provenance"
              />
            </div>

            <button
              type="submit"
              className="w-full border-2 border-ink bg-ink py-2 font-heading text-xs font-bold uppercase tracking-widest text-cream hover:bg-rejection-red"
            >
              Register Asset
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
