"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createCanonEntryAction, updateCanonEntryAction } from "@/app/admin/actions";
import { FormFeedback } from "../form-feedback";
import { FieldError } from "../field-error";
import { ConflictReview } from "../conflict-review";
import type { CanonEntryDto } from "@/lib/campaign/canon";

export function CreateCanonForm() {
  const [state, formAction, isPending] = useActionState(createCanonEntryAction, null);
  const [key, setKey] = useState(0);

  const createdEntry = state?.ok ? (state.data as { id: string; key: string }) : null;

  return (
    <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
      <h2 className="border-b-2 border-ink pb-2 font-heading text-xl font-black uppercase">
        Create Canon Entry
      </h2>

      <div className="mt-4">
        <FormFeedback state={state} />
      </div>

      {createdEntry ? (
        <div className="mt-4 space-y-4">
          <p className="text-xs font-bold text-ink">
            Canon entry &ldquo;{createdEntry.key}&rdquo; was created.
          </p>
          <div className="flex gap-2">
            <Link
              href={`/admin/canon/${createdEntry.id}`}
              className="border-2 border-ink bg-ink px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider text-cream hover:bg-rejection-red"
            >
              View record
            </Link>
            <button
              type="button"
              onClick={() => setKey((k) => k + 1)}
              className="border-2 border-ink bg-cream px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider text-ink hover:bg-paper"
            >
              Create another
            </button>
          </div>
        </div>
      ) : (
        <form key={key} action={formAction} className="mt-4 space-y-4 text-xs font-sans">
          <div>
            <label htmlFor="create-canon-key" className="block font-heading font-bold uppercase text-ink">
              Unique Key *
            </label>
            <input
              type="text"
              id="create-canon-key"
              name="key"
              required
              maxLength={200}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              placeholder="e.g. movement.slogan"
            />
            <FieldError id="create-key-error" errors={state && !state.ok ? state.fieldErrors?.key : null} />
          </div>

          <div>
            <label htmlFor="create-canon-value" className="block font-heading font-bold uppercase text-ink">
              Canonical Value *
            </label>
            <textarea
              id="create-canon-value"
              name="value"
              required
              rows={3}
              maxLength={20000}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              placeholder="Official wording or fact"
            />
            <FieldError id="create-value-error" errors={state && !state.ok ? state.fieldErrors?.value : null} />
          </div>

          <div>
            <label htmlFor="create-canon-category" className="block font-heading font-bold uppercase text-ink">
              Category *
            </label>
            <input
              type="text"
              id="create-canon-category"
              name="category"
              required
              maxLength={200}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              placeholder="e.g. identity, slogans"
            />
            <FieldError id="create-category-error" errors={state && !state.ok ? state.fieldErrors?.category : null} />
          </div>

          <div>
            <label htmlFor="create-canon-notes" className="block font-heading font-bold uppercase text-ink">
              Source Notes
            </label>
            <textarea
              id="create-canon-notes"
              name="notes"
              rows={2}
              maxLength={20000}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              placeholder="Context or decision origin"
            />
            <FieldError id="create-notes-error" errors={state && !state.ok ? state.fieldErrors?.notes : null} />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full border-2 border-ink bg-ink py-2 font-heading text-xs font-bold uppercase tracking-widest text-cream hover:bg-rejection-red disabled:opacity-50"
          >
            {isPending ? "Creating..." : "Create Canon Entry"}
          </button>
        </form>
      )}
    </div>
  );
}

export function EditCanonForm({ entry }: { entry: CanonEntryDto }) {
  const [state, formAction, isPending] = useActionState(updateCanonEntryAction, null);
  const [expectedVersion, setExpectedVersion] = useState(entry.version);

  return (
    <div className="space-y-4">
      <FormFeedback state={state} />

      {state && !state.ok && state.code === "VERSION_CONFLICT" && (
        <ConflictReview
          currentVersion={expectedVersion + 1}
          onUseDraftAgainstVersion={(v) => setExpectedVersion(v)}
          onDiscardDraft={() => window.location.reload()}
        />
      )}

      <form action={formAction} className="space-y-4 text-xs font-sans">
        <input type="hidden" name="id" value={entry.id} />
        <input type="hidden" name="expectedVersion" value={expectedVersion} />

        <div>
          <label className="block font-heading font-bold uppercase text-ink">
            Unique Key (Immutable)
          </label>
          <input
            type="text"
            value={entry.key}
            disabled
            className="mt-1 w-full border border-ink/30 bg-paper/60 p-2 font-mono text-ink/60"
          />
        </div>

        <div>
          <label htmlFor="edit-canon-value" className="block font-heading font-bold uppercase text-ink">
            Canonical Value *
          </label>
          <textarea
            id="edit-canon-value"
            name="value"
            defaultValue={entry.value}
            required
            rows={4}
            maxLength={20000}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="edit-value-error" errors={state && !state.ok ? state.fieldErrors?.value : null} />
        </div>

        <div>
          <label htmlFor="edit-canon-category" className="block font-heading font-bold uppercase text-ink">
            Category *
          </label>
          <input
            type="text"
            id="edit-canon-category"
            name="category"
            defaultValue={entry.category}
            required
            maxLength={200}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="edit-category-error" errors={state && !state.ok ? state.fieldErrors?.category : null} />
        </div>

        <div>
          <label htmlFor="edit-canon-notes" className="block font-heading font-bold uppercase text-ink">
            Source Notes
          </label>
          <textarea
            id="edit-canon-notes"
            name="notes"
            defaultValue={entry.notes || ""}
            rows={3}
            maxLength={20000}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="edit-notes-error" errors={state && !state.ok ? state.fieldErrors?.notes : null} />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/admin/canon"
            className="border border-ink bg-cream px-4 py-2 font-heading text-xs font-bold uppercase hover:bg-paper"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="border-2 border-ink bg-ink px-6 py-2 font-heading text-xs font-bold uppercase tracking-widest text-cream hover:bg-rejection-red disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
