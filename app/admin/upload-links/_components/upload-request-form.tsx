"use client";

import { useActionState, useState } from "react";
import { createUploadRequestAction } from "../actions";
import { FormFeedback } from "../../_components/form-feedback";

export function UploadRequestForm(props: {
  initialTargetAssetId?: string;
  initialTargetRevisionId?: string;
}) {
  const [state, formAction, isPending] = useActionState(createUploadRequestAction, null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="space-y-4">
      {state?.ok && state.data && (
        <div className="border-2 border-ink bg-cream p-4 font-sans text-xs">
          <p className="font-heading text-sm font-black uppercase tracking-wider text-ink">
            Upload Link Created (Shown Once)
          </p>
          <p className="mt-1 text-ink/80">
            Copy and share this capability URL now. For security reasons, the raw token is never
            stored and cannot be recovered.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={state.data.uploadUrl}
              className="w-full border-2 border-ink bg-paper p-2 font-mono text-xs text-ink"
            />
            <button
              type="button"
              onClick={() => handleCopy(state.data.uploadUrl)}
              className="shrink-0 border-2 border-ink bg-ink px-4 py-2 font-heading text-xs font-bold uppercase text-cream hover:bg-rejection-red"
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-ink/60">
            Expires at: {new Date(state.data.expiresAt).toLocaleString()}
          </p>
        </div>
      )}

      <FormFeedback state={state} />

      <form action={formAction} className="space-y-4 text-xs font-sans">
        <div>
          <label htmlFor="title" className="block font-heading font-bold uppercase text-ink">
            Request Title *
          </label>
          <input
            type="text"
            id="title"
            name="title"
            required
            maxLength={200}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            placeholder="e.g. Artwork submission for campaign launch"
          />
        </div>

        <div>
          <label htmlFor="instructions" className="block font-heading font-bold uppercase text-ink">
            Contributor Instructions
          </label>
          <textarea
            id="instructions"
            name="instructions"
            rows={3}
            maxLength={20000}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            placeholder="Provide guidelines, required formats, resolution, or messaging notes"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="expiresInDays" className="block font-heading font-bold uppercase text-ink">
              Expires In (Days)
            </label>
            <input
              type="number"
              id="expiresInDays"
              name="expiresInDays"
              defaultValue={7}
              min={1}
              max={30}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>

          <div>
            <label htmlFor="maxItems" className="block font-heading font-bold uppercase text-ink">
              Max Items (1..50)
            </label>
            <input
              type="number"
              id="maxItems"
              name="maxItems"
              defaultValue={20}
              min={1}
              max={50}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>
        </div>

        <div className="border-t border-ink/20 pt-3">
          <p className="font-heading text-xs font-bold uppercase text-ink">Targeting (Optional)</p>
          <p className="mt-0.5 text-[11px] text-ink/70">
            Leave blank to allow contributor to submit separate new assets.
          </p>

          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="targetAssetId" className="block font-mono text-[11px] uppercase text-ink/80">
                Target Asset ID
              </label>
              <input
                type="text"
                id="targetAssetId"
                name="targetAssetId"
                defaultValue={props.initialTargetAssetId || ""}
                placeholder="Optional asset ID"
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              />
            </div>

            <div>
              <label htmlFor="targetRevisionId" className="block font-mono text-[11px] uppercase text-ink/80">
                Target Revision ID
              </label>
              <input
                type="text"
                id="targetRevisionId"
                name="targetRevisionId"
                defaultValue={props.initialTargetRevisionId || ""}
                placeholder="Optional revision ID"
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full border-2 border-ink bg-ink py-2 font-heading text-xs font-bold uppercase tracking-widest text-cream hover:bg-rejection-red disabled:opacity-50"
        >
          {isPending ? "Creating Link..." : "Create Upload Link"}
        </button>
      </form>
    </div>
  );
}
