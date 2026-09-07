"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createWorkItemAction, updateWorkItemAction } from "@/app/admin/actions";
import { FormFeedback } from "../form-feedback";
import { FieldError } from "../field-error";
import { ConflictReview } from "../conflict-review";
import type { WorkItemDto } from "@/lib/campaign/work-items";

export function CreateWorkItemForm() {
  const [state, formAction, isPending] = useActionState(createWorkItemAction, null);
  const [key, setKey] = useState(0);

  const resetForm = () => {
    setKey((k) => k + 1);
  };

  const createdItem = state?.ok ? (state.data as { id: string; title: string }) : null;

  return (
    <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
      <h2 className="border-b-2 border-ink pb-2 font-heading text-xl font-black uppercase">
        Create Work Item
      </h2>

      <div className="mt-4">
        <FormFeedback state={state} />
      </div>

      {createdItem ? (
        <div className="mt-4 space-y-4">
          <p className="text-xs font-bold text-ink">
            Work item &ldquo;{createdItem.title}&rdquo; was created.
          </p>
          <div className="flex gap-2">
            <Link
              href={`/admin/work-items/${createdItem.id}`}
              className="border-2 border-ink bg-ink px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider text-cream hover:bg-rejection-red"
            >
              View record
            </Link>
            <button
              type="button"
              onClick={resetForm}
              className="border-2 border-ink bg-cream px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider text-ink hover:bg-paper"
            >
              Create another
            </button>
          </div>
        </div>
      ) : (
        <form key={key} action={formAction} className="mt-4 space-y-4 text-xs font-sans">
          <div>
            <label htmlFor="create-title" className="block font-heading font-bold uppercase text-ink">
              Title *
            </label>
            <input
              type="text"
              id="create-title"
              name="title"
              required
              maxLength={200}
              aria-invalid={Boolean(state && !state.ok && state.fieldErrors?.title)}
              aria-describedby="create-title-error"
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              placeholder="e.g. Publish launch poster"
            />
            <FieldError id="create-title-error" errors={state && !state.ok ? state.fieldErrors?.title : null} />
          </div>

          <div>
            <label htmlFor="create-description" className="block font-heading font-bold uppercase text-ink">
              Description
            </label>
            <textarea
              id="create-description"
              name="description"
              rows={3}
              maxLength={20000}
              aria-invalid={Boolean(state && !state.ok && state.fieldErrors?.description)}
              aria-describedby="create-description-error"
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              placeholder="Operational context and criteria"
            />
            <FieldError id="create-description-error" errors={state && !state.ok ? state.fieldErrors?.description : null} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="create-status" className="block font-heading font-bold uppercase text-ink">
                Status
              </label>
              <select
                id="create-status"
                name="status"
                defaultValue="BACKLOG"
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              >
                <option value="BACKLOG">BACKLOG</option>
                <option value="NEXT">NEXT</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="BLOCKED">BLOCKED</option>
                <option value="DONE">DONE</option>
              </select>
            </div>

            <div>
              <label htmlFor="create-priority" className="block font-heading font-bold uppercase text-ink">
                Priority (0-100)
              </label>
              <input
                type="number"
                id="create-priority"
                name="priority"
                min={0}
                max={100}
                defaultValue={0}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              />
            </div>
          </div>

          <div>
            <label htmlFor="create-dueDate" className="block font-heading font-bold uppercase text-ink">
              Due Date
            </label>
            <input
              type="datetime-local"
              id="create-dueDate"
              name="dueDate"
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
            <FieldError id="create-dueDate-error" errors={state && !state.ok ? state.fieldErrors?.dueDate : null} />
          </div>

          <div>
            <label htmlFor="create-blockedReason" className="block font-heading font-bold uppercase text-ink">
              Blocked Reason (if BLOCKED)
            </label>
            <input
              type="text"
              id="create-blockedReason"
              name="blockedReason"
              maxLength={20000}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              placeholder="Required if status is BLOCKED"
            />
            <FieldError id="create-blockedReason-error" errors={state && !state.ok ? state.fieldErrors?.blockedReason : null} />
          </div>

          <div>
            <label htmlFor="create-evidenceUrl" className="block font-heading font-bold uppercase text-ink">
              Evidence URL (if DONE)
            </label>
            <input
              type="url"
              id="create-evidenceUrl"
              name="evidenceUrl"
              maxLength={2048}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              placeholder="https://example.com/evidence"
            />
            <FieldError id="create-evidenceUrl-error" errors={state && !state.ok ? state.fieldErrors?.evidenceUrl : null} />
          </div>

          <div>
            <label htmlFor="create-completionNote" className="block font-heading font-bold uppercase text-ink">
              Completion Note (if DONE)
            </label>
            <textarea
              id="create-completionNote"
              name="completionNote"
              rows={2}
              maxLength={20000}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              placeholder="Required for DONE if no URL"
            />
            <FieldError id="create-completionNote-error" errors={state && !state.ok ? state.fieldErrors?.completionNote : null} />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full border-2 border-ink bg-ink py-2 font-heading text-xs font-bold uppercase tracking-widest text-cream hover:bg-rejection-red disabled:opacity-50"
          >
            {isPending ? "Creating..." : "Create Item"}
          </button>
        </form>
      )}
    </div>
  );
}

