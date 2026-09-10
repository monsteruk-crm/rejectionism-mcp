import { requireAdminPage } from "@/lib/auth/boundaries";
import Link from "next/link";
import { AdminServiceError } from "../_components/service-error";
import { listUploadRequests } from "@/lib/campaign";
import { StatusBadge } from "../_components/badge";
import { UploadRequestForm } from "./_components/upload-request-form";
import { Pagination } from "../_components/pagination";

export const dynamic = "force-dynamic";

export default async function UploadLinksListPage(props: {
  searchParams: Promise<{ status?: string; targetAssetId?: string; offset?: string }>;
}) {
  await requireAdminPage();
  const searchParams = await props.searchParams;
  const statusFilter = searchParams.status;
  const targetAssetIdFilter = searchParams.targetAssetId;
  const offset = searchParams.offset ? Math.max(0, parseInt(searchParams.offset, 10) || 0) : 0;

  const result = await listUploadRequests({
    status: statusFilter as any,
    targetAssetId: targetAssetIdFilter,
    limit: 25,
    offset,
  });

  const requests = result.ok ? result.data.items : [];
  const total = result.ok ? result.data.total : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-wider text-rejection-red">
            Capability Tokens & Contributor Ingestion
          </p>
          <h1 className="font-heading text-4xl font-black uppercase tracking-tight">
            Upload Links ({result.ok ? total : "Unavailable"})
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/admin/assets"
            className="text-xs font-bold uppercase tracking-wider text-ink/70 hover:text-ink"
          >
            &larr; Asset Library
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

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 border-2 border-ink bg-paper p-3 font-heading text-xs uppercase">
        <span className="font-bold">Filter Status:</span>
        {[
          { label: "All", value: undefined },
          { label: "Open", value: "OPEN" },
          { label: "Submitted", value: "SUBMITTED" },
          { label: "Revoked", value: "REVOKED" },
          { label: "Expired", value: "EXPIRED" },
        ].map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/admin/upload-links?status=${f.value}` : "/admin/upload-links"}
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
        {/* Upload Links Table */}
        <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)] lg:col-span-2">
          {!result.ok ? (
            <p className="text-xs font-bold text-rejection-red">Register unavailable.</p>
          ) : requests.length === 0 ? (
            <p className="text-xs italic text-ink/70">No upload links match the filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-xs">
                <thead className="border-b-2 border-ink font-heading uppercase text-ink">
                  <tr>
                    <th className="py-2 pr-4">Request Title</th>
                    <th className="py-2 pr-2">Effective Status</th>
                    <th className="py-2 pr-2">Target</th>
                    <th className="py-2 pr-2">Expires</th>
                    <th className="py-2 pr-2">Items</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/15">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-cream">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/admin/upload-links/${req.id}`}
                          className="font-heading text-sm font-bold text-ink hover:text-rejection-red"
                        >
                          {req.title}
                        </Link>
                        {req.instructions && (
                          <p className="line-clamp-1 font-sans text-[11px] text-ink/60">
                            {req.instructions}
                          </p>
                        )}
                        <p className="font-mono text-[10px] text-ink/40">
                          Created: {new Date(req.createdAt).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="py-3 pr-2 whitespace-nowrap">
                        <StatusBadge status={req.effectiveStatus} />
                      </td>
                      <td className="py-3 pr-2 font-mono text-[11px] text-ink/80 whitespace-nowrap">
                        {req.targetRevisionId ? (
                          <span>Rev: {req.targetRevisionId.slice(0, 10)}...</span>
                        ) : req.targetAssetId ? (
                          <Link
                            href={`/admin/assets/${req.targetAssetId}`}
                            className="text-rejection-red underline hover:text-ink"
                          >
                            Asset: {req.targetAssetId.slice(0, 10)}...
                          </Link>
                        ) : (
                          <span className="text-ink/50">New Assets</span>
                        )}
                      </td>
                      <td className="py-3 pr-2 font-mono text-[11px] text-ink/70 whitespace-nowrap">
                        {new Date(req.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 pr-2 font-mono text-xs whitespace-nowrap">
                        {req.itemCount !== null ? (
                          <span className="font-bold text-ink">{req.itemCount} submitted</span>
                        ) : (
                          <span className="text-ink/60">Max {req.maxItems}</span>
                        )}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/upload-links/${req.id}`}
                          className="border border-ink bg-cream px-2 py-1 font-heading text-[11px] font-bold uppercase hover:bg-ink hover:text-cream"
                        >
                          View &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.ok && (
            <div className="mt-4 border-t border-ink/20 pt-4">
              <Pagination
                total={total}
                limit={25}
                offset={offset}
                basePath="/admin/upload-links"
                searchParams={searchParams}
              />
            </div>
          )}
        </div>

        {/* Create Link Form */}
        <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
          <h2 className="border-b-2 border-ink pb-2 font-heading text-xl font-black uppercase">
            Create Upload Link
          </h2>
          <div className="mt-4">
            <UploadRequestForm initialTargetAssetId={targetAssetIdFilter} />
          </div>
        </div>
      </div>
    </div>
  );
}
