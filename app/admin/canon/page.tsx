import { requireAdminPage } from "@/lib/auth/boundaries";
import Link from "next/link";
import { AdminServiceError } from "../_components/service-error";
import { getCanon } from "@/lib/campaign";
import { CreateCanonForm } from "../_components/forms/canon-form";
import { Pagination } from "../_components/pagination";

export const dynamic = "force-dynamic";

export default async function CanonListPage(props: {
  searchParams: Promise<{ category?: string; offset?: string }>;
}) {
  await requireAdminPage();
  const searchParams = await props.searchParams;
  const categoryFilter = searchParams.category;
  const offset = searchParams.offset ? Math.max(0, parseInt(searchParams.offset, 10) || 0) : 0;

  const result = await getCanon({
    category: categoryFilter,
    limit: 25,
    offset,
  });

  const items =
    result.ok && result.data.mode === "collection"
      ? result.data.items
      : result.ok && result.data.mode === "single"
        ? [result.data.entry]
        : [];

  const total =
    result.ok && result.data.mode === "collection"
      ? result.data.total
      : result.ok && result.data.mode === "single"
        ? 1
        : 0;

  const categories = Array.from(new Set(items.map((i) => i.category))).sort();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-wider text-rejection-red">
            Doctrinal Register
          </p>
          <h1 className="font-heading text-4xl font-black uppercase tracking-tight">
            Canonical Facts & Slogans
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
        {/* Canon Table */}
        <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)] lg:col-span-2">
          {!result.ok ? (
            <p className="text-xs font-bold text-rejection-red">Register unavailable.</p>
          ) : items.length === 0 ? (
            <p className="text-xs italic text-ink/70">No canonical entries registered.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-xs">
                <thead className="border-b-2 border-ink font-heading uppercase text-ink">
                  <tr>
                    <th className="py-2 pr-4">Key</th>
                    <th className="py-2 pr-4">Value</th>
                    <th className="py-2 pr-2">Category</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/15">
                  {items.map((entry) => (
                    <tr key={entry.id} className="hover:bg-cream">
                      <td className="py-3 pr-4 font-mono font-bold text-ink">{entry.key}</td>
                      <td className="py-3 pr-4 font-sans text-xs text-ink/90">
                        {entry.value}
                        {entry.notes && (
                          <p className="mt-0.5 text-[11px] text-ink/60">{entry.notes}</p>
                        )}
                      </td>
                      <td className="py-3 pr-2 font-heading uppercase text-ink/70 whitespace-nowrap">
                        {entry.category}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/canon/${entry.id}`}
                          className="border border-ink bg-cream px-2 py-1 font-heading text-[11px] font-bold uppercase hover:bg-ink hover:text-cream"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.ok && (
            <div className="mt-4 border-t border-ink/20 pt-4">
              <Pagination
                total={total}
                limit={25}
                offset={offset}
                basePath="/admin/canon"
                searchParams={searchParams}
              />
            </div>
          )}
        </div>

        {/* Create Canon Entry Form */}
        <CreateCanonForm />
      </div>
    </div>
  );
}
