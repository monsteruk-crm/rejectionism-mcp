import { requireAdminPage } from "@/lib/auth/boundaries";
import Link from "next/link";
import { getPrisma } from "@/lib/prisma";
import { AdminAssetUpload } from "../_components/asset-upload";

export const dynamic = "force-dynamic";

export default async function AdminAssetUploadPage() {
  await requireAdminPage();
  const prisma = getPrisma();

  const assetRows = await prisma.asset.findMany({
    where: { status: { not: "SUPERSEDED" } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    include: {
      revisions: {
        orderBy: { revisionNumber: "desc" },
        select: { id: true, revisionNumber: true, label: true },
      },
    },
    take: 100,
  });

  const assetOptions = assetRows.map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    latestRevisionNumber: a.revisions[0]?.revisionNumber ?? null,
    revisions: a.revisions,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-wider text-rejection-red">
            Artwork Ingestion & Multi-File Transfer
          </p>
          <h1 className="font-heading text-4xl font-black uppercase tracking-tight">
            Admin Bulk Upload
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/admin/assets"
            className="text-xs font-bold uppercase tracking-wider text-ink/70 hover:text-ink"
          >
            &larr; Asset Library
          </Link>
          <Link
            href="/admin/upload-links"
            className="text-xs font-bold uppercase tracking-wider text-ink/70 hover:text-ink"
          >
            Upload Links
          </Link>
        </div>
      </div>

      <AdminAssetUpload assets={assetOptions} />
    </div>
  );
}
