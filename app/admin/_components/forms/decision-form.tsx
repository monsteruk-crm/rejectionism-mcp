"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { recordDecisionAction } from "@/app/admin/actions";
import { FormFeedback } from "../form-feedback";
import { FieldError } from "../field-error";

export function RecordDecisionForm({
  supersedesIdDefault,
}: {
  supersedesIdDefault?: string;
}) {
  const [state, formAction, isPending] = useActionState(recordDecisionAction, null);
  const [canonMode, setCanonMode] = useState<"none" | "create" | "update">("none");
  const [key, setKey] = useState(0);

  const recordedDecision = state?.ok ? (state.data as { id: string; subject: string }) : null;

  return (
    <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
      <h2 className="border-b-2 border-ink pb-2 font-heading text-xl font-black uppercase">
        Record Authoritative Decision
      </h2>

      <div className="mt-4">
        <FormFeedback state={state} />
      </div>

      {recordedDecision ? (
        <div className="mt-4 space-y-4">
          <p className="text-xs font-bold text-ink">
            Decision &ldquo;{recordedDecision.subject}&rdquo; was recorded.
          </p>
          <div className="flex gap-2">
            <Link
              href={`/admin/decisions/${recordedDecision.id}`}
              className="border-2 border-ink bg-ink px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider text-cream hover:bg-rejection-red"
            >
              View record
            </Link>
            <button
              type="button"
              onClick={() => setKey((k) => k + 1)}
              className="border-2 border-ink bg-cream px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider text-ink hover:bg-paper"
            >
              Record another
            </button>
          </div>
        </div>
      ) : (
        <form key={key} action={formAction} className="mt-4 space-y-4 text-xs font-sans">
          <div>
            <label htmlFor="decision-subject" className="block font-heading font-bold uppercase text-ink">
              Subject *
            </label>
            <input
              type="text"
              id="decision-subject"
              name="subject"
              required
              maxLength={200}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              placeholder="e.g. Movement Nomenclature Policy"
            />
            <FieldError id="subject-error" errors={state && !state.ok ? state.fieldErrors?.subject : null} />
          </div>

          <div>
            <label htmlFor="decision-body" className="block font-heading font-bold uppercase text-ink">
              Decision *
            </label>
            <textarea
              id="decision-body"
              name="decision"
              required
              rows={3}
              maxLength={20000}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              placeholder="The binding policy or statement"
            />
            <FieldError id="decision-error" errors={state && !state.ok ? state.fieldErrors?.decision : null} />
          </div>

          <div>
            <label htmlFor="decision-rationale" className="block font-heading font-bold uppercase text-ink">
              Rationale *
            </label>
            <textarea
              id="decision-rationale"
              name="rationale"
              required
              rows={3}
              maxLength={20000}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              placeholder="Why this was decided and historical context"
            />
            <FieldError id="rationale-error" errors={state && !state.ok ? state.fieldErrors?.rationale : null} />
          </div>

          <div>
            <label htmlFor="decision-supersedesId" className="block font-heading font-bold uppercase text-ink">
              Supersedes Decision ID (Optional)
            </label>
            <input
              type="text"
              id="decision-supersedesId"
              name="supersedesId"
              defaultValue={supersedesIdDefault || ""}
              maxLength={100}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              placeholder="ID of previous decision superseded by this one"
            />
            <FieldError id="supersedesId-error" errors={state && !state.ok ? state.fieldErrors?.supersedesId : null} />
          </div>

          {/* Canon Atomic Mutation Disclosure */}
          <div className="border-t-2 border-ink/20 pt-4">
            <label htmlFor="updateCanonMode" className="block font-heading font-bold uppercase text-ink">
              Atomic Canon Update (Optional)
            </label>
            <select
              id="updateCanonMode"
              name="updateCanonMode"
              value={canonMode}
              onChange={(e) => setCanonMode(e.target.value as any)}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            >
              <option value="none">None — Do not modify Canon</option>
              <option value="create">Create new Canon Entry</option>
              <option value="update">Update existing Canon Entry</option>
            </select>
          </div>

          {canonMode !== "none" && (
            <div className="space-y-3 rounded border border-ink/40 bg-cream p-3">
              <div>
                <label htmlFor="canonKey" className="block font-heading text-[11px] font-bold uppercase text-ink">
                  Canon Key *
                </label>
                <input
                  type="text"
                  id="canonKey"
                  name="canonKey"
                  required
                  className="mt-1 w-full border border-ink bg-paper p-1.5 font-mono text-xs text-ink"
                  placeholder="e.g. movement.name"
                />
              </div>

              <div>
                <label htmlFor="canonValue" className="block font-heading text-[11px] font-bold uppercase text-ink">
                  Canon Value *
                </label>
                <textarea
                  id="canonValue"
                  name="canonValue"
                  required
                  rows={2}
                  className="mt-1 w-full border border-ink bg-paper p-1.5 text-xs text-ink"
                />
              </div>

              {canonMode === "update" && (
                <div>
                  <label htmlFor="canonExpectedVersion" className="block font-heading text-[11px] font-bold uppercase text-ink">
                    Canon Expected Version *
                  </label>
                  <input
                    type="number"
                    id="canonExpectedVersion"
                    name="canonExpectedVersion"
                    required
                    min={1}
                    defaultValue={1}
                    className="mt-1 w-full border border-ink bg-paper p-1.5 font-mono text-xs text-ink"
                  />
                </div>
              )}

              <div>
                <label htmlFor="canonCategory" className="block font-heading text-[11px] font-bold uppercase text-ink">
                  Category {canonMode === "create" ? "*" : "(Optional)"}
                </label>
                <input
                  type="text"
                  id="canonCategory"
                  name="canonCategory"
                  required={canonMode === "create"}
                  className="mt-1 w-full border border-ink bg-paper p-1.5 font-heading text-xs uppercase text-ink"
                />
              </div>

              <div>
                <label htmlFor="canonNotes" className="block font-heading text-[11px] font-bold uppercase text-ink">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  id="canonNotes"
                  name="canonNotes"
                  className="mt-1 w-full border border-ink bg-paper p-1.5 text-xs text-ink"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full border-2 border-ink bg-ink py-2 font-heading text-xs font-bold uppercase tracking-widest text-cream hover:bg-rejection-red disabled:opacity-50"
          >
            {isPending ? "Recording..." : "Record Decision"}
          </button>
        </form>
      )}
    </div>
  );
}
