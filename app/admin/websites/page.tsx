import { requireAdminPage } from "@/lib/auth/boundaries";
import Link from "next/link";
import { AdminServiceError } from "../_components/service-error";
import { listWebsites } from "@/lib/campaign";
import { StatusBadge } from "../_components/badge";
import { createWebsiteAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function WebsitesListPage() {
  await requireAdminPage();
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

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Websites List */}
        <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)] lg:col-span-2">
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

        {/* Register Website Form */}
        <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
          <h2 className="border-b-2 border-ink pb-2 font-heading text-xl font-black uppercase">
            Register Domain
          </h2>

          <form action={createWebsiteAction} className="mt-4 space-y-4 text-xs font-sans">
            <div>
              <label htmlFor="domain" className="block font-heading font-bold uppercase text-ink">
                Domain Name *
              </label>
              <input
                type="text"
                id="domain"
                name="domain"
                required
                maxLength={200}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="e.g. rejectionism.com"
              />
            </div>

            <div>
              <label htmlFor="name" className="block font-heading font-bold uppercase text-ink">
                Site Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                maxLength={200}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="e.g. Primary Satirical Portal"
              />
            </div>

            <div>
              <label htmlFor="purpose" className="block font-heading font-bold uppercase text-ink">
                Purpose *
              </label>
              <textarea
                id="purpose"
                name="purpose"
                required
                rows={2}
                maxLength={20000}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="Role in the satirical campaign"
              />
            </div>

            <div>
              <label htmlFor="status" className="block font-heading font-bold uppercase text-ink">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue="UNKNOWN"
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              >
                <option value="PLANNED">PLANNED</option>
                <option value="RESERVED">RESERVED</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="LIVE">LIVE</option>
                <option value="REDIRECT">REDIRECT</option>
                <option value="UNKNOWN">UNKNOWN</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="repositoryUrl"
                className="block font-heading font-bold uppercase text-ink"
              >
                Repository URL
              </label>
              <input
                type="url"
                id="repositoryUrl"
                name="repositoryUrl"
                maxLength={2048}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="https://github.com/..."
              />
            </div>

            <div>
              <label
                htmlFor="deploymentUrl"
                className="block font-heading font-bold uppercase text-ink"
              >
                Deployment URL
              </label>
              <input
                type="url"
                id="deploymentUrl"
                name="deploymentUrl"
                maxLength={2048}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="https://..."
              />
            </div>

            <div>
              <label htmlFor="notes" className="block font-heading font-bold uppercase text-ink">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                maxLength={20000}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="DNS setup, hosting notes"
              />
            </div>

            <button
              type="submit"
              className="w-full border-2 border-ink bg-ink py-2 font-heading text-xs font-bold uppercase tracking-widest text-cream hover:bg-rejection-red"
            >
              Register Domain
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
