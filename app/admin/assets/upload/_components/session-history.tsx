"use client";

import Link from "next/link";
import { cancelAdminUploadSessionAction } from "../actions";
import { StatusBadge } from "@/app/admin/_components/badge";
import type { AdminUploadSessionDto } from "@/lib/campaign/admin-upload-sessions";

export function AdminSessionHistory({
  sessions,
  currentRequestId,
}: {
  sessions: AdminUploadSessionDto[];
  currentRequestId?: string;
}) {
  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
      <h3 className="border-b-2 border-ink pb-2 font-heading text-lg font-black uppercase text-ink">
        Recent Internal Upload Sessions ({sessions.length})
      </h3>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left font-sans text-xs">
          <thead className="border-b-2 border-ink font-heading uppercase text-ink">
            <tr>
              <th className="py-2 pr-4">Session ID</th>
              <th className="py-2 pr-2">Effective Status</th>
              <th className="py-2 pr-2">Target</th>
              <th className="py-2 pr-2">Expires</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/15">
            {sessions.map((s) => {
              const isCurrent = s.id === currentRequestId;
              const canResume = s.effectiveStatus === "OPEN";

              return (
                <tr key={s.id} className={isCurrent ? "bg-cream font-bold" : "hover:bg-cream"}>
                  <td className="py-2.5 pr-4 font-mono text-[11px]">
                    #{s.id.slice(-8)}
                    {isCurrent && (
                      <span className="ml-2 rounded bg-ink px-1.5 py-0.5 font-heading text-[10px] text-cream">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-2 whitespace-nowrap">
                    <StatusBadge status={s.effectiveStatus} />
                  </td>
                  <td className="py-2.5 pr-2 font-mono text-[11px] text-ink/80 whitespace-nowrap">
                    {s.targetRevisionId ? (
                      <span>Rev: #{s.targetRevisionId.slice(-6)}</span>
                    ) : s.targetAssetId ? (
                      <span>Asset: #{s.targetAssetId.slice(-6)}</span>
                    ) : (
                      <span className="text-ink/50">New Assets</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-2 font-mono text-[11px] text-ink/60 whitespace-nowrap">
                    {new Date(s.expiresAt).toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      {canResume && !isCurrent && (
                        <Link
                          href={`/admin/assets/upload?requestId=${s.id}`}
                          className="border border-ink bg-cream px-2 py-1 font-heading text-[11px] font-bold uppercase hover:bg-ink hover:text-cream"
                        >
                          Resume &rarr;
                        </Link>
                      )}
                      {canResume && (
                        <form
                          action={async (formData) => {
                            if (confirm("Are you sure you want to cancel this upload session?")) {
                              await cancelAdminUploadSessionAction(null, formData);
                              window.location.href = "/admin/assets/upload";
                            }
                          }}
                        >
                          <input type="hidden" name="id" value={s.id} />
                          <button
                            type="submit"
                            className="cursor-pointer text-[11px] font-bold uppercase text-rejection-red hover:underline"
                          >
                            Cancel
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
