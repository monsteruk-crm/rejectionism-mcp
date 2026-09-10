import { requireAdminPage } from "@/lib/auth/boundaries";
import Link from "next/link";
import { AdminServiceError } from "../_components/service-error";
import { listDecisions } from "@/lib/campaign";
import { RecordDecisionForm } from "../_components/forms/decision-form";
import { Pagination } from "../_components/pagination";

export const dynamic = "force-dynamic";

export default async function DecisionsListPage(props: {
  searchParams: Promise<{ offset?: string }>;
}) {
  await requireAdminPage();
  const searchParams = await props.searchParams;
  const offset = searchParams.offset ? Math.max(0, parseInt(searchParams.offset, 10) || 0) : 0;

  const result = await listDecisions({ limit: 25, offset });
  const decisions = result.ok ? result.data.items : [];
  const total = result.ok ? result.data.total : 0;

  // Active (non-superseded) decisions available for supersession
  const activeDecisions = decisions.filter((d) => !d.supersededById);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-wider text-rejection-red">
            Governance & Strategy
          </p>
          <h1 className="font-heading text-4xl font-black uppercase tracking-tight">
            Decisions Log ({result.ok ? decisions.length : "Unavailable"})
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
        {/* Decisions List */}
        <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)] lg:col-span-2">
          {!result.ok ? (
            <p className="text-xs font-bold text-rejection-red">Register unavailable.</p>
          ) : decisions.length === 0 ? (
            <p className="text-xs italic text-ink/70">No decisions recorded yet.</p>
          ) : (
            <ul className="divide-y divide-ink/15">
              {decisions.map((dec) => (
                <li key={dec.id} className="py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/admin/decisions/${dec.id}`}
                        className="font-heading text-base font-bold text-ink hover:text-rejection-red"
                      >
                        {dec.subject}
                      </Link>
                      <p className="font-mono text-[11px] text-ink/50">
                        Decided: {new Date(dec.decidedAt).toLocaleDateString()} {" // ID: "}
                        {dec.id}
                      </p>
                    </div>
                    {dec.supersededById ? (
                      <span className="border border-ink/40 bg-paper px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-ink/60">
                        Superseded
                      </span>
                    ) : (
                      <span className="border border-ink bg-ink px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-cream">
                        Active
                      </span>
                    )}
                  </div>

                  <div className="mt-2 space-y-1 text-xs text-ink/90">
                    <p>
                      <strong>Decision:</strong> {dec.decision}
                    </p>
                    <p className="text-ink/80">
                      <strong>Rationale:</strong> {dec.rationale}
                    </p>
                  </div>

                  {dec.supersedesId && (
                    <p className="mt-2 text-[11px] font-semibold text-rejection-red">
                      Supersedes:{" "}
                      <Link
                        href={`/admin/decisions/${dec.supersedesId}`}
                        className="underline hover:text-blood-red"
                      >
                        Decision #{dec.supersedesId}
                      </Link>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {result.ok && (
            <div className="mt-4 border-t border-ink/20 pt-4">
              <Pagination
                total={total}
                limit={25}
                offset={offset}
                basePath="/admin/decisions"
                searchParams={searchParams}
              />
            </div>
          )}
        </div>

        {/* Record Decision Form */}
        <RecordDecisionForm />
      </div>
    </div>
  );
}
