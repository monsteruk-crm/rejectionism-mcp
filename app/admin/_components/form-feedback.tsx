"use client";

import Link from "next/link";

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> };

export function FormFeedback({ state }: { state: ActionResult | null | undefined }) {
  if (!state) return null;

  if (state.ok) {
    return (
      <div className="border-2 border-ink bg-paper p-4 text-ink">
        <p className="font-heading text-sm font-bold uppercase tracking-wider text-ink">
          {state.message || "Operation successful."}
        </p>
      </div>
    );
  }

  const isConflict = state.code === "VERSION_CONFLICT";

  return (
    <div className="border-2 border-blood-red bg-paper p-4 text-ink">
      <p className="font-heading text-sm font-bold uppercase tracking-wider text-rejection-red">
        {isConflict ? "CONFLICT: VERSION STALE" : "OPERATION FAILED"}
      </p>
      <p className="mt-1 text-xs text-ink/90">{state.error}</p>

      {isConflict && (
        <p className="mt-2 text-xs font-semibold text-ink">
          Another process or agent updated this record. Please reload the current record before submitting changes.
        </p>
      )}

      {state.fieldErrors && Object.keys(state.fieldErrors).length > 0 && (
        <ul className="mt-2 list-inside list-disc text-xs text-rejection-red">
          {Object.entries(state.fieldErrors).map(([field, errors]) => (
            <li key={field}>
              <strong>{field}</strong>: {Array.isArray(errors) ? errors.join(", ") : String(errors)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
