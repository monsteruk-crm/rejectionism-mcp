import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/boundaries";
import { getMemory } from "@/lib/campaign/memories";
import { MemoryForm } from "../_components/memory-form";
import { DependencyForms } from "../_components/dependency-forms";
import { MemoryActivitySection } from "../_components/memory-activity-section";

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

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ outcome?: string; created?: string }>;
}

export default async function AdminMemoryDetailPage({ params, searchParams }: PageProps) {
  await requireAdminPage();
  const { id } = await params;
  const { outcome } = await searchParams;
  const result = await getMemory({ id, trackAccess: false });
  if (!result.ok) {
    if (result.error.code === "NOT_FOUND") notFound();
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Memory unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">{result.error.message}</p>
        <p className="mt-4">
          <Link href="/admin/memory" className="text-blue-700 underline">Back to list</Link>
        </p>
      </main>
    );
  }
  const detail = result.data;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{detail.memory.title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            <span className="font-mono">{detail.memory.id}</span>
            {detail.memory.key ? <> · key <code className="font-mono">{detail.memory.key}</code></> : null}
          </p>
        </div>
        <Link href="/admin/memory" className="text-sm text-slate-700 underline">
          ← back to list
        </Link>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 rounded-md border border-slate-200 bg-white p-4 text-xs sm:grid-cols-4">
        <Stat label="Status" value={detail.memory.status} />
        <Stat label="Category" value={detail.memory.category} />
        <Stat label="Importance" value={String(detail.memory.importance)} />
        <Stat label="Confidence" value={String(detail.memory.confidence)} />
        <Stat label="Pinned" value={detail.memory.pinned ? "yes" : "no"} />
        <Stat label="Version" value={String(detail.memory.version)} />
        <Stat label="Source" value={`${detail.memory.sourceType}${detail.memory.sourceLabel ? ` · ${detail.memory.sourceLabel}` : ""}`} />
        <Stat label="Updated" value={detail.memory.updatedAt} />
      </div>

      {outcome ? (
        <p className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">
          Last action outcome: <code>{outcome}</code>
        </p>
      ) : null}

      <section className="mb-8 rounded-md border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">Content</h2>
        <pre className="whitespace-pre-wrap break-words text-sm text-slate-900">{detail.memory.content}</pre>
      </section>

      {!detail.memory.isExpired && detail.memory.status === "ACTIVE" ? (
        <section className="mb-8 rounded-md border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Save Changes</h2>
          <MemoryForm
            mode="edit"
            categoryOptions={CATEGORY_OPTIONS}
            initialMemory={detail.memory}
            outcome={outcome}
          />
        </section>
      ) : (
        <p className="mb-8 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
          This memory is {detail.memory.status}
          {detail.memory.isExpired ? " and expired" : ""}. Inline editing is disabled for historical records; use the supersession form below to create a new active replacement.
        </p>
      )}

      <DependencyForms memory={detail.memory} categoryOptions={CATEGORY_OPTIONS} />

      <MemoryActivitySection memoryId={detail.memory.id} />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 break-words text-sm text-slate-900">{value}</div>
    </div>
  );
}
