import Link from "next/link";
import { AdminServiceError } from "../../_components/service-error";
import { notFound } from "next/navigation";
import { getAssetById } from "@/lib/campaign";
import { updateAssetAction } from "../../actions";
import { StatusBadge } from "../../_components/badge";

export const dynamic = "force-dynamic";

export default async function EditAssetPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const result = await getAssetById(params.id);

  if (!result.ok) {
    if (result.error.code === "NOT_FOUND") {
      notFound();
    }

    return <AdminServiceError error={result.error} />;
  }

  const asset = result.data;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-wider text-rejection-red">
            Edit Visual Asset // ID: {asset.id}
          </p>
          <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
            {asset.name}
          </h1>
        </div>
        <Link
          href="/admin/assets"
          className="text-xs font-bold uppercase tracking-wider text-ink/70 hover:text-ink"
        >
          &larr; All Assets
        </Link>
      </div>

      <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
        <div className="mb-6 flex items-center justify-between border-b border-ink/20 pb-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={asset.status} />
            <span className="font-mono text-xs uppercase text-ink/70">{asset.kind}</span>
          </div>
          <span className="font-mono text-xs text-ink/70">Version {asset.version}</span>
        </div>

        <form action={updateAssetAction} className="space-y-4 text-xs font-sans">
          <input type="hidden" name="id" value={asset.id} />
          <input type="hidden" name="expectedVersion" value={asset.version} />

          <div>
            <label htmlFor="name" className="block font-heading font-bold uppercase text-ink">
              Asset Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              defaultValue={asset.name}
              required
              maxLength={200}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="kind" className="block font-heading font-bold uppercase text-ink">
                Kind *
              </label>
              <input
                type="text"
                id="kind"
                name="kind"
                defaultValue={asset.kind}
                required
                maxLength={200}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              />
            </div>

            <div>
              <label htmlFor="status" className="block font-heading font-bold uppercase text-ink">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={asset.status}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              >
                <option value="MISSING">MISSING</option>
                <option value="DRAFT">DRAFT</option>
                <option value="NEEDS_WORK">NEEDS_WORK</option>
                <option value="APPROVED">APPROVED</option>
                <option value="SUPERSEDED">SUPERSEDED</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="sourceFilename"
              className="block font-heading font-bold uppercase text-ink"
            >
              Source Filename
            </label>
            <input
              type="text"
              id="sourceFilename"
              name="sourceFilename"
              defaultValue={asset.sourceFilename || ""}
              maxLength={20000}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
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
              defaultValue={asset.url || ""}
              maxLength={2048}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>

          <div>
            <label htmlFor="notes" className="block font-heading font-bold uppercase text-ink">
              Production Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              defaultValue={asset.notes || ""}
              rows={4}
              maxLength={20000}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <Link
              href="/admin/assets"
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
