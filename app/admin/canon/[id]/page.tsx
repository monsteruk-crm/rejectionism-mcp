import { requireAdminPage } from "@/lib/auth/boundaries";
import Link from "next/link";
import { AdminServiceError } from "../../_components/service-error";
import { notFound } from "next/navigation";
import { getCanonEntryById, getRelationships } from "@/lib/campaign";
import { getPrisma } from "@/lib/prisma";
import { updateCanonEntryAction } from "../../actions";
import { EntityConnections } from "../../_components/entity-connections";

export const dynamic = "force-dynamic";

export default async function EditCanonEntryPage(props: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const params = await props.params;
  const prisma = getPrisma();

  const [result, tagRows, relRes] = await Promise.all([
    getCanonEntryById(params.id),
    prisma.entityTag.findMany({
      where: { entityType: "CANON_ENTRY", entityId: params.id },
      include: { tag: true },
      orderBy: { tag: { slug: "asc" } },
    }),
    getRelationships({
      entityType: "CANON_ENTRY",
      entityId: params.id,
      direction: "both",
      limit: 50,
    }),
  ]);

  if (!result.ok) {
    if (result.error.code === "NOT_FOUND") {
      notFound();
    }

    return <AdminServiceError error={result.error} />;
  }

  const entry = result.data;
  const tags = tagRows.map((r) => ({
    id: r.tag.id,
    name: r.tag.name,
    slug: r.tag.slug,
    createdAt: r.tag.createdAt.toISOString(),
  }));
  const relationships = relRes.ok ? relRes.data.items : [];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-wider text-rejection-red">
            Edit Canon Entry // {entry.key}
          </p>
          <h1 className="font-heading text-3xl font-black uppercase tracking-tight">{entry.key}</h1>
        </div>
        <Link
          href="/admin/canon"
          className="text-xs font-bold uppercase tracking-wider text-ink/70 hover:text-ink"
        >
          &larr; All Canon Entries
        </Link>
      </div>

      <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
        <div className="mb-6 flex items-center justify-between border-b border-ink/20 pb-3">
          <span className="font-heading text-xs font-bold uppercase text-ink">
            Category: {entry.category}
          </span>
          <span className="font-mono text-xs text-ink/70">Version {entry.version}</span>
        </div>

        <form action={updateCanonEntryAction} className="space-y-4 text-xs font-sans">
          <input type="hidden" name="id" value={entry.id} />
          <input type="hidden" name="expectedVersion" value={entry.version} />

          <div>
            <label className="block font-heading font-bold uppercase text-ink">
              Unique Key (Immutable)
            </label>
            <input
              type="text"
              value={entry.key}
              disabled
              className="mt-1 w-full border border-ink/30 bg-paper/60 p-2 font-mono text-ink/60"
            />
          </div>

          <div>
            <label htmlFor="value" className="block font-heading font-bold uppercase text-ink">
              Canonical Value *
            </label>
            <textarea
              id="value"
              name="value"
              defaultValue={entry.value}
              required
              rows={4}
              maxLength={20000}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>

          <div>
            <label htmlFor="category" className="block font-heading font-bold uppercase text-ink">
              Category *
            </label>
            <input
              type="text"
              id="category"
              name="category"
              defaultValue={entry.category}
              required
              maxLength={200}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>

          <div>
            <label htmlFor="notes" className="block font-heading font-bold uppercase text-ink">
              Source Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              defaultValue={entry.notes || ""}
              rows={3}
              maxLength={20000}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <Link
              href="/admin/canon"
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

      {/* Entity Connections */}
      <EntityConnections
        entityType="CANON_ENTRY"
        entityId={entry.id}
        tags={tags}
        relationships={relationships}
        currentHref={`/admin/canon/${entry.id}`}
      />
    </div>
  );
}
