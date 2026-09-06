import { requireAdminPage } from "@/lib/auth/boundaries";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminServiceError } from "../../_components/service-error";
import { getUploadRequest, listActivity } from "@/lib/campaign";
import { StatusBadge } from "../../_components/badge";
import { UploadLinkControls } from "../_components/upload-link-controls";

export const dynamic = "force-dynamic";

export default async function UploadLinkDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const params = await props.params;
  const result = await getUploadRequest({ id: params.id });

  if (!result.ok) {
    if (result.error.code === "NOT_FOUND") {
      notFound();
    }
    return <AdminServiceError error={result.error} />;
  }

  const { request, files } = result.data;
  const activityRes = await listActivity({
    entityType: "UPLOAD_REQUEST",
    limit: 20,
  });
  const activities = activityRes.ok
    ? (activityRes.data.items as Array<{
        id: string;
        entityId: string;
        action: string;
        summary: string;
        createdAt: Date;
        metadata: any;
      }>).filter((a) => a.entityId === request.id)
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-wider text-rejection-red">
            Upload Link // ID: {request.id}
          </p>
          <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
            {request.title}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/admin/upload-links"
            className="text-xs font-bold uppercase tracking-wider text-ink/70 hover:text-ink"
          >
            &larr; All Upload Links
          </Link>
        </div>
      </div>

      <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-ink/20 pb-4">
          <div className="flex items-center gap-3">
            <StatusBadge status={request.effectiveStatus} />
            <span className="font-mono text-xs text-ink/70">
              Persisted: {request.status}
            </span>
          </div>
          <span className="font-mono text-xs text-ink/70">
            Created: {new Date(request.createdAt).toLocaleString()}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h3 className="font-heading text-xs font-bold uppercase text-ink/60">
              Request Details
            </h3>
            <div className="mt-2 space-y-2 font-sans text-xs">
              <div>
                <span className="font-bold">Instructions:</span>
                <p className="mt-0.5 rounded border border-ink/20 bg-cream p-2 text-ink whitespace-pre-wrap">
                  {request.instructions || "None provided."}
                </p>
              </div>
              <p>
                <span className="font-bold">Expires:</span>{" "}
                <span className="font-mono">{new Date(request.expiresAt).toLocaleString()}</span>
              </p>
              <p>
                <span className="font-bold">Max Items:</span>{" "}
                <span className="font-mono">{request.maxItems}</span>
              </p>
              {request.submittedAt && (
                <p>
                  <span className="font-bold">Submitted At:</span>{" "}
                  <span className="font-mono">{new Date(request.submittedAt).toLocaleString()}</span>
                </p>
              )}
              {request.submissionKey && (
                <p>
                  <span className="font-bold">Submission Key:</span>{" "}
                  <span className="font-mono text-[11px]">{request.submissionKey}</span>
                </p>
              )}
              {request.revokedAt && (
                <p>
                  <span className="font-bold">Revoked At:</span>{" "}
                  <span className="font-mono text-blood-red">{new Date(request.revokedAt).toLocaleString()}</span>
                </p>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-heading text-xs font-bold uppercase text-ink/60">
              Target Resolution
            </h3>
            <div className="mt-2 space-y-2 font-sans text-xs">
              <p>
                <span className="font-bold">Target Mode:</span>{" "}
                {request.targetRevisionId ? (
                  <span className="font-bold text-rejection-red">Append to Revision</span>
                ) : request.targetAssetId ? (
                  <span className="font-bold text-rejection-red">New Revision on Asset</span>
                ) : (
                  <span className="text-ink/80">Separate New Assets</span>
                )}
              </p>
              {request.targetAssetId && (
                <p>
                  <span className="font-bold">Target Asset:</span>{" "}
                  <Link
                    href={`/admin/assets/${request.targetAssetId}`}
                    className="font-mono text-rejection-red underline hover:text-ink"
                  >
                    {request.targetAssetId}
                  </Link>
                </p>
              )}
              {request.targetRevisionId && (
                <p>
                  <span className="font-bold">Target Revision:</span>{" "}
                  <span className="font-mono">{request.targetRevisionId}</span>
                </p>
              )}
              {request.targetAssetVersion !== null && (
                <p>
                  <span className="font-bold">Captured Asset Version:</span>{" "}
                  <span className="font-mono">v{request.targetAssetVersion}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Revoke / Regenerate controls */}
        <div className="mt-6">
          <UploadLinkControls id={request.id} effectiveStatus={request.effectiveStatus} />
        </div>
      </div>

      {/* Reserved & Uploaded Files */}
      <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
        <h2 className="border-b-2 border-ink pb-2 font-heading text-xl font-black uppercase">
          Reserved & Uploaded Files ({files.length})
        </h2>

        {files.length === 0 ? (
          <p className="mt-4 text-xs italic text-ink/70">No files reserved for this request yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead className="border-b-2 border-ink font-heading uppercase text-ink">
                <tr>
                  <th className="py-2 pr-3">Filename</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">MIME</th>
                  <th className="py-2 pr-2">Size</th>
                  <th className="py-2 pr-2">Dimensions</th>
                  <th className="py-2 pr-2">Auth Count</th>
                  <th className="py-2 text-right">Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/15">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-cream">
                    <td className="py-2.5 pr-3">
                      <p className="font-mono text-xs font-bold text-ink">{file.sourceFilename}</p>
                      <p className="font-mono text-[10px] text-ink/50">ID: {file.id}</p>
                      {file.failureCode && (
                        <p className="font-mono text-[11px] font-bold text-blood-red">
                          Error: {file.failureCode}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 pr-2 whitespace-nowrap">
                      <StatusBadge status={file.status} />
                    </td>
                    <td className="py-2.5 pr-2 font-mono text-[11px] text-ink/70 whitespace-nowrap">
                      {file.mimeType || file.declaredMimeType}
                    </td>
                    <td className="py-2.5 pr-2 font-mono text-[11px] text-ink/70 whitespace-nowrap">
                      {file.byteSize !== null
                        ? `${(file.byteSize / 1024).toFixed(1)} KB`
                        : `${(file.expectedByteSize / 1024).toFixed(1)} KB (exp)`}
                    </td>
                    <td className="py-2.5 pr-2 font-mono text-[11px] text-ink/70 whitespace-nowrap">
                      {file.width && file.height ? `${file.width} × ${file.height}` : "—"}
                    </td>
                    <td className="py-2.5 pr-2 font-mono text-xs whitespace-nowrap">
                      {file.authorizationCount} / 3
                    </td>
                    <td className="py-2.5 text-right font-mono text-[11px] text-ink/60 whitespace-nowrap">
                      {file.verifiedAt ? new Date(file.verifiedAt).toLocaleTimeString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activity Section */}
      {activities.length > 0 && (
        <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
          <h2 className="border-b-2 border-ink pb-2 font-heading text-lg font-black uppercase">
            Audit Activity
          </h2>
          <ul className="mt-3 divide-y divide-ink/15 font-sans text-xs">
            {activities.map((act) => (
              <li key={act.id} className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-heading font-bold uppercase">{act.action}:</span>{" "}
                  <span className="text-ink/80">{act.summary}</span>
                </div>
                <span className="font-mono text-[10px] text-ink/50">
                  {new Date(act.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
