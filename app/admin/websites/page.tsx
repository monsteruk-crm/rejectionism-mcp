import Link from "next/link";
import { AdminServiceError } from "../_components/service-error";
import { listWebsites } from "@/lib/campaign";
import { StatusBadge } from "../_components/badge";

export const dynamic = "force-dynamic";

export default async function WebsitesListPage() {
  const result = await listWebsites({ limit: 100 });
  const websites = result.ok ? result.data.items : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-wider text-rejection-red">
            Domain Infrastructure
          </p>
          <h1 className="font-heading text-4xl font-black uppercase tracking-tight">
            Websites & Domains ({result.ok ? websites.length : "Unavailable"})
          </h1>
        </div>
        <Link
          href="/admin"
          className="text-xs font-bold uppercase tracking-wider text-ink/70 hover:text-ink"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      {!result.ok && <AdminServiceError error={result.error} />}

      <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
        {!result.ok ? (
          <p className="text-xs font-bold text-rejection-red">Register unavailable.</p>
        ) : websites.length === 0 ? (
          <p className="text-xs italic text-ink/70">No websites registered yet.</p>
        ) : (
          <ul className="divide-y divide-ink/15">
            {websites.map((site) => (
              <li key={site.id} className="py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/websites/${site.id}`}
                        className="font-mono text-base font-bold text-ink hover:text-rejection-red"
                      >
                        {site.domain}
                      </Link>
                      <StatusBadge status={site.status} />
                    </div>
                    <p className="mt-1 font-heading text-sm font-bold text-ink/90">{site.name}</p>
                    <p className="mt-1 text-xs text-ink/80">{site.purpose}</p>
                    {site.notes && (
                      <p className="mt-1 font-mono text-[11px] text-rejection-red">{site.notes}</p>
                    )}
                    {(site.deploymentUrl || site.repositoryUrl) && (
                      <div className="mt-2 flex flex-wrap gap-4 text-xs font-mono">
                        {site.deploymentUrl && (
                          <a
                            href={site.deploymentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-rejection-red underline"
                          >
                            Deployment: {site.deploymentUrl}
                          </a>
                        )}
                        {site.repositoryUrl && (
                          <a
                            href={site.repositoryUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-ink/80 underline"
                          >
                            Repo: {site.repositoryUrl}
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  <Link
                    href={`/admin/websites/${site.id}`}
                    className="shrink-0 self-start border border-ink bg-cream px-3 py-1 font-heading text-xs font-bold uppercase hover:bg-ink hover:text-cream"
                  >
                    Edit Configuration
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
