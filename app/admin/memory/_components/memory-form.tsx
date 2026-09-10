"use client";

import { useState, useTransition } from "react";
import {
  createMemoryAction,
  updateMemoryAction,
} from "../actions";
import type { MemoryDto, MemoryCategory } from "@/lib/campaign/memory-schemas";

export interface MemoryFormProps {
  mode: "create" | "edit";
  categoryOptions: string[];
  initialMemory?: MemoryDto;
  outcome?: string;
}

export function MemoryForm({ mode, categoryOptions, initialMemory, outcome }: MemoryFormProps) {
  const initialTitle = initialMemory?.title ?? "";
  const initialContent = initialMemory?.content ?? "";
  const initialCategory = (initialMemory?.category ?? "OTHER") as MemoryCategory;
  const initialKey = initialMemory?.key ?? "";
  const initialImportance = initialMemory?.importance ?? 50;
  const initialConfidence = initialMemory?.confidence ?? 100;
  const initialPinned = initialMemory?.pinned ?? false;
  const initialSourceLabel = initialMemory?.sourceLabel ?? "";
  const initialSourceUrl = initialMemory?.sourceUrl ?? "";
  const initialExpiresAt = initialMemory?.expiresAt
    ? initialMemory.expiresAt.slice(0, 16)
    : "";

  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [category, setCategory] = useState<string>(initialCategory);
  const [key, setKey] = useState(initialKey);
  const [importance, setImportance] = useState(initialImportance);
  const [confidence, setConfidence] = useState(initialConfidence);
  const [pinned, setPinned] = useState(initialPinned);
  const [sourceLabel, setSourceLabel] = useState(initialSourceLabel);
  const [sourceUrl, setSourceUrl] = useState(initialSourceUrl);
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [tagsCsv, setTagsCsv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const expectedVersion = initialMemory?.version ?? 0;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        const fd = new FormData();
        fd.set("title", title);
        fd.set("content", content);
        fd.set("category", category);
        fd.set("key", key);
        fd.set("importance", String(importance));
        fd.set("confidence", String(confidence));
        fd.set("pinned", pinned ? "on" : "");
        fd.set("sourceLabel", sourceLabel);
        fd.set("sourceUrl", sourceUrl);
        if (expiresAt) {
          fd.set("expiresAt", new Date(expiresAt).toISOString());
        }
        fd.set("tagsCsv", tagsCsv);
        if (mode === "edit" && initialMemory) {
          fd.set("id", initialMemory.id);
          fd.set("expectedVersion", String(expectedVersion));
          startTransition(async () => {
            const result = await updateMemoryAction(fd);
            if (!result.ok) setError(result.error);
            else window.location.reload();
          });
        } else {
          startTransition(async () => {
            try {
              await createMemoryAction(fd);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Create failed.");
            }
          });
        }
      }}
      className="grid gap-3 text-sm"
    >
      {outcome ? <p className="text-xs text-emerald-700">Saved. Reload to see latest state.</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-xs text-red-700">{error}</p> : null}

      <Field label="Title" required>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1"
          maxLength={200}
        />
      </Field>

      <Field label="Content" required>
        <textarea
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="h-40 w-full rounded border border-slate-300 px-2 py-1"
          maxLength={20000}
        />
      </Field>

      <Field label="Category" required>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1"
        >
          {categoryOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </Field>

      <Field label="Stable key (optional)">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="e.g. visual.papal.realism"
          className="w-full rounded border border-slate-300 px-2 py-1"
          maxLength={200}
          pattern="^[a-z0-9]+(?:[._-][a-z0-9]+)*$"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Importance (0–100)">
          <input
            type="number"
            min={0}
            max={100}
            value={importance}
            onChange={(e) => setImportance(Number.parseInt(e.target.value, 10) || 0)}
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
        </Field>
        <Field label="Confidence (0–100)">
          <input
            type="number"
            min={0}
            max={100}
            value={confidence}
            onChange={(e) => setConfidence(Number.parseInt(e.target.value, 10) || 0)}
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={pinned}
          onChange={(e) => setPinned(e.target.checked)}
        />
        Pin this memory (always considered in recall)
      </label>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Source label (optional)">
          <input
            value={sourceLabel}
            onChange={(e) => setSourceLabel(e.target.value)}
            placeholder="Human descriptive text"
            className="w-full rounded border border-slate-300 px-2 py-1"
            maxLength={200}
          />
        </Field>
        <Field label="Source URL (optional)">
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://…"
            type="url"
            className="w-full rounded border border-slate-300 px-2 py-1"
            maxLength={2048}
          />
        </Field>
      </div>

      <Field label="Expiry (optional, ISO-8601 with timezone)">
        <input
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1"
        />
      </Field>

      {mode === "create" ? (
        <Field label="Tags (comma-separated display names)">
          <input
            value={tagsCsv}
            onChange={(e) => setTagsCsv(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
        </Field>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded bg-slate-900 px-3 py-1 text-sm text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : mode === "create" ? "Create Memory" : "Save Changes"}
      </button>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase text-slate-500">
        {label}{required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
