"use client";

import { useActionState, useState } from "react";
import { revokeUploadRequestAction, regenerateUploadRequestAction } from "../actions";
import { FormFeedback } from "../../_components/form-feedback";

export function UploadLinkControls(props: {
  id: string;
  effectiveStatus: "OPEN" | "SUBMITTED" | "REVOKED" | "EXPIRED";
}) {
  const [revokeState, revokeAction, isRevokePending] = useActionState(
    revokeUploadRequestAction,
    null,
  );
  const [regenState, regenAction, isRegenPending] = useActionState(
    regenerateUploadRequestAction,
    null,
  );
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

  const isTerminal =
    props.effectiveStatus === "SUBMITTED" || props.effectiveStatus === "REVOKED";

  return (
    <div className="space-y-4">
      {regenState?.ok && regenState.data && (
        <div className="border-2 border-ink bg-cream p-4 font-sans text-xs">
          <p className="font-heading text-sm font-black uppercase tracking-wider text-ink">
            Replacement Link Created (Shown Once)
          </p>
          <p className="mt-1 text-ink/80">
            Copy and share this new capability URL now. The previous link has been revoked.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={regenState.data.uploadUrl}
              className="w-full border-2 border-ink bg-paper p-2 font-mono text-xs text-ink"
            />
            <button
              type="button"
              onClick={() => handleCopy(regenState.data.uploadUrl)}
              className="shrink-0 border-2 border-ink bg-ink px-4 py-2 font-heading text-xs font-bold uppercase text-cream hover:bg-rejection-red"
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-ink/60">
            Expires at: {new Date(regenState.data.expiresAt).toLocaleString()}
          </p>
        </div>
      )}

      <FormFeedback state={revokeState} />
      <FormFeedback state={regenState} />

      {!isTerminal && (
        <div className="flex flex-wrap items-center gap-4 border-t border-ink/20 pt-4 font-sans text-xs">
          <form action={revokeAction}>
            <input type="hidden" name="id" value={props.id} />
            <button
              type="submit"
              disabled={isRevokePending}
              className="border-2 border-blood-red bg-blood-red px-4 py-2 font-heading font-bold uppercase tracking-wider text-cream hover:bg-ink disabled:opacity-50"
            >
              {isRevokePending ? "Revoking..." : "Revoke Upload Link"}
            </button>
          </form>

          <form action={regenAction}>
            <input type="hidden" name="id" value={props.id} />
            <button
              type="submit"
              disabled={isRegenPending}
              className="border-2 border-ink bg-ink px-4 py-2 font-heading font-bold uppercase tracking-wider text-cream hover:bg-rejection-red disabled:opacity-50"
            >
              {isRegenPending ? "Regenerating..." : "Regenerate Link"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
