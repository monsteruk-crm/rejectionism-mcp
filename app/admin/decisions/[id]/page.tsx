import Link from "next/link";
import { AdminServiceError } from "../../_components/service-error";
import { notFound } from "next/navigation";
import { getDecisionById } from "@/lib/campaign";

export const dynamic = "force-dynamic";

export default async function DecisionDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const result = await getDecisionById(params.id);

  if (!result.ok) {
    if (result.error.code === "NOT_FOUND") {
      notFound();
    }

    return <AdminServiceError error={result.error} />;
  }

  const dec = result.data;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-wider text-rejection-red">
            Decision Record // ID: {dec.id}
          </p>
          <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
            {dec.subject}
          </h1>
        </div>
        <Link
          href="/admin/decisions"
          className="text-xs font-bold uppercase tracking-wider text-ink/70 hover:text-ink"
        >
          &larr; All Decisions
        </Link>
      </div>

      <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
        <div className="mb-6 flex items-center justify-between border-b border-ink/20 pb-3">
          <span className="font-mono text-xs text-ink/60">
            Decided: {new Date(dec.decidedAt).toLocaleString()}
          </span>
          {dec.supersededById ? (
            <span className="border border-ink/40 bg-paper px-2 py-0.5 font-heading text-xs font-bold uppercase text-ink/60">
              Superseded by #{dec.supersededById}
            </span>
          ) : (
            <span className="border border-ink bg-ink px-2 py-0.5 font-heading text-xs font-bold uppercase text-cream">
              Active Decision
            </span>
          )}
        </div>

        <div className="space-y-6 text-xs font-sans">
          <div>
            <h3 className="font-heading text-sm font-bold uppercase text-ink">Subject</h3>
            <p className="mt-1 font-heading text-lg font-bold text-ink">{dec.subject}</p>
          </div>

          <div>
            <h3 className="font-heading text-sm font-bold uppercase text-ink">Decision</h3>
            <div className="mt-1 border border-ink/20 bg-cream p-3 text-sm text-ink/90">
              {dec.decision}
            </div>
          </div>

          <div>
            <h3 className="font-heading text-sm font-bold uppercase text-ink">Rationale</h3>
            <div className="mt-1 border border-ink/20 bg-cream p-3 text-xs text-ink/80">
              {dec.rationale}
            </div>
          </div>

          {dec.supersedesId && (
            <div className="border-t border-ink/20 pt-4">
              <h3 className="font-heading text-xs font-bold uppercase text-rejection-red">
                Lineage // Supersedes
              </h3>
              <p className="mt-1 font-mono text-xs">
                Earlier Decision:{" "}
                <Link
                  href={`/admin/decisions/${dec.supersedesId}`}
                  className="underline hover:text-rejection-red"
                >
                  #{dec.supersedesId}
                </Link>
              </p>
            </div>
          )}

          {dec.supersededById && (
            <div className="border-t border-ink/20 pt-4">
              <h3 className="font-heading text-xs font-bold uppercase text-rejection-red">
                Lineage // Superseded By
              </h3>
              <p className="mt-1 font-mono text-xs">
                Successor Decision:{" "}
                <Link
                  href={`/admin/decisions/${dec.supersededById}`}
                  className="underline hover:text-rejection-red"
                >
                  #{dec.supersededById}
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
