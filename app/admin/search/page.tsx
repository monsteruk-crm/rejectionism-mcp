import { requireAdminPage } from "@/lib/auth/boundaries";
import Link from "next/link";
import { AdminServiceError } from "../_components/service-error";
import { searchCampaign, OriginalEntityType } from "@/lib/campaign";
import { StatusBadge } from "../_components/badge";

export const dynamic = "force-dynamic";

const ALL_TYPES: Array<{ label: string; value: OriginalEntityType }> = [
  { label: "Work Items", value: "WORK_ITEM" },
  { label: "Canon", value: "CANON_ENTRY" },
  { label: "Decisions", value: "DECISION" },
  { label: "Assets", value: "ASSET" },
  { label: "Websites", value: "WEBSITE" },
  { label: "Content", value: "CONTENT_ITEM" },
  { label: "Contacts", value: "CONTACT" },
];

export default async function GlobalSearchPage(props: {
  searchParams: Promise<{
    q?: string;
    types?: string;
    tags?: string;
  }>;
}) {
  await requireAdminPage();
  const searchParams = await props.searchParams;
  const q = searchParams.q ? searchParams.q.trim() : "";
  const typesParam = searchParams.types;
  const tagsParam = searchParams.tags;

  const selectedTypes = typesParam
    ? (typesParam.split(",").map((t) => t.trim()).filter(Boolean) as OriginalEntityType[])
    : undefined;

  const selectedTags = tagsParam
    ? tagsParam.split(",").map((t) => t.trim()).filter(Boolean)
    : undefined;

  let searchResult = null;
  if (q.length > 0) {
    searchResult = await searchCampaign({
      query: q,
      entityTypes: selectedTypes,
      tags: selectedTags,
      limit: 50,
    });
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-wider text-rejection-red">
            Global Knowledge Discovery
          </p>
          <h1 className="font-heading text-4xl font-black uppercase tracking-tight">
            Search CampaignOS
          </h1>
        </div>
        <Link
          href="/admin"
          className="text-xs font-bold uppercase tracking-wider text-ink/70 hover:text-ink"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      {/* Search Input Form */}
      <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
        <form method="GET" action="/admin/search" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              name="q"
              defaultValue={q}
              required
              placeholder="Search by keywords, title, key, notes, filenames, or tag slugs..."
              className="flex-1 border-2 border-ink bg-cream p-2.5 font-sans text-sm text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
            <button
              type="submit"
              className="border-2 border-ink bg-ink px-6 py-2.5 font-heading text-xs font-bold uppercase tracking-widest text-cream hover:bg-rejection-red"
            >
              Search
            </button>
          </div>

          {/* Type Filters */}
          <div className="flex flex-wrap items-center gap-2 border-t border-ink/15 pt-3 font-heading text-xs uppercase">
            <span className="font-bold text-ink/70">Registers:</span>
            {ALL_TYPES.map((type) => {
              const isSelected = selectedTypes ? selectedTypes.includes(type.value) : false;

              // Toggle type in search query
              let nextTypes: OriginalEntityType[];
              if (!selectedTypes || selectedTypes.length === 0) {
                nextTypes = [type.value];
              } else if (isSelected) {
                nextTypes = selectedTypes.filter((t) => t !== type.value);
              } else {
                nextTypes = [...selectedTypes, type.value];
              }

              const params = new URLSearchParams();
              if (q) params.set("q", q);
              if (tagsParam) params.set("tags", tagsParam);
              if (nextTypes.length > 0 && nextTypes.length < ALL_TYPES.length) {
                params.set("types", nextTypes.join(","));
              }

              const href = `/admin/search?${params.toString()}`;

              return (
                <Link
                  key={type.value}
                  href={href}
                  className={`border px-2.5 py-0.5 font-bold transition-colors ${
                    isSelected
                      ? "border-ink bg-ink text-cream"
                      : "border-ink/30 bg-cream text-ink hover:border-ink"
                  }`}
                >
                  {type.label}
                </Link>
              );
            })}

            {(selectedTypes || selectedTags) && (
              <Link
                href={q ? `/admin/search?q=${encodeURIComponent(q)}` : "/admin/search"}
                className="border border-ink/20 bg-cream px-2 py-0.5 text-ink/60 hover:text-ink"
              >
                Clear Filters
              </Link>
            )}
          </div>
        </form>
      </div>

      {/* Search Results / Instructions */}
      {q.length === 0 ? (
        <div className="border-2 border-ink bg-cream p-8 text-center font-sans text-xs text-ink/70">
          <p className="font-heading text-base font-bold uppercase text-ink">
            Enter a query above to search all seven registers
          </p>
          <p className="mt-1">
            Searches Work Items, Canon Facts, Decisions, Visual Assets, Websites, Content Items,
            Contacts, and Tag associations.
          </p>
        </div>
      ) : searchResult && !searchResult.ok ? (
        <AdminServiceError error={searchResult.error} />
      ) : searchResult && searchResult.ok ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-ink/20 pb-2">
            <h2 className="font-heading text-lg font-black uppercase text-ink">
              Search Results ({searchResult.data.total})
            </h2>
            <span className="font-mono text-xs text-ink/60">
              Query: &quot;{q}&quot;
            </span>
          </div>

          {searchResult.data.items.length === 0 ? (
            <div className="border-2 border-ink bg-paper p-12 text-center font-sans">
              <p className="font-heading text-base font-bold uppercase text-ink/70">
                No matching records found.
              </p>
              <p className="mt-1 text-xs text-ink/50">
                Try searching for broader keywords or clearing the register filters above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {searchResult.data.items.map((item) => (
                <div
                  key={`${item.entityType}-${item.id}`}
                  className="flex flex-col gap-3 border-2 border-ink bg-paper p-5 shadow-[3px_3px_0px_0px_rgba(13,13,13,1)] sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="border border-ink bg-ink px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-cream">
                        {item.entityType.replace(/_/g, " ")}
                      </span>
                      {item.status && <StatusBadge status={item.status} />}
                      <span className="font-mono text-[10px] text-ink/50">
                        Updated: {new Date(item.updatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <Link
                      href={item.href}
                      className="inline-block font-heading text-base font-black uppercase tracking-tight text-ink hover:text-rejection-red"
                    >
                      {item.title}
                    </Link>

                    {item.snippet && (
                      <p className="font-sans text-xs text-ink/80 leading-relaxed">
                        {item.snippet}
                      </p>
                    )}

                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {item.tags.map((t) => (
                          <span
                            key={t}
                            className="border border-ink/20 bg-cream px-1.5 py-0.5 font-mono text-[10px] text-ink/70"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <Link
                    href={item.href}
                    className="shrink-0 self-start border border-ink bg-cream px-3 py-1 font-heading text-xs font-bold uppercase hover:bg-ink hover:text-cream"
                  >
                    View &rarr;
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
