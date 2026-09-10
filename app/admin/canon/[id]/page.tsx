import { requireAdminPage } from "@/lib/auth/boundaries";
import Link from "next/link";
import { AdminServiceError } from "../../_components/service-error";
import { notFound } from "next/navigation";
import { getCanonEntryById, getRelationships } from "@/lib/campaign";
import { getPrisma } from "@/lib/prisma";
import { EntityConnections } from "../../_components/entity-connections";
import { EditCanonForm } from "../../_components/forms/canon-form";

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

        <EditCanonForm entry={entry} />
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
