import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/boundaries";
import {
  listMemories,
  getMemoryHealth,
  type MemoryListOutputDto,
  type MemoryHealth,
} from "@/lib/campaign/memories";
import { MemoryListPageClient } from "./_components/memory-list-page-client";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    status?: string;
    pinned?: string;
    tag?: string;
    minImportance?: string;
    expiry?: string;
    sort?: string;
    offset?: string;
  }>;
}

const CATEGORY_OPTIONS = [
  "PREFERENCE",
  "CONTEXT",
  "INSTRUCTION",
  "LESSON",
  "PERSON",
  "PROJECT",
  "STYLE",
  "PROCESS",
  "TECHNICAL",
  "REFERENCE",
  "OTHER",
];

const STATUS_OPTIONS = ["ACTIVE", "SUPERSEDED", "ARCHIVED", "ALL"];

const SORT_OPTIONS = [
  { value: "UPDATED_DESC", label: "Recently updated" },
  { value: "IMPORTANCE_DESC", label: "Importance" },
  { value: "ACCESSED_DESC", label: "Recently accessed" },
  { value: "CREATED_ASC", label: "Oldest" },
  { value: "RELEVANCE", label: "Relevance" },
];

const SORT_VALUE_SET = new Set(SORT_OPTIONS.map((o) => o.value));

export default async function AdminMemoryPage({ searchParams }: PageProps) {
  await requireAdminPage();
  const params = await searchParams;

  const status = (params.status && STATUS_OPTIONS.includes(params.status))
    ? (params.status as "ACTIVE" | "SUPERSEDED" | "ARCHIVED" | "ALL")
    : "ALL";
  const expiryMode =
    params.expiry === "EXPIRED"
      ? "EXPIRED"
      : params.expiry === "ALL"
        ? "ALL"
        : "CURRENT";
  const sortRaw = params.sort && SORT_VALUE_SET.has(params.sort) ? params.sort : "UPDATED_DESC";

  const coercedListInput = {
    search: (params.q ?? "").trim() || undefined,
    category: params.category && CATEGORY_OPTIONS.includes(params.category) ? params.category : undefined,
    status,
    pinned:
      params.pinned === "yes" ? true : params.pinned === "no" ? false : undefined,
    tag: params.tag || undefined,
    minImportance: params.minImportance
      ? Math.min(100, Math.max(0, Number.parseInt(params.minImportance, 10)))
      : undefined,
    includeExpired: expiryMode !== "CURRENT",
    expiredOnly: expiryMode === "EXPIRED",
    sort: sortRaw,
    offset: params.offset ? Number.parseInt(params.offset, 10) || 0 : 0,
  };

  const listResult = await listMemories(coercedListInput);
  const healthResult = await getMemoryHealth();

  const fallback: MemoryListOutputDto = { items: [], total: 0, limit: 25, offset: 0 };
  const items = listResult.ok ? listResult.data : fallback;
  const health: MemoryHealth | null = healthResult.ok ? healthResult.data : null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">MEMORY</h1>
        <p className="mt-1 text-sm text-slate-600">
          The durable operational memory shared by Kommissar across tools.
        </p>
      </header>

      {health ? (
        <section
          aria-label="Memory health"
          className="mb-6 grid grid-cols-3 gap-3 rounded-md border border-slate-200 bg-white p-4 text-xs sm:grid-cols-6"
        >
          <HealthStat label="Active" value={health.active} />
          <HealthStat label="Pinned" value={health.pinned} />
          <HealthStat label="Superseded" value={health.superseded} />
          <HealthStat label="Archived" value={health.archived} />
          <HealthStat label="Expired" value={health.expired} />
          <HealthStat label="Possible duplicates" value={health.possibleExactDuplicates} />
        </section>
      ) : null}

      <MemoryListPageClient
        initialItems={items}
        categoryOptions={CATEGORY_OPTIONS}
        statusOptions={STATUS_OPTIONS}
        sortOptions={SORT_OPTIONS}
        initialParams={{
          q: params.q ?? "",
          category: params.category ?? "",
          status,
          pinned: params.pinned ?? "",
          tag: params.tag ?? "",
          minImportance: params.minImportance ?? "",
          expiry: expiryMode,
          sort: sortRaw,
        }}
      />

      <p className="mt-4 text-xs text-slate-500">
        Showing {items.items.length} of {items.total} memory records.
        {items.total > items.items.length + items.offset ? " Use Next to see more." : ""}
        {!listResult.ok ? (
          <span className="ml-2 text-red-600"> Service error: {listResult.error.message}</span>
        ) : null}
      </p>

      <p className="mt-2">
        <Link href="/admin/memory/new" className="text-sm text-blue-700 underline">
          + New Memory
        </Link>
      </p>
    </main>
  );
}

function HealthStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center sm:text-left">
      <div className="text-sm font-semibold text-slate-900">{value}</div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
