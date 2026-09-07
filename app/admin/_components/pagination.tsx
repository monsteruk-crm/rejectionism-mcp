"use client";

import Link from "next/link";

export interface PaginationProps {
  total: number;
  limit?: number;
  offset: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
}

export function Pagination({
  total,
  limit = 25,
  offset,
  basePath,
  searchParams = {},
}: PaginationProps) {
  if (total <= limit && offset === 0) {
    return null;
  }

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startItem = total === 0 ? 0 : offset + 1;
  const endItem = Math.min(total, offset + limit);

  const createPageUrl = (pageOffset: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== "" && key !== "offset") {
        params.set(key, value);
      }
    }
    if (pageOffset > 0) {
      params.set("offset", String(pageOffset));
    }
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const prevOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;
  const hasPrev = offset > 0;
  const hasNext = nextOffset < total;

  return (
    <div className="flex flex-col items-center justify-between gap-4 border-2 border-ink bg-paper p-4 font-heading sm:flex-row">
      <div className="text-xs uppercase text-ink/80">
        Showing <span className="font-bold text-ink">{startItem}</span> to{" "}
        <span className="font-bold text-ink">{endItem}</span> of{" "}
        <span className="font-bold text-ink">{total}</span> records (Page {currentPage} of {totalPages})
      </div>

      <div className="flex items-center gap-2">
        {hasPrev ? (
          <Link
            href={createPageUrl(prevOffset)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center border-2 border-ink bg-cream px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink transition-colors hover:bg-ink hover:text-cream"
          >
            &larr; Prev
          </Link>
        ) : (
          <span className="flex min-h-[44px] min-w-[44px] cursor-not-allowed items-center justify-center border-2 border-ink/20 bg-cream/40 px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink/40">
            &larr; Prev
          </span>
        )}

        {hasNext ? (
          <Link
            href={createPageUrl(nextOffset)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center border-2 border-ink bg-cream px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink transition-colors hover:bg-ink hover:text-cream"
          >
            Next &rarr;
          </Link>
        ) : (
          <span className="flex min-h-[44px] min-w-[44px] cursor-not-allowed items-center justify-center border-2 border-ink/20 bg-cream/40 px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink/40">
            Next &rarr;
          </span>
        )}
      </div>
    </div>
  );
}
