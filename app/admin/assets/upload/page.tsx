import { requireAdminPage } from "@/lib/auth/boundaries";
import Link from "next/link";
import { AdminAssetUpload } from "../_components/asset-upload";
import { listAdminUploadSessions } from "@/lib/campaign/admin-upload-sessions";
import { AdminSessionHistory } from "./_components/session-history";

export const dynamic = "force-dynamic";

export default async function AdminAssetUploadPage(props: {
  searchParams: Promise<{ requestId?: string; offset?: string }>;
}) {
  await requireAdminPage();
  const searchParams = await props.searchParams;
  const requestId = searchParams.requestId;
  const offset = searchParams.offset ? Math.max(0, parseInt(searchParams.offset, 10) || 0) : 0;

  const sessionsRes = await listAdminUploadSessions({ limit: 10, offset });
  const sessions = sessionsRes.ok ? sessionsRes.data.items : [];

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
            Contributor Links
          </Link>
        </div>
      </div>

      <AdminAssetUpload initialRequestId={requestId} />

      <AdminSessionHistory sessions={sessions} currentRequestId={requestId} />
    </div>
  );
}
