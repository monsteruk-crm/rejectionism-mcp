"use client";

import { useActionState, useState } from "react";
import { createAssetMetadataAction, createExternalAssetAction } from "../actions";
import { FormFeedback } from "../../_components/form-feedback";

export function CreateAssetPanel() {
  const [tab, setTab] = useState<"metadata" | "external">("metadata");
  const [isOpen, setIsOpen] = useState(false);

  const [metaState, metaAction, isMetaPending] = useActionState(
    createAssetMetadataAction,
    null,
  );
  const [extState, extAction, isExtPending] = useActionState(
    createExternalAssetAction,
    null,
  );

  return (
    <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
      <div className="flex items-center justify-between border-b-2 border-ink pb-3">
        <h2 className="font-heading text-xl font-black uppercase">
          Register New Asset
        </h2>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="border border-ink bg-cream px-3 py-1 font-heading text-xs font-bold uppercase hover:bg-ink hover:text-cream"
        >
          {isOpen ? "Close Form" : "+ New Asset"}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 space-y-4">
          <div className="flex border-b border-ink/20 font-heading text-xs uppercase">
            <button
              type="button"
              onClick={() => setTab("metadata")}
              className={`px-4 py-2 font-bold ${
                tab === "metadata"
                  ? "border-b-2 border-ink font-black text-ink"
                  : "text-ink/60 hover:text-ink"
              }`}
            >
              1. Metadata Only
            </button>
            <button
              type="button"
              onClick={() => setTab("external")}
              className={`px-4 py-2 font-bold ${
                tab === "external"
                  ? "border-b-2 border-ink font-black text-ink"
                  : "text-ink/60 hover:text-ink"
              }`}
            >
              2. External URL Asset
            </button>
          </div>

          {tab === "metadata" ? (
            <div>
              <FormFeedback state={metaState} />
              <form action={metaAction} className="mt-4 space-y-4 text-xs font-sans">
                <div>
                  <label htmlFor="meta_name" className="block font-heading font-bold uppercase text-ink">
                    Asset Name *
                  </label>
                  <input
                    type="text"
                    id="meta_name"
                    name="name"
                    required
                    maxLength={200}
                    className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                    placeholder="e.g. Primary Seal Vector Master"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="meta_kind" className="block font-heading font-bold uppercase text-ink">
                      Kind *
                    </label>
                    <input
                      type="text"
                      id="meta_kind"
                      name="kind"
                      required
                      maxLength={200}
                      className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                      placeholder="e.g. logo, banner, poster"
                    />
                  </div>

                  <div>
                    <label htmlFor="meta_status" className="block font-heading font-bold uppercase text-ink">
                      Status
                    </label>
                    <select
                      id="meta_status"
                      name="status"
                      defaultValue="DRAFT"
                      className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                    >
                      <option value="MISSING">MISSING</option>
                      <option value="DRAFT">DRAFT</option>
                      <option value="NEEDS_WORK">NEEDS_WORK</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="meta_notes" className="block font-heading font-bold uppercase text-ink">
                    Notes
                  </label>
                  <textarea
                    id="meta_notes"
                    name="notes"
                    rows={3}
                    maxLength={20000}
                    className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                    placeholder="Export requirements or provenance notes"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isMetaPending}
                  className="w-full border-2 border-ink bg-ink py-2 font-heading text-xs font-bold uppercase tracking-widest text-cream hover:bg-rejection-red disabled:opacity-50"
                >
                  {isMetaPending ? "Registering..." : "Register Metadata Asset"}
                </button>
              </form>
            </div>
          ) : (
            <div>
              <FormFeedback state={extState} />
              <form action={extAction} className="mt-4 space-y-4 text-xs font-sans">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="ext_name" className="block font-heading font-bold uppercase text-ink">
                      Asset Name *
                    </label>
                    <input
                      type="text"
                      id="ext_name"
                      name="name"
                      required
                      maxLength={200}
                      className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                      placeholder="e.g. Launch Video Master"
                    />
                  </div>

                  <div>
                    <label htmlFor="ext_kind" className="block font-heading font-bold uppercase text-ink">
                      Kind *
                    </label>
                    <input
                      type="text"
                      id="ext_kind"
                      name="kind"
                      required
                      maxLength={200}
                      className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                      placeholder="e.g. video, artwork, archive"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="externalUrl" className="block font-heading font-bold uppercase text-ink">
                    External Resource URL (HTTP/HTTPS) *
                  </label>
                  <input
                    type="url"
                    id="externalUrl"
                    name="externalUrl"
                    required
                    maxLength={2048}
                    className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                    placeholder="https://vimeo.com/... or https://figma.com/..."
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="label" className="block font-heading font-bold uppercase text-ink">
                      Label
                    </label>
                    <input
                      type="text"
                      id="label"
                      name="label"
                      maxLength={200}
                      className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none"
                      placeholder="e.g. 4K Master"
                    />
                  </div>

                  <div>
                    <label htmlFor="format" className="block font-heading font-bold uppercase text-ink">
                      Format
                    </label>
                    <input
                      type="text"
                      id="format"
                      name="format"
                      maxLength={200}
                      className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none"
                      placeholder="e.g. ProRes 422, MP4"
                    />
                  </div>

                  <div>
                    <label htmlFor="sourceFilename" className="block font-heading font-bold uppercase text-ink">
                      Source Filename
                    </label>
                    <input
                      type="text"
                      id="sourceFilename"
                      name="sourceFilename"
                      maxLength={255}
                      className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none"
                      placeholder="e.g. master_cut_v2.mov"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="notes" className="block font-heading font-bold uppercase text-ink">
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={2}
                    maxLength={20000}
                    className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none"
                    placeholder="Production notes for this asset"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isExtPending}
                  className="w-full border-2 border-ink bg-ink py-2 font-heading text-xs font-bold uppercase tracking-widest text-cream hover:bg-rejection-red disabled:opacity-50"
                >
                  {isExtPending ? "Creating..." : "Create External Asset"}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
