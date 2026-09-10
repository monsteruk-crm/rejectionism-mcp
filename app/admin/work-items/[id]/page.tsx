import { requireAdminPage } from "@/lib/auth/boundaries";
import Link from "next/link";
import { AdminServiceError } from "../../_components/service-error";
import { notFound } from "next/navigation";
import { getWorkItemById, getRelationships } from "@/lib/campaign";
import { getPrisma } from "@/lib/prisma";
import { StatusBadge, PriorityBadge } from "../../_components/badge";
import { EntityConnections } from "../../_components/entity-connections";
import { EditWorkItemForm } from "../../_components/forms/work-item-form";

export const dynamic = "force-dynamic";

export default async function EditWorkItemPage(props: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const params = await props.params;
  const prisma = getPrisma();

  const [result, tagRows, relRes] = await Promise.all([
    getWorkItemById(params.id),
    prisma.entityTag.findMany({
      where: { entityType: "WORK_ITEM", entityId: params.id },
      include: { tag: true },
      orderBy: { tag: { slug: "asc" } },
    }),
    getRelationships({
      entityType: "WORK_ITEM",
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

  const item = result.data;
  const tags = tagRows.map((r) => ({
    id: r.tag.id,
    name: r.tag.name,
    slug: r.tag.slug,
    createdAt: r.tag.createdAt.toISOString(),
  }));
  const relationships = relRes.ok ? relRes.data.items : [];

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

        <EditWorkItemForm item={item} />
      </div>

      {/* Entity Connections */}
      <EntityConnections
        entityType="WORK_ITEM"
        entityId={item.id}
        tags={tags}
        relationships={relationships}
        currentHref={`/admin/work-items/${item.id}`}
      />
    </div>
  );
}
