import Link from "next/link";
import { listContentItems, ContentStatus } from "@/lib/campaign";
import { StatusBadge } from "../_components/badge";
import { createContentItemAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ContentListPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const searchParams = await props.searchParams;
  const statusFilter = searchParams.status as ContentStatus | undefined;

  const result = await listContentItems({
    status: statusFilter,
    limit: 100,
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
            Campaign Content ({total})
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
          {items.length === 0 ? (
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
                        {content.format} // {content.channel}
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
        </div>

        {/* Create Content Item Form */}
        <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
          <h2 className="border-b-2 border-ink pb-2 font-heading text-xl font-black uppercase">
            Create Content Piece
          </h2>

          <form action={createContentItemAction} className="mt-4 space-y-4 text-xs font-sans">
            <div>
              <label htmlFor="title" className="block font-heading font-bold uppercase text-ink">
                Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                maxLength={200}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="e.g. Ministry Decree #01"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="format" className="block font-heading font-bold uppercase text-ink">
                  Format *
                </label>
                <input
                  type="text"
                  id="format"
                  name="format"
                  required
                  maxLength={200}
                  className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                  placeholder="e.g. decree, comic, story"
                />
              </div>

              <div>
                <label htmlFor="channel" className="block font-heading font-bold uppercase text-ink">
                  Channel *
                </label>
                <input
                  type="text"
                  id="channel"
                  name="channel"
                  required
                  maxLength={200}
                  className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                  placeholder="e.g. web, facebook, press"
                />
              </div>
            </div>

            <div>
              <label htmlFor="status" className="block font-heading font-bold uppercase text-ink">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue="DRAFT"
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              >
                <option value="DRAFT">DRAFT</option>
                <option value="SCHEDULED">SCHEDULED</option>
                <option value="PUBLISHED">PUBLISHED</option>
              </select>
            </div>

            <div>
              <label htmlFor="scheduledFor" className="block font-heading font-bold uppercase text-ink">
                Scheduled For (if SCHEDULED)
              </label>
              <input
                type="date"
                id="scheduledFor"
                name="scheduledFor"
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              />
            </div>

            <div>
              <label htmlFor="publishedUrl" className="block font-heading font-bold uppercase text-ink">
                Published URL (if PUBLISHED)
              </label>
              <input
                type="url"
                id="publishedUrl"
                name="publishedUrl"
                maxLength={2048}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="https://..."
              />
            </div>

            <div>
              <label htmlFor="notes" className="block font-heading font-bold uppercase text-ink">
                Notes / Copy
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                maxLength={20000}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="Draft text or editorial instructions"
              />
            </div>

            <button
              type="submit"
              className="w-full border-2 border-ink bg-ink py-2 font-heading text-xs font-bold uppercase tracking-widest text-cream hover:bg-rejection-red"
            >
              Create Content
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
