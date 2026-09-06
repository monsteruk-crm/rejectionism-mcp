"use client";

import { useState } from "react";
import { UploadForm } from "@/app/upload/_components/upload-form";
import type { PublicUploadRequestDto } from "@/lib/uploads/client-contract";
import { createUploadRequestAction } from "../../upload-links/actions";
import { FormFeedback } from "../../_components/form-feedback";

interface AssetOption {
  id: string;
  name: string;
  kind: string;
  latestRevisionNumber: number | null;
  revisions?: Array<{ id: string; revisionNumber: number; label: string | null }>;
}

export function AdminAssetUpload({ assets }: { assets: AssetOption[] }) {
  const [groupingMode, setGroupingMode] = useState<
    "NEW_ASSETS" | "NEW_REVISION" | "APPEND_REPRESENTATIONS"
  >("NEW_ASSETS");

  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>("");
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Active session data
  const [activeSession, setActiveSession] = useState<{
    token: string;
    requestDto: PublicUploadRequestDto;
  } | null>(null);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  const handleInitializeSession = async () => {
    setIsInitializing(true);
    setInitError(null);

    try {
      if (groupingMode === "NEW_REVISION" && !selectedAssetId) {
        throw new Error("Please select a target asset for the new revision.");
      }

      if (groupingMode === "APPEND_REPRESENTATIONS" && (!selectedAssetId || !selectedRevisionId)) {
        throw new Error("Please select both a target asset and revision.");
      }

      const formData = new FormData();
      formData.set("title", `Admin asset upload - ${groupingMode}`);
      formData.set("maxItems", "50");
      formData.set("expiresInDays", "1");

      if (groupingMode === "NEW_REVISION") {
        formData.set("targetAssetId", selectedAssetId);
      } else if (groupingMode === "APPEND_REPRESENTATIONS") {
        formData.set("targetAssetId", selectedAssetId);
        formData.set("targetRevisionId", selectedRevisionId);
      }

      const res = await createUploadRequestAction(null, formData);

      if (!res.ok) {
        throw new Error(res.error || "Failed to initialize upload session.");
      }
      if (!res.data) {
        throw new Error("Failed to initialize upload session.");
      }

      const rawToken = res.data.uploadUrl.split("/upload/")[1];
      if (!rawToken) {
        throw new Error("Invalid upload URL returned.");
      }

      const publicDto: PublicUploadRequestDto = {
        title: `Admin asset upload`,
        instructions:
          groupingMode === "NEW_ASSETS"
            ? "Submissions will create separate visual assets."
            : groupingMode === "NEW_REVISION"
              ? `Submissions will create a new revision on asset: ${selectedAsset?.name || selectedAssetId}`
              : `Submissions will append representations to revision on asset: ${selectedAsset?.name || selectedAssetId}`,
        expiresAt: res.data.expiresAt,
        maxItems: 50,
        targetingMode: groupingMode,
        status: "OPEN",
        allowedMimeTypes: [
          "image/png",
          "image/jpeg",
          "image/gif",
          "image/webp",
          "image/svg+xml",
          "application/pdf",
          "application/zip",
        ],
        maxFileBytes: 104_857_600,
        maxSvgBytes: 2_097_152,
        maxSubmissionBytes: 524_288_000,
      };

      setActiveSession({
        token: rawToken,
        requestDto: publicDto,
      });
    } catch (err) {
      setInitError(err instanceof Error ? err.message : "Failed to initialize session.");
    } finally {
      setIsInitializing(false);
    }
  };

  if (activeSession) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between border-2 border-ink bg-paper p-4">
          <div>
            <p className="font-heading text-xs font-bold uppercase tracking-wider text-rejection-red">
              Active Upload Session // {groupingMode.replace(/_/g, " ")}
            </p>
            <p className="font-sans text-xs text-ink/70">
              Files uploaded here will be processed directly into the asset register.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveSession(null)}
            className="border border-ink bg-cream px-3 py-1 font-heading text-xs font-bold uppercase hover:bg-ink hover:text-cream"
          >
            Change Mode / Reset
          </button>
        </div>

        <UploadForm
          uploadToken={activeSession.token}
          request={activeSession.requestDto}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
      <h2 className="border-b-2 border-ink pb-3 font-heading text-2xl font-black uppercase">
        Step 1: Choose Grouping Mode
      </h2>

      <p className="mt-3 font-sans text-xs text-ink/80">
        Specify how incoming uploaded files and external links should be registered in the
        system. Grouping mode must be selected before file preparation.
      </p>

      {initError && (
        <div className="mt-4 border-2 border-blood-red bg-paper p-4 font-sans text-xs text-blood-red">
          <strong>Error:</strong> {initError}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {/* Option 1 */}
        <label
          className={`flex cursor-pointer items-start gap-3 border-2 p-4 transition-colors ${
            groupingMode === "NEW_ASSETS"
              ? "border-ink bg-cream shadow-[2px_2px_0px_0px_rgba(13,13,13,1)]"
              : "border-ink/30 bg-paper hover:border-ink"
          }`}
        >
          <input
            type="radio"
            name="groupingMode"
            value="NEW_ASSETS"
            checked={groupingMode === "NEW_ASSETS"}
            onChange={() => setGroupingMode("NEW_ASSETS")}
            className="mt-1"
          />
          <div>
            <p className="font-heading text-sm font-bold uppercase text-ink">
              1. Separate New Assets
            </p>
            <p className="mt-1 font-sans text-xs text-ink/70">
              Each uploaded file or link creates a brand new independent Asset with revision 1.
            </p>
          </div>
        </label>

        {/* Option 2 */}
        <label
          className={`flex cursor-pointer items-start gap-3 border-2 p-4 transition-colors ${
            groupingMode === "NEW_REVISION"
              ? "border-ink bg-cream shadow-[2px_2px_0px_0px_rgba(13,13,13,1)]"
              : "border-ink/30 bg-paper hover:border-ink"
          }`}
        >
          <input
            type="radio"
            name="groupingMode"
            value="NEW_REVISION"
            checked={groupingMode === "NEW_REVISION"}
            onChange={() => setGroupingMode("NEW_REVISION")}
            className="mt-1"
          />
          <div className="flex-1">
            <p className="font-heading text-sm font-bold uppercase text-ink">
              2. New Revision of One Asset
            </p>
            <p className="mt-1 font-sans text-xs text-ink/70">
              All uploaded files will be combined into a single newly created revision on an
              existing asset.
            </p>

            {groupingMode === "NEW_REVISION" && (
              <div className="mt-3">
                <label
                  htmlFor="select_target_asset"
                  className="block font-heading text-xs font-bold uppercase text-ink"
                >
                  Select Target Asset:
                </label>
                <select
                  id="select_target_asset"
                  value={selectedAssetId}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  className="mt-1 w-full border-2 border-ink bg-paper p-2 font-sans text-xs text-ink focus:outline-none"
                >
                  <option value="">-- Choose an asset --</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.kind}) — v{a.latestRevisionNumber ?? 1}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </label>

        {/* Option 3 */}
        <label
          className={`flex cursor-pointer items-start gap-3 border-2 p-4 transition-colors ${
            groupingMode === "APPEND_REPRESENTATIONS"
              ? "border-ink bg-cream shadow-[2px_2px_0px_0px_rgba(13,13,13,1)]"
              : "border-ink/30 bg-paper hover:border-ink"
          }`}
        >
          <input
            type="radio"
            name="groupingMode"
            value="APPEND_REPRESENTATIONS"
            checked={groupingMode === "APPEND_REPRESENTATIONS"}
            onChange={() => setGroupingMode("APPEND_REPRESENTATIONS")}
            className="mt-1"
          />
          <div className="flex-1">
            <p className="font-heading text-sm font-bold uppercase text-ink">
              3. Representations of One Revision
            </p>
            <p className="mt-1 font-sans text-xs text-ink/70">
              All uploaded files will be appended as representations to a specific existing
              revision.
            </p>

            {groupingMode === "APPEND_REPRESENTATIONS" && (
              <div className="mt-3 space-y-3">
                <div>
                  <label
                    htmlFor="select_target_asset_rep"
                    className="block font-heading text-xs font-bold uppercase text-ink"
                  >
                    Select Target Asset:
                  </label>
                  <select
                    id="select_target_asset_rep"
                    value={selectedAssetId}
                    onChange={(e) => {
                      setSelectedAssetId(e.target.value);
                      setSelectedRevisionId("");
                    }}
                    className="mt-1 w-full border-2 border-ink bg-paper p-2 font-sans text-xs text-ink focus:outline-none"
                  >
                    <option value="">-- Choose an asset --</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.kind})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedAsset && selectedAsset.revisions && selectedAsset.revisions.length > 0 && (
                  <div>
                    <label
                      htmlFor="select_target_revision"
                      className="block font-heading text-xs font-bold uppercase text-ink"
                    >
                      Select Revision:
                    </label>
                    <select
                      id="select_target_revision"
                      value={selectedRevisionId}
                      onChange={(e) => setSelectedRevisionId(e.target.value)}
                      className="mt-1 w-full border-2 border-ink bg-paper p-2 font-sans text-xs text-ink focus:outline-none"
                    >
                      <option value="">-- Choose a revision --</option>
                      {selectedAsset.revisions.map((r) => (
                        <option key={r.id} value={r.id}>
                          Revision {r.revisionNumber} {r.label ? `(${r.label})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        </label>
      </div>

      <div className="mt-6 border-t border-ink/20 pt-4">
        <button
          type="button"
          onClick={handleInitializeSession}
          disabled={isInitializing}
          className="w-full border-2 border-ink bg-ink py-2.5 font-heading text-xs font-bold uppercase tracking-widest text-cream hover:bg-rejection-red disabled:opacity-50"
        >
          {isInitializing ? "Initializing..." : "Start Upload Session &rarr;"}
        </button>
      </div>
    </div>
  );
}
