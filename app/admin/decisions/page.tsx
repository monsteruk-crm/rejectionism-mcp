import { requireAdminPage } from "@/lib/auth/boundaries";
import Link from "next/link";
import { AdminServiceError } from "../_components/service-error";
import { listDecisions } from "@/lib/campaign";
import { recordDecisionAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function DecisionsListPage() {
  await requireAdminPage();
  const result = await listDecisions({ limit: 100 });
  const decisions = result.ok ? result.data.items : [];

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
        </div>

        {/* Record Decision Form */}
        <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
          <h2 className="border-b-2 border-ink pb-2 font-heading text-xl font-black uppercase">
            Record Decision
          </h2>

          <form action={recordDecisionAction} className="mt-4 space-y-4 text-xs font-sans">
            <div>
              <label htmlFor="subject" className="block font-heading font-bold uppercase text-ink">
                Subject *
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                required
                maxLength={200}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="e.g. Primary Seal Recommendation"
              />
            </div>

            <div>
              <label htmlFor="decision" className="block font-heading font-bold uppercase text-ink">
                Decision *
              </label>
              <textarea
                id="decision"
                name="decision"
                required
                rows={3}
                maxLength={20000}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="What was decided"
              />
            </div>

            <div>
              <label
                htmlFor="rationale"
                className="block font-heading font-bold uppercase text-ink"
              >
                Rationale *
              </label>
              <textarea
                id="rationale"
                name="rationale"
                required
                rows={3}
                maxLength={20000}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="Why this was decided"
              />
            </div>

            <div>
              <label
                htmlFor="supersedesId"
                className="block font-heading font-bold uppercase text-ink"
              >
                Supersedes Previous Decision (Optional)
              </label>
              <select
                id="supersedesId"
                name="supersedesId"
                defaultValue=""
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-sans text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              >
                <option value="">None (New Standalone Decision)</option>
                {activeDecisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    #{d.id.slice(-8)} — {d.subject}
                  </option>
                ))}
              </select>
            </div>

            {/* Optional Canon Update Section */}
            <div className="border-t-2 border-ink/20 pt-3">
              <label className="block font-heading font-bold uppercase text-ink">
                Atomic Canon Update (Optional)
              </label>
              <select
                name="updateCanonMode"
                defaultValue=""
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-sans text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              >
                <option value="">Do Not Modify Canon</option>
                <option value="create">Create New Canon Entry</option>
                <option value="update">Update Existing Canon Entry</option>
              </select>

              <div className="mt-3 space-y-2 border border-ink/20 bg-cream/50 p-2 text-[11px]">
                <p className="font-heading font-bold uppercase text-ink/70">
                  Canon Payload (if creating/updating):
                </p>
                <input
                  type="text"
                  name="canonKey"
                  placeholder="Key (e.g. movement.slogan)"
                  className="w-full border border-ink/30 bg-cream p-1.5 font-mono text-xs"
                />
                <textarea
                  name="canonValue"
                  rows={2}
                  placeholder="Canonical Value"
                  className="w-full border border-ink/30 bg-cream p-1.5 text-xs"
                />
                <input
                  type="text"
                  name="canonCategory"
                  placeholder="Category (e.g. identity, founders)"
                  className="w-full border border-ink/30 bg-cream p-1.5 text-xs"
                />
                <input
                  type="number"
                  name="canonExpectedVersion"
                  placeholder="Expected Version (if updating)"
                  className="w-full border border-ink/30 bg-cream p-1.5 font-mono text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full border-2 border-ink bg-ink py-2 font-heading text-xs font-bold uppercase tracking-widest text-cream hover:bg-rejection-red"
            >
              Record Decision
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
