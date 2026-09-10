"use client";

import { useState, useTransition } from "react";
import {
  supersedeMemoryAction,
  archiveMemoryAction,
} from "../actions";
import type { MemoryDto } from "@/lib/campaign/memory-schemas";

export function DependencyForms({
  memory,
  categoryOptions,
}: {
  memory: MemoryDto;
  categoryOptions: string[];
}) {
  return (
    <section className="mb-8 grid gap-6">
      {memory.status === "ACTIVE" || memory.status === "ARCHIVED" ? (
        <SupersedeForm memory={memory} categoryOptions={categoryOptions} />
      ) : null}
      {memory.status === "ACTIVE" ? (
        <ArchiveForm memory={memory} />
      ) : null}
    </section>
  );
}

function SupersedeForm({ memory, categoryOptions }: { memory: MemoryDto; categoryOptions: string[] }) {
  const [title, setTitle] = useState(memory.title);
  const [content, setContent] = useState(memory.content);
  const [category, setCategory] = useState<string>(memory.category);
  const [importance, setImportance] = useState(memory.importance);
  const [confidence, setConfidence] = useState(memory.confidence);
  const [pinned, setPinned] = useState(memory.pinned);
  const [copyConnections, setCopyConnections] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="rounded-md border border-slate-200 bg-white p-4 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        const fd = new FormData();
        fd.set("supersedesId", memory.id);
        fd.set("expectedVersion", String(memory.version));
        fd.set("copyConnections", copyConnections ? "on" : "");
        fd.set("title", title);
        fd.set("content", content);
        fd.set("category", category);
        fd.set("importance", String(importance));
        fd.set("confidence", String(confidence));
        fd.set("pinned", pinned ? "on" : "");
        startTransition(async () => {
          try {
            await supersedeMemoryAction(fd);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Supersede failed.");
          }
        });
      }}
    >
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">
        Save as New Superseding Memory
      </h2>
      {error ? <p className="mb-2 rounded bg-red-50 p-2 text-xs text-red-700">{error}</p> : null}
      <div className="grid gap-3">
        <label className="block">
          <span className="block text-xs uppercase text-slate-500">Title (new)</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1" />
        </label>
        <label className="block">
          <span className="block text-xs uppercase text-slate-500">Content (new)</span>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} className="h-32 w-full rounded border border-slate-300 px-2 py-1" />
        </label>
        <label className="block">
          <span className="block text-xs uppercase text-slate-500">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1">
            {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={copyConnections} onChange={(e) => setCopyConnections(e.target.checked)} />
          Copy existing tags and relationships to the successor
        </label>
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded bg-slate-900 px-3 py-1 text-sm text-white disabled:opacity-60"
        >
          {pending ? "Superseding…" : "Create Superseding Memory"}
        </button>
      </div>
    </form>
  );
}

function ArchiveForm({ memory }: { memory: MemoryDto }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        if (!confirm) {
          setError("Confirm by ticking the checkbox.");
          return;
        }
        const fd = new FormData();
        fd.set("id", memory.id);
        fd.set("expectedVersion", String(memory.version));
        startTransition(async () => {
          try {
            await archiveMemoryAction(fd);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Archive failed.");
          }
        });
      }}
    >
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-amber-800">Archive Memory</h2>
      <p className="mb-3 text-xs text-amber-800">
        Marks this memory ARCHIVED. The record is retained for history and remains visible in Admin and search; it is excluded from normal recall.
      </p>
      {error ? <p className="mb-2 rounded bg-red-50 p-2 text-xs text-red-700">{error}</p> : null}
      <label className="mb-3 flex items-center gap-2 text-xs">
        <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
        I understand this changes the lifecycle of the record
      </label>
      <button
        type="submit"
        disabled={pending || !confirm}
        className="rounded bg-amber-700 px-3 py-1 text-sm text-white disabled:opacity-60"
      >
        {pending ? "Archiving…" : "Archive"}
      </button>
    </form>
  );
}
