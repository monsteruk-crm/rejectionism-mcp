import { requireAdminPage } from "@/lib/auth/boundaries";
import Link from "next/link";
import { AdminServiceError } from "../_components/service-error";
import { listAssets, AssetStatus, AssetStorageType } from "@/lib/campaign";
import { AssetCard } from "./_components/asset-card";
import { CreateAssetPanel } from "./_components/create-asset-modals";
import { Pagination } from "../_components/pagination";

export const dynamic = "force-dynamic";

export default async function AssetsListPage(props: {
  searchParams: Promise<{
    status?: string;
    kind?: string;
    search?: string;
    storageType?: string;
    tags?: string;
    offset?: string;
  }>;
}) {
  await requireAdminPage();
  const searchParams = await props.searchParams;
  const statusFilter = searchParams.status as AssetStatus | undefined;
  const kindFilter = searchParams.kind;
  const searchFilter = searchParams.search;
  const storageTypeFilter = searchParams.storageType as AssetStorageType | undefined;
  const tagsFilter = searchParams.tags
    ? searchParams.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : undefined;
  const offset = searchParams.offset ? Math.max(0, parseInt(searchParams.offset, 10) || 0) : 0;

  const result = await listAssets({
    status: statusFilter,
    kind: kindFilter,
    search: searchFilter,
    storageType: storageTypeFilter,
    tags: tagsFilter,
    limit: 25,
    offset,
  });

  const assets = result.ok ? result.data.items : [];
  const total = result.ok ? result.data.total : 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-3 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-wider text-rejection-red">
            Visual Propaganda & Deliverables
          </p>
          <h1 className="font-heading text-4xl font-black uppercase tracking-tight">
            Visual Assets ({result.ok ? total : "Unavailable"})
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/assets/upload"
            className="border-2 border-ink bg-ink px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider text-cream hover:bg-rejection-red"
          >
            Bulk Upload &rarr;
          </Link>
          <Link
            href="/admin/upload-links"
            className="border-2 border-ink bg-cream px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider text-ink hover:bg-paper"
          >
            Upload Links
          </Link>
          <Link
            href="/admin"
            className="text-xs font-bold uppercase tracking-wider text-ink/70 hover:text-ink"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {!result.ok && <AdminServiceError error={result.error} />}

      {/* Search & Filter Controls */}
      <div className="space-y-3 border-2 border-ink bg-paper p-4 font-heading text-xs uppercase">
        {/* Text Search Form */}
        <form method="GET" className="flex flex-wrap items-center gap-2">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          {storageTypeFilter && <input type="hidden" name="storageType" value={storageTypeFilter} />}
          {kindFilter && <input type="hidden" name="kind" value={kindFilter} />}

          <div className="flex flex-1 items-center gap-2">
            <span className="font-bold">Search:</span>
            <input
              type="text"
              name="search"
              defaultValue={searchFilter || ""}
              placeholder="Filter by name, kind, notes, or filename..."
              className="w-full border-2 border-ink bg-cream p-1.5 font-sans text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>

          <button
            type="submit"
            className="border border-ink bg-ink px-4 py-1.5 font-bold text-cream hover:bg-rejection-red"
          >
            Filter
          </button>
          {(searchFilter || statusFilter || storageTypeFilter || kindFilter || tagsFilter) && (
            <Link
              href="/admin/assets"
              className="border border-ink/30 bg-cream px-3 py-1.5 font-bold text-ink hover:border-ink"
            >
              Reset
            </Link>
          )}
        </form>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-4 border-t border-ink/15 pt-3">
          {/* Status Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-ink/70">Status:</span>
            {[
              { label: "All", value: undefined },
              { label: "Missing", value: "MISSING" },
              { label: "Draft", value: "DRAFT" },
              { label: "Needs Work", value: "NEEDS_WORK" },
              { label: "Approved", value: "APPROVED" },
              { label: "Superseded", value: "SUPERSEDED" },
            ].map((f) => {
              const params = new URLSearchParams();
              if (searchFilter) params.set("search", searchFilter);
              if (storageTypeFilter) params.set("storageType", storageTypeFilter);
              if (kindFilter) params.set("kind", kindFilter);
              if (f.value) params.set("status", f.value);
              const href = params.toString() ? `/admin/assets?${params.toString()}` : "/admin/assets";

              return (
                <Link
                  key={f.label}
                  href={href}
                  className={`border px-2.5 py-0.5 font-bold ${
                    statusFilter === f.value || (!statusFilter && !f.value)
                      ? "border-ink bg-ink text-cream"
                      : "border-ink/30 bg-cream text-ink hover:border-ink"
                  }`}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>

          {/* Storage Type Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-ink/70">Storage:</span>
            {[
              { label: "All", value: undefined },
              { label: "Blob Files", value: "BLOB" },
              { label: "External URL", value: "EXTERNAL_URL" },
            ].map((f) => {
              const params = new URLSearchParams();
              if (searchFilter) params.set("search", searchFilter);
              if (statusFilter) params.set("status", statusFilter);
              if (kindFilter) params.set("kind", kindFilter);
              if (f.value) params.set("storageType", f.value);
              const href = params.toString() ? `/admin/assets?${params.toString()}` : "/admin/assets";

              return (
                <Link
                  key={f.label}
                  href={href}
                  className={`border px-2.5 py-0.5 font-bold ${
                    storageTypeFilter === f.value || (!storageTypeFilter && !f.value)
                      ? "border-ink bg-ink text-cream"
                      : "border-ink/30 bg-cream text-ink hover:border-ink"
                  }`}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Asset Grid */}
      <div>
        {!result.ok ? (
          <div className="border-2 border-ink bg-paper p-8 text-center">
            <p className="text-xs font-bold text-rejection-red">Register unavailable.</p>
          </div>
        ) : assets.length === 0 ? (
          <div className="border-2 border-ink bg-paper p-12 text-center">
            <p className="font-heading text-base font-bold uppercase text-ink/70">
              No assets match the active filters.
            </p>
            <p className="mt-1 text-xs text-ink/50">
              Try adjusting your search query or reset the filters above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {assets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        )}

        {result.ok && (
          <div className="mt-6">
            <Pagination
              total={total}
              limit={25}
              offset={offset}
              basePath="/admin/assets"
              searchParams={searchParams}
            />
          </div>
        )}
      </div>

      {/* Create Asset Panel */}
      <CreateAssetPanel />
    </div>
  );
}
