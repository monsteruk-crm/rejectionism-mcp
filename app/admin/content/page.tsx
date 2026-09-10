import { requireAdminPage } from "@/lib/auth/boundaries";
import Link from "next/link";
import { AdminServiceError } from "../_components/service-error";
import { listContentItems } from "@/lib/campaign";
import { StatusBadge } from "../_components/badge";
import { CreateContentForm } from "../_components/forms/content-form";
import { Pagination } from "../_components/pagination";

export const dynamic = "force-dynamic";

export default async function ContentListPage(props: {
  searchParams: Promise<{ status?: string; offset?: string }>;
}) {
  await requireAdminPage();
  const searchParams = await props.searchParams;
  const statusFilter = searchParams.status;
  const offset = searchParams.offset ? Math.max(0, parseInt(searchParams.offset, 10) || 0) : 0;

  const result = await listContentItems({
    status: statusFilter,
    limit: 25,
    offset,
  });

  const items = result.ok ? result.data.items : [];
  const total = result.ok ? result.data.total : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-wider text-rejection-red">
            Broadcast & Media
          </p>
          <h1 className="font-heading text-4xl font-black uppercase tracking-tight">
            Campaign Content ({result.ok ? total : "Unavailable"})
          </h1>
        </div>
        <Link
          href="/admin"
          className="text-xs font-bold uppercase tracking-wider text-ink/70 hover:text-ink"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      {!result.ok && <AdminServiceError error={result.error} />}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 border-2 border-ink bg-paper p-3 font-heading text-xs uppercase">
        <span className="font-bold">Filter Status:</span>
        {[
          { label: "All", value: undefined },
          { label: "Draft", value: "DRAFT" },
          { label: "Scheduled", value: "SCHEDULED" },
          { label: "Published", value: "PUBLISHED" },
        ].map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/admin/content?status=${f.value}` : "/admin/content"}
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
        {/* Content Table */}
        <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)] lg:col-span-2">
          {!result.ok ? (
            <p className="text-xs font-bold text-rejection-red">Register unavailable.</p>
          ) : items.length === 0 ? (
            <p className="text-xs italic text-ink/70">No content items match the filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-xs">
                <thead className="border-b-2 border-ink font-heading uppercase text-ink">
                  <tr>
                    <th className="py-2 pr-4">Title</th>
                    <th className="py-2 pr-2">Format / Channel</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/15">
                  {items.map((content) => (
                    <tr key={content.id} className="hover:bg-cream">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/admin/content/${content.id}`}
                          className="font-heading text-sm font-bold text-ink hover:text-rejection-red"
                        >
                          {content.title}
                        </Link>
                        {content.publishedUrl && (
                          <a
                            href={content.publishedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block font-mono text-[11px] text-rejection-red underline"
                          >
                            {content.publishedUrl}
                          </a>
                        )}
                        {content.scheduledFor && (
                          <p className="font-mono text-[11px] text-ink/60">
                            Scheduled: {new Date(content.scheduledFor).toLocaleDateString()}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-2 font-mono text-xs text-ink/70 whitespace-nowrap">
                        {content.format}
                        {" // "}
                        {content.channel}
                      </td>
                      <td className="py-3 pr-2 whitespace-nowrap">
                        <StatusBadge status={content.status} />
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/content/${content.id}`}
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

          {result.ok && (
            <div className="mt-4 border-t border-ink/20 pt-4">
              <Pagination
                total={total}
                limit={25}
                offset={offset}
                basePath="/admin/content"
                searchParams={searchParams}
              />
            </div>
          )}
        </div>

        {/* Create Content Item Form */}
        <CreateContentForm />
      </div>
    </div>
  );
}
