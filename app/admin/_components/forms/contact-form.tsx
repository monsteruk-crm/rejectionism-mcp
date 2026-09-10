"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createContactAction, updateContactAction } from "@/app/admin/actions";
import { FormFeedback } from "../form-feedback";
import { FieldError } from "../field-error";
import { ConflictReview } from "../conflict-review";
import type { ContactDto } from "@/lib/campaign/contacts";

export function CreateContactForm() {
  const [state, formAction, isPending] = useActionState(createContactAction, null);
  const [key, setKey] = useState(0);

  const createdContact = state?.ok ? (state.data as { id: string; name: string }) : null;

  return (
    <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
      <h2 className="border-b-2 border-ink pb-2 font-heading text-xl font-black uppercase">
        Register Contact
      </h2>

      <div className="mt-4">
        <FormFeedback state={state} />
      </div>

      {createdContact ? (
        <div className="mt-4 space-y-4">
          <p className="text-xs font-bold text-ink">
            Contact &ldquo;{createdContact.name}&rdquo; was registered.
          </p>
          <div className="flex gap-2">
            <Link
              href={`/admin/contacts/${createdContact.id}`}
              className="border-2 border-ink bg-ink px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider text-cream hover:bg-rejection-red"
            >
              View record
            </Link>
            <button
              type="button"
              onClick={() => setKey((k) => k + 1)}
              className="border-2 border-ink bg-cream px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider text-ink hover:bg-paper"
            >
              Register another
            </button>
          </div>
        </div>
      ) : (
        <form key={key} action={formAction} className="mt-4 space-y-4 text-xs font-sans">
          <div>
            <label htmlFor="create-contact-name" className="block font-heading font-bold uppercase text-ink">
              Full Name *
            </label>
            <input
              type="text"
              id="create-contact-name"
              name="name"
              required
              maxLength={200}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              placeholder="e.g. John Doe"
            />
            <FieldError id="name-error" errors={state && !state.ok ? state.fieldErrors?.name : null} />
          </div>

          <div>
            <label htmlFor="create-contact-org" className="block font-heading font-bold uppercase text-ink">
              Organization
            </label>
            <input
              type="text"
              id="create-contact-org"
              name="organization"
              maxLength={200}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
            <FieldError id="org-error" errors={state && !state.ok ? state.fieldErrors?.organization : null} />
          </div>

          <div>
            <label htmlFor="create-contact-role" className="block font-heading font-bold uppercase text-ink">
              Role / Position
            </label>
            <input
              type="text"
              id="create-contact-role"
              name="role"
              maxLength={200}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
            <FieldError id="role-error" errors={state && !state.ok ? state.fieldErrors?.role : null} />
          </div>

          <div>
            <label htmlFor="create-contact-email" className="block font-heading font-bold uppercase text-ink">
              Email Address
            </label>
            <input
              type="email"
              id="create-contact-email"
              name="email"
              maxLength={200}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              placeholder="contact@example.com"
            />
            <FieldError id="email-error" errors={state && !state.ok ? state.fieldErrors?.email : null} />
          </div>

          <div>
            <label htmlFor="create-contact-status" className="block font-heading font-bold uppercase text-ink">
              Status
            </label>
            <input
              type="text"
              id="create-contact-status"
              name="status"
              defaultValue="PROSPECT"
              maxLength={200}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
            <FieldError id="status-error" errors={state && !state.ok ? state.fieldErrors?.status : null} />
          </div>

          <div>
            <label htmlFor="create-contact-notes" className="block font-heading font-bold uppercase text-ink">
              Private Notes
            </label>
            <textarea
              id="create-contact-notes"
              name="notes"
              rows={3}
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
            {isPending ? "Registering..." : "Register Contact"}
          </button>
        </form>
      )}
    </div>
  );
}

export function EditContactForm({ contact }: { contact: ContactDto }) {
  const [state, formAction, isPending] = useActionState(updateContactAction, null);
  const [expectedVersion, setExpectedVersion] = useState(contact.version);

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
        <input type="hidden" name="id" value={contact.id} />
        <input type="hidden" name="expectedVersion" value={expectedVersion} />

        <div>
          <label htmlFor="edit-contact-name" className="block font-heading font-bold uppercase text-ink">
            Name *
          </label>
          <input
            type="text"
            id="edit-contact-name"
            name="name"
            defaultValue={contact.name}
            required
            maxLength={200}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="name-error" errors={state && !state.ok ? state.fieldErrors?.name : null} />
        </div>

        <div>
          <label htmlFor="edit-contact-org" className="block font-heading font-bold uppercase text-ink">
            Organization
          </label>
          <input
            type="text"
            id="edit-contact-org"
            name="organization"
            defaultValue={contact.organization || ""}
            maxLength={200}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="org-error" errors={state && !state.ok ? state.fieldErrors?.organization : null} />
        </div>

        <div>
          <label htmlFor="edit-contact-role" className="block font-heading font-bold uppercase text-ink">
            Role
          </label>
          <input
            type="text"
            id="edit-contact-role"
            name="role"
            defaultValue={contact.role || ""}
            maxLength={200}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="role-error" errors={state && !state.ok ? state.fieldErrors?.role : null} />
        </div>

        <div>
          <label htmlFor="edit-contact-email" className="block font-heading font-bold uppercase text-ink">
            Email
          </label>
          <input
            type="email"
            id="edit-contact-email"
            name="email"
            defaultValue={contact.email || ""}
            maxLength={200}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="email-error" errors={state && !state.ok ? state.fieldErrors?.email : null} />
        </div>

        <div>
          <label htmlFor="edit-contact-status" className="block font-heading font-bold uppercase text-ink">
            Status
          </label>
          <input
            type="text"
            id="edit-contact-status"
            name="status"
            defaultValue={contact.status}
            maxLength={200}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="status-error" errors={state && !state.ok ? state.fieldErrors?.status : null} />
        </div>

        <div>
          <label htmlFor="edit-contact-notes" className="block font-heading font-bold uppercase text-ink">
            Private Notes
          </label>
          <textarea
            id="edit-contact-notes"
            name="notes"
            defaultValue={contact.notes || ""}
            rows={3}
            maxLength={20000}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="notes-error" errors={state && !state.ok ? state.fieldErrors?.notes : null} />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/admin/contacts"
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
