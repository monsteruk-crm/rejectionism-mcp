import { requireAdminPage } from "@/lib/auth/boundaries";
import Link from "next/link";
import { AdminServiceError } from "../../_components/service-error";
import { notFound } from "next/navigation";
import { getContentItemById, getRelationships } from "@/lib/campaign";
import { getPrisma } from "@/lib/prisma";
import { StatusBadge } from "../../_components/badge";
import { EntityConnections } from "../../_components/entity-connections";
import { EditContentForm } from "../../_components/forms/content-form";

export const dynamic = "force-dynamic";

export default async function EditContentItemPage(props: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const params = await props.params;
  const prisma = getPrisma();

  const [result, tagRows, relRes] = await Promise.all([
    getContentItemById(params.id),
    prisma.entityTag.findMany({
      where: { entityType: "CONTENT_ITEM", entityId: params.id },
      include: { tag: true },
      orderBy: { tag: { slug: "asc" } },
    }),
    getRelationships({
      entityType: "CONTENT_ITEM",
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

  const content = result.data;
  const scheduledDateVal = content.scheduledFor ? content.scheduledFor.slice(0, 10) : "";
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

        <EditContentForm content={content} />
      </div>

      {/* Entity Connections */}
      <EntityConnections
        entityType="CONTENT_ITEM"
        entityId={content.id}
        tags={tags}
        relationships={relationships}
        currentHref={`/admin/content/${content.id}`}
      />
    </div>
  );
}
