"use client";

import { useActionState, useState } from "react";
import {
  updateAssetMetadataAction,
  updateAssetWorkflowStatusAction,
  createAssetRevisionAction,
  addAssetRepresentationAction,
  setPrimaryAssetRepresentationAction,
} from "../actions";
import { FormFeedback } from "../../_components/form-feedback";

export function AssetMetadataForm(props: {
  id: string;
  version: number;
  name: string;
  kind: string;
  notes: string | null;
}) {
  const [state, formAction, isPending] = useActionState(updateAssetMetadataAction, null);

  return (
    <div className="space-y-3">
      <FormFeedback state={state} />
      <form action={formAction} className="space-y-4 text-xs font-sans">
        <input type="hidden" name="id" value={props.id} />
        <input type="hidden" name="expectedVersion" value={props.version} />

        <div>
          <label htmlFor="edit_name" className="block font-heading font-bold uppercase text-ink">
            Asset Name *
          </label>
          <input
            type="text"
            id="edit_name"
            name="name"
            defaultValue={props.name}
            required
            maxLength={200}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
        </div>

        <div>
          <label htmlFor="edit_kind" className="block font-heading font-bold uppercase text-ink">
            Kind *
          </label>
          <input
            type="text"
            id="edit_kind"
            name="kind"
            defaultValue={props.kind}
            required
            maxLength={200}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
        </div>

        <div>
          <label htmlFor="edit_notes" className="block font-heading font-bold uppercase text-ink">
            Production Notes
          </label>
          <textarea
            id="edit_notes"
            name="notes"
            defaultValue={props.notes || ""}
            rows={3}
            maxLength={20000}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="border-2 border-ink bg-ink px-4 py-2 font-heading font-bold uppercase tracking-wider text-cream hover:bg-rejection-red disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Metadata"}
        </button>
      </form>
    </div>
  );
}

export function AssetStatusForm(props: {
  id: string;
  version: number;
  currentStatus: string;
}) {
  const [state, formAction, isPending] = useActionState(updateAssetWorkflowStatusAction, null);

  return (
    <div className="space-y-3">
      <FormFeedback state={state} />
      <form action={formAction} className="flex flex-wrap items-end gap-3 text-xs font-sans">
        <input type="hidden" name="id" value={props.id} />
        <input type="hidden" name="expectedVersion" value={props.version} />

        <div className="flex-1 min-w-[180px]">
          <label htmlFor="status_select" className="block font-heading font-bold uppercase text-ink">
            Workflow Status
          </label>
          <select
            id="status_select"
            name="status"
            defaultValue={props.currentStatus}
            className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          >
            <option value="MISSING">MISSING</option>
            <option value="DRAFT">DRAFT</option>
            <option value="NEEDS_WORK">NEEDS_WORK</option>
            <option value="APPROVED">APPROVED (requires file)</option>
            <option value="SUPERSEDED">SUPERSEDED (retires asset)</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="border-2 border-ink bg-ink px-4 py-2 font-heading font-bold uppercase tracking-wider text-cream hover:bg-rejection-red disabled:opacity-50"
        >
          {isPending ? "Updating..." : "Update Status"}
        </button>
      </form>
    </div>
  );
}

