import { requireAdminPage } from "@/lib/auth/boundaries";
import { MemoryForm } from "../_components/memory-form";

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

export default async function AdminMemoryNewPage() {
  await requireAdminPage();
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">New Memory</h1>
        <p className="mt-1 text-sm text-slate-600">
          Persist a CampaignOS memory. Forced source type ADMIN.
        </p>
      </header>
      <MemoryForm mode="create" categoryOptions={CATEGORY_OPTIONS} />
    </main>
  );
}
