import { requireAdminPage } from "@/lib/auth/boundaries";
import Link from "next/link";
import { AdminServiceError } from "../../_components/service-error";
import { notFound } from "next/navigation";
import { getWorkItemById } from "@/lib/campaign";
import { updateWorkItemAction } from "../../actions";
import { StatusBadge, PriorityBadge } from "../../_components/badge";

export const dynamic = "force-dynamic";

export default async function EditWorkItemPage(props: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const params = await props.params;
  const result = await getWorkItemById(params.id);

  if (!result.ok) {
    if (result.error.code === "NOT_FOUND") {
      notFound();
    }

    return <AdminServiceError error={result.error} />;
  }

  const item = result.data;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-wider text-rejection-red">
            Edit Work Item // ID: {item.id}
          </p>
          <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
            {item.title}
          </h1>
        </div>
        <Link
          href="/admin/work-items"
          className="text-xs font-bold uppercase tracking-wider text-ink/70 hover:text-ink"
        >
          &larr; All Work Items
        </Link>
      </div>

      <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
        <div className="mb-6 flex items-center justify-between border-b border-ink/20 pb-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={item.status} />
            <PriorityBadge priority={item.priority} />
          </div>
          <span className="font-mono text-xs text-ink/70">Version {item.version}</span>
        </div>

        <form action={updateWorkItemAction} className="space-y-4 text-xs font-sans">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="expectedVersion" value={item.version} />

          <div>
            <label htmlFor="title" className="block font-heading font-bold uppercase text-ink">
              Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              defaultValue={item.title}
              required
              maxLength={200}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
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
              defaultValue={item.description}
              rows={4}
              maxLength={20000}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="status" className="block font-heading font-bold uppercase text-ink">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={item.status}
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
              <label htmlFor="priority" className="block font-heading font-bold uppercase text-ink">
                Priority (0-100)
              </label>
              <input
                type="number"
                id="priority"
                name="priority"
                min={0}
                max={100}
                defaultValue={item.priority}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="blockedReason"
              className="block font-heading font-bold uppercase text-ink"
            >
              Blocked Reason (Required if status is BLOCKED)
            </label>
            <textarea
              id="blockedReason"
              name="blockedReason"
              defaultValue={item.blockedReason || ""}
              rows={2}
              maxLength={20000}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>

          <div>
            <label
              htmlFor="evidenceUrl"
              className="block font-heading font-bold uppercase text-ink"
            >
              Evidence URL (Required for DONE if no completion note)
            </label>
            <input
              type="url"
              id="evidenceUrl"
              name="evidenceUrl"
              defaultValue={item.evidenceUrl || ""}
              maxLength={2048}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>

          <div>
            <label
              htmlFor="completionNote"
              className="block font-heading font-bold uppercase text-ink"
            >
              Completion Note (Required for DONE if no evidence URL)
            </label>
            <textarea
              id="completionNote"
              name="completionNote"
              defaultValue={item.completionNote || ""}
              rows={2}
              maxLength={20000}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <Link
              href="/admin/work-items"
              className="border border-ink bg-cream px-4 py-2 font-heading text-xs font-bold uppercase hover:bg-paper"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="border-2 border-ink bg-ink px-6 py-2 font-heading text-xs font-bold uppercase tracking-widest text-cream hover:bg-rejection-red"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
