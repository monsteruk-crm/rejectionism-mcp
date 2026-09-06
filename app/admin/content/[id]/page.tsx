import { requireAdminPage } from "@/lib/auth/boundaries";
import Link from "next/link";
import { AdminServiceError } from "../../_components/service-error";
import { notFound } from "next/navigation";
import { getContentItemById } from "@/lib/campaign";
import { updateContentItemAction } from "../../actions";
import { StatusBadge } from "../../_components/badge";

export const dynamic = "force-dynamic";

export default async function EditContentItemPage(props: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const params = await props.params;
  const result = await getContentItemById(params.id);

  if (!result.ok) {
    if (result.error.code === "NOT_FOUND") {
      notFound();
    }

    return <AdminServiceError error={result.error} />;
  }

  const content = result.data;
  const scheduledDateVal = content.scheduledFor ? content.scheduledFor.slice(0, 10) : "";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-wider text-rejection-red">
            Edit Content // ID: {content.id}
          </p>
          <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
            {content.title}
          </h1>
        </div>
        <Link
          href="/admin/content"
          className="text-xs font-bold uppercase tracking-wider text-ink/70 hover:text-ink"
        >
          &larr; All Content
        </Link>
      </div>

      <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
        <div className="mb-6 flex items-center justify-between border-b border-ink/20 pb-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={content.status} />
            <span className="font-mono text-xs text-ink/70">
              {content.format}
              {" // "}
              {content.channel}
            </span>
          </div>
          <span className="font-mono text-xs text-ink/70">Version {content.version}</span>
        </div>

        <form action={updateContentItemAction} className="space-y-4 text-xs font-sans">
          <input type="hidden" name="id" value={content.id} />
          <input type="hidden" name="expectedVersion" value={content.version} />

          <div>
            <label htmlFor="title" className="block font-heading font-bold uppercase text-ink">
              Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              defaultValue={content.title}
              required
              maxLength={200}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="format" className="block font-heading font-bold uppercase text-ink">
                Format *
              </label>
              <input
                type="text"
                id="format"
                name="format"
                defaultValue={content.format}
                required
                maxLength={200}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
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
                defaultValue={content.channel}
                required
                maxLength={200}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
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
              defaultValue={content.status}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            >
              <option value="DRAFT">DRAFT</option>
              <option value="SCHEDULED">SCHEDULED</option>
              <option value="PUBLISHED">PUBLISHED</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="scheduledFor"
              className="block font-heading font-bold uppercase text-ink"
            >
              Scheduled For (Required if status is SCHEDULED)
            </label>
            <input
              type="date"
              id="scheduledFor"
              name="scheduledFor"
              defaultValue={scheduledDateVal}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>

          <div>
            <label
              htmlFor="publishedUrl"
              className="block font-heading font-bold uppercase text-ink"
            >
              Published URL (Required if status is PUBLISHED)
            </label>
            <input
              type="url"
              id="publishedUrl"
              name="publishedUrl"
              defaultValue={content.publishedUrl || ""}
              maxLength={2048}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>

          <div>
            <label htmlFor="notes" className="block font-heading font-bold uppercase text-ink">
              Notes / Copy
            </label>
            <textarea
              id="notes"
              name="notes"
              defaultValue={content.notes || ""}
              rows={4}
              maxLength={20000}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <Link
              href="/admin/content"
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
