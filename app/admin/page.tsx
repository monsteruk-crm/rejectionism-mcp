import Link from "next/link";
import { getCampaignStatus } from "@/lib/campaign";
import { StatusBadge, PriorityBadge } from "./_components/badge";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const result = await getCampaignStatus();

  if (!result.ok) {
    return (
      <div className="border-4 border-blood-red bg-paper p-8 text-center text-ink">
        <h2 className="font-heading text-2xl font-bold uppercase tracking-wider text-rejection-red">
          Dashboard Unavailable
        </h2>
        <p className="mt-2 text-sm text-ink/80">{result.error.message}</p>
      </div>
    );
  }

  const {
    workItemCounts,
    inProgressWork,
    blockedWork,
    nextWorkItems,
    missingAssets,
    missingAssetsTotal,
    websites,
    recentDecisions,
    latestActivity,
  } = result.data;

  return (
    <div className="space-y-8">
      {/* Top Banner & Heading */}
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-rejection-red">
            Command Dashboard
          </p>
          <h1 className="font-heading text-4xl font-black uppercase tracking-tight sm:text-5xl">
            Campaign Operations
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/work-items"
            className="border border-ink bg-ink px-4 py-2 font-heading text-xs font-bold uppercase tracking-widest text-cream hover:bg-rejection-red"
          >
            + Work Item
          </Link>
          <Link
            href="/admin/decisions"
            className="border border-ink bg-paper px-4 py-2 font-heading text-xs font-bold uppercase tracking-widest text-ink hover:bg-ink hover:text-cream"
          >
            Record Decision
          </Link>
        </div>
      </div>

      {/* Status Counters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total", count: workItemCounts.TOTAL, href: "/admin/work-items" },
          {
            label: "In Progress",
            count: workItemCounts.IN_PROGRESS,
            href: "/admin/work-items?status=IN_PROGRESS",
            highlight: workItemCounts.IN_PROGRESS > 0,
          },
          {
            label: "Next",
            count: workItemCounts.NEXT,
            href: "/admin/work-items?status=NEXT",
          },
          {
            label: "Blocked",
            count: workItemCounts.BLOCKED,
            href: "/admin/work-items?status=BLOCKED",
            alert: workItemCounts.BLOCKED > 0,
          },
          {
            label: "Backlog",
            count: workItemCounts.BACKLOG,
            href: "/admin/work-items?status=BACKLOG",
          },
          {
            label: "Done",
            count: workItemCounts.DONE,
            href: "/admin/work-items?status=DONE",
          },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`flex flex-col justify-between border-2 border-ink p-4 transition-transform hover:-translate-y-0.5 ${
              item.alert
                ? "bg-blood-red text-cream"
                : item.highlight
                  ? "bg-rejection-red text-cream"
                  : "bg-paper text-ink"
            }`}
          >
            <span className="font-heading text-xs font-bold uppercase tracking-wider opacity-80">
              {item.label}
            </span>
            <span className="mt-2 font-heading text-3xl font-black">{item.count}</span>
          </Link>
        ))}
      </div>

      {/* Main Grid: Now & Next / Blocked & Missing */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* NOW: In Progress Work */}
        <section className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
          <div className="flex items-center justify-between border-b-2 border-ink pb-3">
            <h2 className="font-heading text-xl font-black uppercase tracking-wider text-ink">
              Now // In Progress
            </h2>
            <Link
              href="/admin/work-items?status=IN_PROGRESS"
              className="text-xs font-bold uppercase tracking-wider text-rejection-red hover:underline"
            >
              View All ({workItemCounts.IN_PROGRESS})
            </Link>
          </div>

          {inProgressWork.length === 0 ? (
            <p className="mt-4 text-xs italic text-ink/70">No work currently in progress.</p>
          ) : (
            <ul className="mt-4 divide-y divide-ink/20">
              {inProgressWork.map((item) => (
                <li key={item.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/admin/work-items/${item.id}`}
                      className="font-heading text-sm font-bold text-ink hover:text-rejection-red"
                    >
                      {item.title}
                    </Link>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <PriorityBadge priority={item.priority} />
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                  {item.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-ink/80">{item.description}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* NEXT: Next Priority Moves */}
        <section className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
          <div className="flex items-center justify-between border-b-2 border-ink pb-3">
            <h2 className="font-heading text-xl font-black uppercase tracking-wider text-ink">
              Next // Top Moves
            </h2>
            <Link
              href="/admin/work-items?status=NEXT"
              className="text-xs font-bold uppercase tracking-wider text-rejection-red hover:underline"
            >
              View All ({workItemCounts.NEXT})
            </Link>
          </div>

          {nextWorkItems.length === 0 ? (
            <p className="mt-4 text-xs italic text-ink/70">No items marked NEXT.</p>
          ) : (
            <ul className="mt-4 divide-y divide-ink/20">
              {nextWorkItems.map((item) => (
                <li key={item.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/admin/work-items/${item.id}`}
                      className="font-heading text-sm font-bold text-ink hover:text-rejection-red"
                    >
                      {item.title}
                    </Link>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <PriorityBadge priority={item.priority} />
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                  {item.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-ink/80">{item.description}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* BLOCKED */}
        <section className="border-2 border-blood-red bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(140,10,28,1)]">
          <div className="flex items-center justify-between border-b-2 border-blood-red pb-3">
            <h2 className="font-heading text-xl font-black uppercase tracking-wider text-rejection-red">
              Blocked Work
            </h2>
            <Link
              href="/admin/work-items?status=BLOCKED"
              className="text-xs font-bold uppercase tracking-wider text-rejection-red hover:underline"
            >
              View All ({workItemCounts.BLOCKED})
            </Link>
          </div>

          {blockedWork.length === 0 ? (
            <p className="mt-4 text-xs italic text-ink/70">No items currently blocked.</p>
          ) : (
            <ul className="mt-4 divide-y divide-ink/20">
              {blockedWork.map((item) => (
                <li key={item.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/admin/work-items/${item.id}`}
                      className="font-heading text-sm font-bold text-ink hover:text-rejection-red"
                    >
                      {item.title}
                    </Link>
                    <StatusBadge status={item.status} />
                  </div>
                  {item.blockedReason && (
                    <div className="mt-2 border-l-2 border-rejection-red bg-cream p-2 text-xs text-ink/90">
                      <strong>Blocked reason:</strong> {item.blockedReason}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* MISSING ASSETS */}
        <section className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
          <div className="flex items-center justify-between border-b-2 border-ink pb-3">
            <h2 className="font-heading text-xl font-black uppercase tracking-wider text-ink">
              Missing Visuals & Deliverables
            </h2>
            <Link
              href="/admin/assets?status=MISSING"
              className="text-xs font-bold uppercase tracking-wider text-rejection-red hover:underline"
            >
              View All ({missingAssetsTotal})
            </Link>
          </div>

          {missingAssets.length === 0 ? (
            <p className="mt-4 text-xs italic text-ink/70">No assets marked as MISSING.</p>
          ) : (
            <ul className="mt-4 divide-y divide-ink/20">
              {missingAssets.slice(0, 6).map((asset) => (
                <li key={asset.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/admin/assets/${asset.id}`}
                      className="font-heading text-sm font-bold text-ink hover:text-rejection-red"
                    >
                      {asset.name}
                    </Link>
                    <span className="font-mono text-[10px] uppercase text-ink/70">
                      {asset.kind}
                    </span>
                  </div>
                  {asset.notes && (
                    <p className="mt-1 line-clamp-1 text-xs text-ink/70">{asset.notes}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Lower Section: Websites & Decisions */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Websites Status */}
        <section className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
          <div className="flex items-center justify-between border-b-2 border-ink pb-3">
            <h2 className="font-heading text-xl font-black uppercase tracking-wider text-ink">
              Websites & Domains
            </h2>
            <Link
              href="/admin/websites"
              className="text-xs font-bold uppercase tracking-wider text-rejection-red hover:underline"
            >
              Manage ({websites.length})
            </Link>
          </div>

          <ul className="mt-4 divide-y divide-ink/20">
            {websites.map((site) => (
              <li key={site.id} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/admin/websites/${site.id}`}
                    className="font-mono text-sm font-bold text-ink hover:text-rejection-red"
                  >
                    {site.domain}
                  </Link>
                  <StatusBadge status={site.status} />
                </div>
                <p className="mt-1 text-xs text-ink/80">{site.name}</p>
                {site.notes && <p className="mt-1 text-[11px] text-ink/60">{site.notes}</p>}
              </li>
            ))}
          </ul>
        </section>

        {/* Recent Decisions */}
        <section className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
          <div className="flex items-center justify-between border-b-2 border-ink pb-3">
            <h2 className="font-heading text-xl font-black uppercase tracking-wider text-ink">
              Recent Decisions
            </h2>
            <Link
              href="/admin/decisions"
              className="text-xs font-bold uppercase tracking-wider text-rejection-red hover:underline"
            >
              All Decisions ({recentDecisions.length})
            </Link>
          </div>

          {recentDecisions.length === 0 ? (
            <p className="mt-4 text-xs italic text-ink/70">No decisions recorded yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-ink/20">
              {recentDecisions.map((dec) => (
                <li key={dec.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/admin/decisions/${dec.id}`}
                      className="font-heading text-sm font-bold text-ink hover:text-rejection-red"
                    >
                      {dec.subject}
                    </Link>
                    {dec.supersededById && (
                      <span className="border border-ink/40 bg-paper px-1.5 py-0.5 font-heading text-[10px] uppercase text-ink/60">
                        Superseded
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ink/80 line-clamp-2">{dec.decision}</p>
                  <p className="mt-1 text-[10px] text-ink/50">
                    Decided: {new Date(dec.decidedAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Activity Feed */}
      <section className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
        <div className="flex items-center justify-between border-b-2 border-ink pb-3">
          <h2 className="font-heading text-xl font-black uppercase tracking-wider text-ink">
            Audit Activity Feed
          </h2>
          <span className="font-mono text-xs text-ink/60">
            Latest {latestActivity.length} events
          </span>
        </div>

        {latestActivity.length === 0 ? (
          <p className="mt-4 text-xs italic text-ink/70">No activity recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-ink/30 font-heading uppercase text-ink/60">
                <tr>
                  <th className="py-2 pr-4">Timestamp</th>
                  <th className="py-2 pr-4">Entity</th>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {latestActivity.map((act) => (
                  <tr key={act.id} className="hover:bg-cream">
                    <td className="py-2 pr-4 text-ink/60 whitespace-nowrap">
                      {new Date(act.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 font-bold text-ink whitespace-nowrap">
                      {act.entityType}
                    </td>
                    <td className="py-2 pr-4 text-rejection-red whitespace-nowrap">{act.action}</td>
                    <td className="py-2 text-ink/90">{act.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