export function EditWorkItemForm({ item }: { item: WorkItemDto }) {
  const [state, formAction, isPending] = useActionState(updateWorkItemAction, null);
  const [expectedVersion, setExpectedVersion] = useState(item.version);

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
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="expectedVersion" value={expectedVersion} />

        <div>
          <label htmlFor="edit-title" className="block font-heading font-bold uppercase text-ink">
            Title *
          </label>
          <input
            type="text"
            id="edit-title"
            name="title"
            defaultValue={item.title}
            required
            maxLength={200}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="edit-title-error" errors={state && !state.ok ? state.fieldErrors?.title : null} />
        </div>

        <div>
          <label htmlFor="edit-description" className="block font-heading font-bold uppercase text-ink">
            Description
          </label>
          <textarea
            id="edit-description"
            name="description"
            defaultValue={item.description}
            rows={4}
            maxLength={20000}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="edit-description-error" errors={state && !state.ok ? state.fieldErrors?.description : null} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="edit-status" className="block font-heading font-bold uppercase text-ink">
              Status
            </label>
            <select
              id="edit-status"
              name="status"
              defaultValue={item.status}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            >
              <option value="BACKLOG">BACKLOG</option>
              <option value="NEXT">NEXT</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="BLOCKED">BLOCKED</option>
              <option value="DONE">DONE</option>
            </select>
          </div>

          <div>
            <label htmlFor="edit-priority" className="block font-heading font-bold uppercase text-ink">
              Priority (0-100)
            </label>
            <input
              type="number"
              id="edit-priority"
              name="priority"
              min={0}
              max={100}
              defaultValue={item.priority}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>
        </div>

        <div>
          <label htmlFor="edit-dueDate" className="block font-heading font-bold uppercase text-ink">
            Due Date
          </label>
          <input
            type="datetime-local"
            id="edit-dueDate"
            name="dueDate"
            defaultValue={item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 16) : ""}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="edit-dueDate-error" errors={state && !state.ok ? state.fieldErrors?.dueDate : null} />
        </div>

        <div>
          <label htmlFor="edit-blockedReason" className="block font-heading font-bold uppercase text-ink">
            Blocked Reason (Required if status is BLOCKED)
          </label>
          <textarea
            id="edit-blockedReason"
            name="blockedReason"
            defaultValue={item.blockedReason || ""}
            rows={2}
            maxLength={20000}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="edit-blockedReason-error" errors={state && !state.ok ? state.fieldErrors?.blockedReason : null} />
        </div>

        <div>
          <label htmlFor="edit-evidenceUrl" className="block font-heading font-bold uppercase text-ink">
            Evidence URL (Required for DONE if no completion note)
          </label>
          <input
            type="url"
            id="edit-evidenceUrl"
            name="evidenceUrl"
            defaultValue={item.evidenceUrl || ""}
            maxLength={2048}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="edit-evidenceUrl-error" errors={state && !state.ok ? state.fieldErrors?.evidenceUrl : null} />
        </div>

        <div>
          <label htmlFor="edit-completionNote" className="block font-heading font-bold uppercase text-ink">
            Completion Note (Required for DONE if no evidence URL)
          </label>
          <textarea
            id="edit-completionNote"
            name="completionNote"
            defaultValue={item.completionNote || ""}
            rows={2}
            maxLength={20000}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="edit-completionNote-error" errors={state && !state.ok ? state.fieldErrors?.completionNote : null} />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/admin/work-items"
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
