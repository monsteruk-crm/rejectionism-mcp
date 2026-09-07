import { requireAdminPage } from "@/lib/auth/boundaries";
import Link from "next/link";
import { AdminServiceError } from "../../_components/service-error";
import { notFound } from "next/navigation";
import { getContactById, getRelationships } from "@/lib/campaign";
import { getPrisma } from "@/lib/prisma";
import { EntityConnections } from "../../_components/entity-connections";
import { EditContactForm } from "../../_components/forms/contact-form";

export const dynamic = "force-dynamic";

export default async function EditContactPage(props: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const params = await props.params;
  const prisma = getPrisma();

  const [result, tagRows, relRes] = await Promise.all([
    getContactById(params.id, true),
    prisma.entityTag.findMany({
      where: { entityType: "CONTACT", entityId: params.id },
      include: { tag: true },
      orderBy: { tag: { slug: "asc" } },
    }),
    getRelationships({
      entityType: "CONTACT",
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

  const contact = result.data;
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
            Edit Contact // ID: {contact.id}
          </p>
          <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
            {contact.name}
          </h1>
        </div>
        <Link
          href="/admin/contacts"
          className="text-xs font-bold uppercase tracking-wider text-ink/70 hover:text-ink"
        >
          &larr; All Contacts
        </Link>
      </div>

      <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
        <div className="mb-6 flex items-center justify-between border-b border-ink/20 pb-3">
          <span className="border border-ink/40 bg-paper px-2 py-0.5 font-heading text-xs uppercase text-ink">
            Status: {contact.status}
          </span>
          <span className="font-mono text-xs text-ink/70">Version {contact.version}</span>
        </div>

        <EditContactForm contact={contact} />
      </div>

      {/* Entity Connections */}
      <EntityConnections
        entityType="CONTACT"
        entityId={contact.id}
        tags={tags}
        relationships={relationships}
        currentHref={`/admin/contacts/${contact.id}`}
      />
    </div>
  );
}
