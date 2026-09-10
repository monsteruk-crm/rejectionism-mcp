"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createContentItemAction, updateContentItemAction } from "@/app/admin/actions";
import { FormFeedback } from "../form-feedback";
import { FieldError } from "../field-error";
import { ConflictReview } from "../conflict-review";
import type { ContentItemDto } from "@/lib/campaign/content";

export function CreateContentForm() {
  const [state, formAction, isPending] = useActionState(createContentItemAction, null);
  const [key, setKey] = useState(0);

  const createdContent = state?.ok ? (state.data as { id: string; title: string }) : null;

  return (
    <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
      <h2 className="border-b-2 border-ink pb-2 font-heading text-xl font-black uppercase">
        Create Content Item
      </h2>

      <div className="mt-4">
        <FormFeedback state={state} />
      </div>

      {createdContent ? (
        <div className="mt-4 space-y-4">
          <p className="text-xs font-bold text-ink">
            Content item &ldquo;{createdContent.title}&rdquo; was created.
          </p>
          <div className="flex gap-2">
            <Link
              href={`/admin/content/${createdContent.id}`}
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
            <label htmlFor="create-content-title" className="block font-heading font-bold uppercase text-ink">
              Title *
            </label>
            <input
              type="text"
              id="create-content-title"
              name="title"
              required
              maxLength={200}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              placeholder="e.g. Manifesto Podcast Episode 1"
            />
            <FieldError id="title-error" errors={state && !state.ok ? state.fieldErrors?.title : null} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="create-content-format" className="block font-heading font-bold uppercase text-ink">
                Format *
              </label>
              <input
                type="text"
                id="create-content-format"
                name="format"
                required
                maxLength={200}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="e.g. Audio, Video, Essay"
              />
              <FieldError id="format-error" errors={state && !state.ok ? state.fieldErrors?.format : null} />
            </div>

            <div>
              <label htmlFor="create-content-channel" className="block font-heading font-bold uppercase text-ink">
                Channel *
              </label>
              <input
                type="text"
                id="create-content-channel"
                name="channel"
                required
                maxLength={200}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="e.g. Spotify, YouTube, Substack"
              />
              <FieldError id="channel-error" errors={state && !state.ok ? state.fieldErrors?.channel : null} />
            </div>
          </div>

          <div>
            <label htmlFor="create-content-status" className="block font-heading font-bold uppercase text-ink">
              Status
            </label>
            <select
              id="create-content-status"
              name="status"
              defaultValue="DRAFT"
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            >
              <option value="DRAFT">DRAFT</option>
              <option value="SCHEDULED">SCHEDULED (requires date)</option>
              <option value="PUBLISHED">PUBLISHED (requires URL)</option>
            </select>
          </div>

          <div>
            <label htmlFor="create-content-scheduledFor" className="block font-heading font-bold uppercase text-ink">
              Scheduled Date (Required if SCHEDULED)
            </label>
            <input
              type="datetime-local"
              id="create-content-scheduledFor"
              name="scheduledFor"
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
            <FieldError id="scheduledFor-error" errors={state && !state.ok ? state.fieldErrors?.scheduledFor : null} />
          </div>

          <div>
            <label htmlFor="create-content-publishedUrl" className="block font-heading font-bold uppercase text-ink">
              Published URL (Required if PUBLISHED)
            </label>
            <input
              type="url"
              id="create-content-publishedUrl"
              name="publishedUrl"
              maxLength={2048}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              placeholder="https://example.com/episode-1"
            />
            <FieldError id="publishedUrl-error" errors={state && !state.ok ? state.fieldErrors?.publishedUrl : null} />
          </div>

          <div>
            <label htmlFor="create-content-notes" className="block font-heading font-bold uppercase text-ink">
              Notes
            </label>
            <textarea
              id="create-content-notes"
              name="notes"
              rows={2}
              maxLength={20000}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
            <FieldError id="notes-error" errors={state && !state.ok ? state.fieldErrors?.notes : null} />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full border-2 border-ink bg-ink py-2 font-heading text-xs font-bold uppercase tracking-widest text-cream hover:bg-rejection-red disabled:opacity-50"
          >
            {isPending ? "Creating..." : "Create Content Item"}
          </button>
        </form>
      )}
    </div>
  );
}

export function EditContentForm({ content }: { content: ContentItemDto }) {
  const [state, formAction, isPending] = useActionState(updateContentItemAction, null);
  const [expectedVersion, setExpectedVersion] = useState(content.version);

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
        <input type="hidden" name="id" value={content.id} />
        <input type="hidden" name="expectedVersion" value={expectedVersion} />

        <div>
          <label htmlFor="edit-content-title" className="block font-heading font-bold uppercase text-ink">
            Title *
          </label>
          <input
            type="text"
            id="edit-content-title"
            name="title"
            defaultValue={content.title}
            required
            maxLength={200}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="title-error" errors={state && !state.ok ? state.fieldErrors?.title : null} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="edit-content-format" className="block font-heading font-bold uppercase text-ink">
              Format *
            </label>
            <input
              type="text"
              id="edit-content-format"
              name="format"
              defaultValue={content.format}
              required
              maxLength={200}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
            <FieldError id="format-error" errors={state && !state.ok ? state.fieldErrors?.format : null} />
          </div>

          <div>
            <label htmlFor="edit-content-channel" className="block font-heading font-bold uppercase text-ink">
              Channel *
            </label>
            <input
              type="text"
              id="edit-content-channel"
              name="channel"
              defaultValue={content.channel}
              required
              maxLength={200}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
            <FieldError id="channel-error" errors={state && !state.ok ? state.fieldErrors?.channel : null} />
          </div>
        </div>

        <div>
          <label htmlFor="edit-content-status" className="block font-heading font-bold uppercase text-ink">
            Status
          </label>
          <select
            id="edit-content-status"
            name="status"
            defaultValue={content.status}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          >
            <option value="DRAFT">DRAFT</option>
            <option value="SCHEDULED">SCHEDULED (requires date)</option>
            <option value="PUBLISHED">PUBLISHED (requires URL)</option>
          </select>
        </div>

        <div>
          <label htmlFor="edit-content-scheduledFor" className="block font-heading font-bold uppercase text-ink">
            Scheduled Date (Required if SCHEDULED)
          </label>
          <input
            type="datetime-local"
            id="edit-content-scheduledFor"
            name="scheduledFor"
            defaultValue={content.scheduledFor ? new Date(content.scheduledFor).toISOString().slice(0, 16) : ""}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="scheduledFor-error" errors={state && !state.ok ? state.fieldErrors?.scheduledFor : null} />
        </div>

        <div>
          <label htmlFor="edit-content-publishedUrl" className="block font-heading font-bold uppercase text-ink">
            Published URL (Required if PUBLISHED)
          </label>
          <input
            type="url"
            id="edit-content-publishedUrl"
            name="publishedUrl"
            defaultValue={content.publishedUrl || ""}
            maxLength={2048}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="publishedUrl-error" errors={state && !state.ok ? state.fieldErrors?.publishedUrl : null} />
        </div>

        <div>
          <label htmlFor="edit-content-notes" className="block font-heading font-bold uppercase text-ink">
            Notes
          </label>
          <textarea
            id="edit-content-notes"
            name="notes"
            defaultValue={content.notes || ""}
            rows={3}
            maxLength={20000}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="notes-error" errors={state && !state.ok ? state.fieldErrors?.notes : null} />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/admin/content"
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
