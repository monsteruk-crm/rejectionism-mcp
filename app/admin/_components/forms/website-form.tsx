"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createWebsiteAction, updateWebsiteAction } from "@/app/admin/actions";
import { FormFeedback } from "../form-feedback";
import { FieldError } from "../field-error";
import { ConflictReview } from "../conflict-review";
import type { WebsiteDto } from "@/lib/campaign/websites";

export function CreateWebsiteForm() {
  const [state, formAction, isPending] = useActionState(createWebsiteAction, null);
  const [key, setKey] = useState(0);

  const createdWebsite = state?.ok ? (state.data as { id: string; name: string }) : null;

  return (
    <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
      <h2 className="border-b-2 border-ink pb-2 font-heading text-xl font-black uppercase">
        Register Website / Domain
      </h2>

      <div className="mt-4">
        <FormFeedback state={state} />
      </div>

      {createdWebsite ? (
        <div className="mt-4 space-y-4">
          <p className="text-xs font-bold text-ink">
            Website &ldquo;{createdWebsite.name}&rdquo; was registered.
          </p>
          <div className="flex gap-2">
            <Link
              href={`/admin/websites/${createdWebsite.id}`}
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
            <label htmlFor="create-web-name" className="block font-heading font-bold uppercase text-ink">
              Website Name *
            </label>
            <input
              type="text"
              id="create-web-name"
              name="name"
              required
              maxLength={200}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              placeholder="e.g. Primary Portal"
            />
            <FieldError id="name-error" errors={state && !state.ok ? state.fieldErrors?.name : null} />
          </div>

          <div>
            <label htmlFor="create-web-domain" className="block font-heading font-bold uppercase text-ink">
              Domain Name (Immutable) *
            </label>
            <input
              type="text"
              id="create-web-domain"
              name="domain"
              required
              maxLength={200}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              placeholder="e.g. rejectionism.com"
            />
            <FieldError id="domain-error" errors={state && !state.ok ? state.fieldErrors?.domain : null} />
          </div>

          <div>
            <label htmlFor="create-web-purpose" className="block font-heading font-bold uppercase text-ink">
              Strategic Purpose *
            </label>
            <textarea
              id="create-web-purpose"
              name="purpose"
              required
              rows={3}
              maxLength={20000}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              placeholder="Operational role within campaign ecosystem"
            />
            <FieldError id="purpose-error" errors={state && !state.ok ? state.fieldErrors?.purpose : null} />
          </div>

          <div>
            <label htmlFor="create-web-status" className="block font-heading font-bold uppercase text-ink">
              Status
            </label>
            <select
              id="create-web-status"
              name="status"
              defaultValue="UNKNOWN"
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            >
              <option value="UNKNOWN">UNKNOWN</option>
              <option value="PLANNED">PLANNED</option>
              <option value="RESERVED">RESERVED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="LIVE">LIVE</option>
              <option value="REDIRECT">REDIRECT</option>
            </select>
          </div>

          <div>
            <label htmlFor="create-web-repo" className="block font-heading font-bold uppercase text-ink">
              Repository URL
            </label>
            <input
              type="url"
              id="create-web-repo"
              name="repositoryUrl"
              maxLength={2048}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              placeholder="https://github.com/org/repo"
            />
            <FieldError id="repo-error" errors={state && !state.ok ? state.fieldErrors?.repositoryUrl : null} />
          </div>

          <div>
            <label htmlFor="create-web-deploy" className="block font-heading font-bold uppercase text-ink">
              Deployment URL
            </label>
            <input
              type="url"
              id="create-web-deploy"
              name="deploymentUrl"
              maxLength={2048}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              placeholder="https://rejectionism.com"
            />
            <FieldError id="deploy-error" errors={state && !state.ok ? state.fieldErrors?.deploymentUrl : null} />
          </div>

          <div>
            <label htmlFor="create-web-notes" className="block font-heading font-bold uppercase text-ink">
              Notes
            </label>
            <textarea
              id="create-web-notes"
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
            {isPending ? "Registering..." : "Register Website"}
          </button>
        </form>
      )}
    </div>
  );
}

export function EditWebsiteForm({ website }: { website: WebsiteDto }) {
  const [state, formAction, isPending] = useActionState(updateWebsiteAction, null);
  const [expectedVersion, setExpectedVersion] = useState(website.version);

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
        <input type="hidden" name="id" value={website.id} />
        <input type="hidden" name="expectedVersion" value={expectedVersion} />

        <div>
          <label className="block font-heading font-bold uppercase text-ink">
            Domain (Immutable)
          </label>
          <input
            type="text"
            value={website.domain}
            disabled
            className="mt-1 w-full border border-ink/30 bg-paper/60 p-2 font-mono text-ink/60"
          />
        </div>

        <div>
          <label htmlFor="edit-web-name" className="block font-heading font-bold uppercase text-ink">
            Name *
          </label>
          <input
            type="text"
            id="edit-web-name"
            name="name"
            defaultValue={website.name}
            required
            maxLength={200}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="name-error" errors={state && !state.ok ? state.fieldErrors?.name : null} />
        </div>

        <div>
          <label htmlFor="edit-web-purpose" className="block font-heading font-bold uppercase text-ink">
            Strategic Purpose *
          </label>
          <textarea
            id="edit-web-purpose"
            name="purpose"
            defaultValue={website.purpose}
            required
            rows={4}
            maxLength={20000}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="purpose-error" errors={state && !state.ok ? state.fieldErrors?.purpose : null} />
        </div>

        <div>
          <label htmlFor="edit-web-status" className="block font-heading font-bold uppercase text-ink">
            Status
          </label>
          <select
            id="edit-web-status"
            name="status"
            defaultValue={website.status}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          >
            <option value="UNKNOWN">UNKNOWN</option>
            <option value="PLANNED">PLANNED</option>
            <option value="RESERVED">RESERVED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="LIVE">LIVE</option>
            <option value="REDIRECT">REDIRECT</option>
          </select>
        </div>

        <div>
          <label htmlFor="edit-web-repo" className="block font-heading font-bold uppercase text-ink">
            Repository URL
          </label>
          <input
            type="url"
            id="edit-web-repo"
            name="repositoryUrl"
            defaultValue={website.repositoryUrl || ""}
            maxLength={2048}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="repo-error" errors={state && !state.ok ? state.fieldErrors?.repositoryUrl : null} />
        </div>

        <div>
          <label htmlFor="edit-web-deploy" className="block font-heading font-bold uppercase text-ink">
            Deployment URL
          </label>
          <input
            type="url"
            id="edit-web-deploy"
            name="deploymentUrl"
            defaultValue={website.deploymentUrl || ""}
            maxLength={2048}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="deploy-error" errors={state && !state.ok ? state.fieldErrors?.deploymentUrl : null} />
        </div>

        <div>
          <label htmlFor="edit-web-notes" className="block font-heading font-bold uppercase text-ink">
            Notes
          </label>
          <textarea
            id="edit-web-notes"
            name="notes"
            defaultValue={website.notes || ""}
            rows={3}
            maxLength={20000}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
          <FieldError id="notes-error" errors={state && !state.ok ? state.fieldErrors?.notes : null} />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/admin/websites"
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