export function CreateRevisionForm(props: {
  assetId: string;
  version: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createAssetRevisionAction, null);

  return (
    <div className="border border-ink/30 bg-cream p-4 font-sans text-xs">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-heading font-bold uppercase text-ink">Create New Revision</p>
          <p className="text-[11px] text-ink/70">
            Increments the revision counter for this artwork.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="border border-ink bg-paper px-3 py-1 font-heading text-xs font-bold uppercase hover:bg-ink hover:text-cream"
        >
          {isOpen ? "Cancel" : "+ New Revision"}
        </button>
      </div>

      {isOpen && (
        <div className="mt-3 space-y-3 border-t border-ink/20 pt-3">
          <FormFeedback state={state} />
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="assetId" value={props.assetId} />
            <input type="hidden" name="expectedVersion" value={props.version} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="rev_label" className="block font-heading font-bold uppercase text-ink">
                  Revision Label (Optional)
                </label>
                <input
                  type="text"
                  id="rev_label"
                  name="label"
                  placeholder="e.g. 2026 Remaster"
                  maxLength={200}
                  className="mt-1 w-full border-2 border-ink bg-paper p-1.5 text-ink focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="rev_notes" className="block font-heading font-bold uppercase text-ink">
                  Revision Notes
                </label>
                <input
                  type="text"
                  id="rev_notes"
                  name="notes"
                  placeholder="What changed in this revision"
                  maxLength={20000}
                  className="mt-1 w-full border-2 border-ink bg-paper p-1.5 text-ink focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="border-2 border-ink bg-ink px-4 py-1.5 font-heading text-xs font-bold uppercase text-cream hover:bg-rejection-red disabled:opacity-50"
            >
              {isPending ? "Creating..." : "Confirm New Revision"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function AddRepresentationForm(props: {
  assetId: string;
  revisionId: string;
  version: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(addAssetRepresentationAction, null);

  return (
    <div className="mt-4 border-t border-ink/15 pt-3 font-sans text-xs">
      <div className="flex items-center justify-between">
        <span className="font-heading text-[11px] font-bold uppercase text-ink/70">
          Append External Representation
        </span>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="font-heading text-[11px] font-bold uppercase text-rejection-red underline hover:text-ink"
        >
          {isOpen ? "Close" : "+ Add External URL"}
        </button>
      </div>

      {isOpen && (
        <div className="mt-3 rounded border border-ink/20 bg-cream p-3 space-y-3">
          <FormFeedback state={state} />
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="assetId" value={props.assetId} />
            <input type="hidden" name="assetRevisionId" value={props.revisionId} />
            <input type="hidden" name="expectedVersion" value={props.version} />

            <div>
              <label htmlFor="rep_ext_url" className="block font-heading font-bold uppercase text-ink">
                External URL (HTTP/HTTPS) *
              </label>
              <input
                type="url"
                id="rep_ext_url"
                name="externalUrl"
                required
                maxLength={2048}
                placeholder="https://example.com/asset-highres.png"
                className="mt-1 w-full border-2 border-ink bg-paper p-1.5 font-mono text-xs text-ink focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <label htmlFor="rep_label" className="block font-heading text-[10px] font-bold uppercase text-ink">
                  Label
                </label>
                <input
                  type="text"
                  id="rep_label"
                  name="label"
                  placeholder="e.g. Clean Vector"
                  maxLength={200}
                  className="mt-0.5 w-full border border-ink bg-paper p-1 text-xs"
                />
              </div>

              <div>
                <label htmlFor="rep_variant" className="block font-heading text-[10px] font-bold uppercase text-ink">
                  Variant
                </label>
                <input
                  type="text"
                  id="rep_variant"
                  name="variant"
                  placeholder="e.g. Monochrome, 4K"
                  maxLength={200}
                  className="mt-0.5 w-full border border-ink bg-paper p-1 text-xs"
                />
              </div>

              <div>
                <label htmlFor="rep_format" className="block font-heading text-[10px] font-bold uppercase text-ink">
                  Format
                </label>
                <input
                  type="text"
                  id="rep_format"
                  name="format"
                  placeholder="e.g. SVG, PDF, PNG"
                  maxLength={200}
                  className="mt-0.5 w-full border border-ink bg-paper p-1 text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="border border-ink bg-ink px-3 py-1 font-heading text-xs font-bold uppercase text-cream hover:bg-rejection-red disabled:opacity-50"
            >
              {isPending ? "Adding..." : "Add Representation"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function SetPrimaryButton(props: {
  assetId: string;
  representationId: string;
  version: number;
}) {
  const [state, formAction, isPending] = useActionState(
    setPrimaryAssetRepresentationAction,
    null,
  );

  return (
    <div>
      <FormFeedback state={state} />
      <form action={formAction}>
        <input type="hidden" name="assetId" value={props.assetId} />
        <input type="hidden" name="representationId" value={props.representationId} />
        <input type="hidden" name="expectedVersion" value={props.version} />

        <button
          type="submit"
          disabled={isPending}
          className="border border-ink bg-cream px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-ink hover:bg-ink hover:text-cream disabled:opacity-50"
        >
          {isPending ? "Updating..." : "Make Primary"}
        </button>
      </form>
    </div>
  );
}
