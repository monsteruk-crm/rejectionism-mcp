import { requireAdminPage } from "@/lib/auth/boundaries";
import Link from "next/link";
import { AdminServiceError } from "../_components/service-error";
import { listWorkItems } from "@/lib/campaign";
import { StatusBadge, PriorityBadge } from "../_components/badge";
import { createWorkItemAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function WorkItemsListPage(props: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  await requireAdminPage();
  const searchParams = await props.searchParams;
  const statusFilter = searchParams.status;
  const searchQuery = searchParams.search;

  const result = await listWorkItems({
    status: statusFilter,
    search: searchQuery,
    limit: 100,
  });

  const items = result.ok ? result.data.items : [];
  const total = result.ok ? result.data.total : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-wider text-rejection-red">
            Operations Register
          </p>
          <h1 className="font-heading text-4xl font-black uppercase tracking-tight">
            Work Items ({result.ok ? total : "Unavailable"})
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
          { label: "In Progress", value: "IN_PROGRESS" },
          { label: "Next", value: "NEXT" },
          { label: "Blocked", value: "BLOCKED" },
          { label: "Backlog", value: "BACKLOG" },
          { label: "Done", value: "DONE" },
        ].map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/admin/work-items?status=${f.value}` : "/admin/work-items"}
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
        {/* Work Items Table */}
        <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)] lg:col-span-2">
          {!result.ok ? (
            <p className="text-xs font-bold text-rejection-red">Register unavailable.</p>
          ) : items.length === 0 ? (
            <p className="text-xs italic text-ink/70">No work items match the filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-xs">
                <thead className="border-b-2 border-ink font-heading uppercase text-ink">
                  <tr>
                    <th className="py-2 pr-2">Priority</th>
                    <th className="py-2 pr-4">Title</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 pr-2">Ver</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/15">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-cream">
                      <td className="py-3 pr-2">
                        <PriorityBadge priority={item.priority} />
                      </td>
                      <td className="py-3 pr-4">
                        <Link
                          href={`/admin/work-items/${item.id}`}
                          className="font-heading text-sm font-bold text-ink hover:text-rejection-red"
                        >
                          {item.title}
                        </Link>
                        {item.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-ink/70">
                            {item.description}
                          </p>
                        )}
                        {item.blockedReason && (
                          <p className="mt-1 font-mono text-[11px] text-rejection-red">
                            Blocked: {item.blockedReason}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-2 whitespace-nowrap">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="py-3 pr-2 font-mono text-ink/60">v{item.version}</td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/work-items/${item.id}`}
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

        {/* Create Work Item Form */}
        <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
          <h2 className="border-b-2 border-ink pb-2 font-heading text-xl font-black uppercase">
            Create Work Item
          </h2>

          <form action={createWorkItemAction} className="mt-4 space-y-4 text-xs font-sans">
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
                placeholder="e.g. Publish launch poster"
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="block font-heading font-bold uppercase text-ink"
              >
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                maxLength={20000}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="Operational context and criteria"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="status" className="block font-heading font-bold uppercase text-ink">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue="BACKLOG"
                  className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                >
                  <option value="BACKLOG">BACKLOG</option>
                  <option value="NEXT">NEXT</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="BLOCKED">BLOCKED</option>
                  <option value="DONE">DONE</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="priority"
                  className="block font-heading font-bold uppercase text-ink"
                >
                  Priority (0-100)
                </label>
                <input
                  type="number"
                  id="priority"
                  name="priority"
                  min={0}
                  max={100}
                  defaultValue={0}
                  className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="blockedReason"
                className="block font-heading font-bold uppercase text-ink"
              >
                Blocked Reason (if BLOCKED)
              </label>
              <input
                type="text"
                id="blockedReason"
                name="blockedReason"
                maxLength={20000}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="Required if status is BLOCKED"
              />
            </div>

            <div>
              <label
                htmlFor="evidenceUrl"
                className="block font-heading font-bold uppercase text-ink"
              >
                Evidence URL (if DONE)
              </label>
              <input
                type="url"
                id="evidenceUrl"
                name="evidenceUrl"
                maxLength={2048}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="https://example.com/evidence"
              />
            </div>

            <div>
              <label
                htmlFor="completionNote"
                className="block font-heading font-bold uppercase text-ink"
              >
                Completion Note (if DONE)
              </label>
              <textarea
                id="completionNote"
                name="completionNote"
                rows={2}
                maxLength={20000}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="Required for DONE if no URL"
              />
            </div>

            <button
              type="submit"
              className="w-full border-2 border-ink bg-ink py-2 font-heading text-xs font-bold uppercase tracking-widest text-cream hover:bg-rejection-red"
            >
              Create Item
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
