"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { MemorySummaryDto } from "@/lib/campaign/memory-schemas";

export interface MemoryListPageClientProps {
  initialItems: { items: MemorySummaryDto[]; total: number; limit: number; offset: number };
  initialParams: {
    q: string;
    category: string;
    status: string;
    pinned: string;
    tag: string;
    minImportance: string;
    expiry: string;
    sort: string;
  };
  categoryOptions: string[];
  statusOptions: string[];
  sortOptions: { value: string; label: string }[];
}

export function MemoryListPageClient({
  initialItems,
  initialParams,
  categoryOptions,
  statusOptions,
  sortOptions,
}: MemoryListPageClientProps) {
  const [params, setParams] = useState(initialParams);
  const [, startTransition] = useTransition();

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const url = new URL(window.location.href);
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, String(v));
      else url.searchParams.delete(k);
    });
    url.searchParams.delete("offset");
    startTransition(() => {
      window.location.href = url.toString();
    });
  };

  return (
    <form onSubmit={onSubmit} className="mb-4 grid gap-3 rounded-md border border-slate-200 bg-white p-4 text-sm sm:grid-cols-2 md:grid-cols-4">
      <label className="block sm:col-span-2 md:col-span-2">
        <span className="block text-xs uppercase text-slate-500">Search</span>
        <input
          type="search"
          value={params.q}
          onChange={(e) => setParams({ ...params, q: e.target.value })}
          placeholder="Search memories…"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <label className="block">
        <span className="block text-xs uppercase text-slate-500">Category</span>
        <select
          value={params.category}
          onChange={(e) => setParams({ ...params, category: e.target.value })}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        >
          <option value="">All</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="block text-xs uppercase text-slate-500">Status</span>
        <select
          value={params.status}
          onChange={(e) => setParams({ ...params, status: e.target.value })}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="block text-xs uppercase text-slate-500">Pinned</span>
        <select
          value={params.pinned}
          onChange={(e) => setParams({ ...params, pinned: e.target.value })}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        >
          <option value="">Any</option>
          <option value="yes">Pinned</option>
          <option value="no">Not pinned</option>
        </select>
      </label>
      <label className="block">
        <span className="block text-xs uppercase text-slate-500">Tag slug</span>
        <input
          type="text"
          value={params.tag}
          onChange={(e) => setParams({ ...params, tag: e.target.value })}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <label className="block">
        <span className="block text-xs uppercase text-slate-500">Min importance</span>
        <input
          type="number"
          min={0}
          max={100}
          value={params.minImportance}
          onChange={(e) => setParams({ ...params, minImportance: e.target.value })}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <label className="block">
        <span className="block text-xs uppercase text-slate-500">Expiry</span>
        <select
          value={params.expiry}
          onChange={(e) => setParams({ ...params, expiry: e.target.value })}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        >
          <option value="CURRENT">Current</option>
          <option value="ALL">All</option>
          <option value="EXPIRED">Expired only</option>
        </select>
      </label>
      <label className="block">
        <span className="block text-xs uppercase text-slate-500">Sort</span>
        <select
          value={params.sort}
          onChange={(e) => setParams({ ...params, sort: e.target.value })}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <div className="flex items-end gap-2">
        <button type="submit" className="rounded bg-slate-900 px-3 py-1 text-sm text-white">
          Apply
        </button>
        <Link href="/admin/memory" className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700">
          Reset
        </Link>
      </div>
    </form>
  );
}
