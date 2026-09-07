import { requireAdminPage } from "@/lib/auth/boundaries";
import Link from "next/link";
import { AdminServiceError } from "../../_components/service-error";
import { notFound } from "next/navigation";
import { getWebsiteById, getRelationships } from "@/lib/campaign";
import { getPrisma } from "@/lib/prisma";
import { StatusBadge } from "../../_components/badge";
import { EntityConnections } from "../../_components/entity-connections";
import { EditWebsiteForm } from "../../_components/forms/website-form";

export const dynamic = "force-dynamic";

export default async function EditWebsitePage(props: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const params = await props.params;
  const prisma = getPrisma();

  const [result, tagRows, relRes] = await Promise.all([
    getWebsiteById(params.id),
    prisma.entityTag.findMany({
      where: { entityType: "WEBSITE", entityId: params.id },
      include: { tag: true },
      orderBy: { tag: { slug: "asc" } },
    }),
    getRelationships({
      entityType: "WEBSITE",
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

  const site = result.data;
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

        <EditWebsiteForm website={site} />
      </div>

      {/* Entity Connections */}
      <EntityConnections
        entityType="WEBSITE"
        entityId={site.id}
        tags={tags}
        relationships={relationships}
        currentHref={`/admin/websites/${site.id}`}
      />
    </div>
  );
}
