import Link from "next/link";
import { notFound } from "next/navigation";
import { getWebsiteById } from "@/lib/campaign";
import { updateWebsiteAction } from "../../actions";
import { StatusBadge } from "../../_components/badge";

export const dynamic = "force-dynamic";

export default async function EditWebsitePage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const result = await getWebsiteById(params.id);

  if (!result.ok) {
    notFound();
  }

  const site = result.data;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-wider text-rejection-red">
            Edit Website // {site.domain}
          </p>
          <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
            {site.domain}
          </h1>
        </div>
        <Link
          href="/admin/websites"
          className="text-xs font-bold uppercase tracking-wider text-ink/70 hover:text-ink"
        >
          &larr; All Websites
        </Link>
      </div>

      <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
        <div className="mb-6 flex items-center justify-between border-b border-ink/20 pb-3">
          <StatusBadge status={site.status} />
          <span className="font-mono text-xs text-ink/70">Version {site.version}</span>
        </div>

        <form action={updateWebsiteAction} className="space-y-4 text-xs font-sans">
          <input type="hidden" name="id" value={site.id} />
          <input type="hidden" name="expectedVersion" value={site.version} />

          <div>
            <label className="block font-heading font-bold uppercase text-ink">
              Domain (Immutable)
            </label>
            <input
              type="text"
              value={site.domain}
              disabled
              className="mt-1 w-full border border-ink/30 bg-paper/60 p-2 font-mono text-ink/60"
            />
          </div>

          <div>
            <label htmlFor="name" className="block font-heading font-bold uppercase text-ink">
              Website Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              defaultValue={site.name}
              required
              maxLength={200}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>

          <div>
            <label htmlFor="status" className="block font-heading font-bold uppercase text-ink">
              Known Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={site.status}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            >
              <option value="UNKNOWN">UNKNOWN</option>
              <option value="PLANNED">PLANNED</option>
              <option value="RESERVED">RESERVED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="LIVE">LIVE</option>
              <option value="REDIRECT">REDIRECT</option>
            </select>
          </div>

          <div>
            <label htmlFor="purpose" className="block font-heading font-bold uppercase text-ink">
              Purpose & Role *
            </label>
            <textarea
              id="purpose"
              name="purpose"
              defaultValue={site.purpose}
              required
              rows={3}
              maxLength={20000}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="deploymentUrl" className="block font-heading font-bold uppercase text-ink">
                Deployment URL
              </label>
              <input
                type="url"
                id="deploymentUrl"
                name="deploymentUrl"
                defaultValue={site.deploymentUrl || ""}
                maxLength={2048}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="https://..."
              />
            </div>

            <div>
              <label htmlFor="repositoryUrl" className="block font-heading font-bold uppercase text-ink">
                Repository URL
              </label>
              <input
                type="url"
                id="repositoryUrl"
                name="repositoryUrl"
                defaultValue={site.repositoryUrl || ""}
                maxLength={2048}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="https://github.com/..."
              />
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block font-heading font-bold uppercase text-ink">
              Operational Notes (DNS, Registrar, Expiry)
            </label>
            <textarea
              id="notes"
              name="notes"
              defaultValue={site.notes || ""}
              rows={3}
              maxLength={20000}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <Link
              href="/admin/websites"
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
