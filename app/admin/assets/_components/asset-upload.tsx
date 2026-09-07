"use client";

import { useState, useEffect } from "react";
import { UploadForm } from "@/app/upload/_components/upload-form";
import type { PublicUploadRequestDto } from "@/lib/uploads/client-contract";
import { createAdminUploadSessionAction } from "../upload/actions";
import { EntityPicker } from "@/app/admin/_components/entity-picker";
import type { EntityLookupItem, AssetRevisionLookupItem } from "@/lib/campaign/admin-lookups";

export function AdminAssetUpload({ initialRequestId }: { initialRequestId?: string }) {
  const [groupingMode, setGroupingMode] = useState<
    "NEW_ASSETS" | "NEW_REVISION" | "APPEND_REPRESENTATIONS"
  >("NEW_ASSETS");

  const [selectedAsset, setSelectedAsset] = useState<EntityLookupItem | null>(null);
  const [selectedRevision, setSelectedRevision] = useState<AssetRevisionLookupItem | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Active session data
  const [activeSession, setActiveSession] = useState<{
    requestId: string;
    requestDto: PublicUploadRequestDto;
  } | null>(null);

  useEffect(() => {
    if (initialRequestId) {
      fetch("/api/uploads/status", {
        headers: {
          "X-CampaignOS-Upload-Request-Id": initialRequestId,
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.requestId) {
            setActiveSession({
              requestId: data.requestId,
              requestDto: {
                title: "Internal Admin Upload Session",
                instructions: "Files uploaded here will be processed directly into the asset register.",
                expiresAt: data.expiresAt,
                maxItems: data.maxItems,
                targetingMode: "NEW_ASSETS",
                status: data.effectiveStatus,
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
                submissionReceipt: data.receipt,
              },
            });
          }
        })
        .catch(() => undefined);
    }
  }, [initialRequestId]);

  const handleInitializeSession = async () => {
    setIsInitializing(true);
    setInitError(null);

    try {
      if (groupingMode === "NEW_REVISION" && !selectedAsset) {
        throw new Error("Please select a target asset for the new revision.");
      }

      if (groupingMode === "APPEND_REPRESENTATIONS" && (!selectedAsset || !selectedRevision)) {
        throw new Error("Please select both a target asset and revision.");
      }

      const formData = new FormData();
      if (groupingMode === "NEW_REVISION" && selectedAsset) {
        formData.set("targetAssetId", selectedAsset.id);
      } else if (groupingMode === "APPEND_REPRESENTATIONS" && selectedAsset && selectedRevision) {
        formData.set("targetAssetId", selectedAsset.id);
        formData.set("targetRevisionId", selectedRevision.id);
      }

      const res = await createAdminUploadSessionAction(null, formData);

      if (!res.ok) {
        throw new Error(res.error || "Failed to initialize upload session.");
      }
      if (!res.data) {
        throw new Error("Failed to initialize upload session.");
      }

      const publicDto: PublicUploadRequestDto = {
        title: "Internal Admin Upload Session",
        instructions:
          groupingMode === "NEW_ASSETS"
            ? "Submissions will create separate visual assets."
            : groupingMode === "NEW_REVISION"
              ? `Submissions will create a new revision on asset: ${selectedAsset?.title || selectedAsset?.id}`
              : `Submissions will append representations to revision on asset: ${selectedAsset?.title || selectedAsset?.id}`,
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
        requestId: res.data.id,
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
              Active Internal Upload Session // ID: #{activeSession.requestId.slice(-8)}
            </p>
            <p className="font-sans text-xs text-ink/70">
              Files uploaded here will be processed directly into the asset register without creating a public capability link.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirm("Reset current upload session view? Any active session will remain available in history.")) {
                setActiveSession(null);
              }
            }}
            className="cursor-pointer border border-ink bg-cream px-3 py-1 font-heading text-xs font-bold uppercase hover:bg-ink hover:text-cream"
          >
            Change Mode / Reset
          </button>
        </div>

        <UploadForm
          requestId={activeSession.requestId}
          request={activeSession.requestDto}
          isAdminInternal={true}
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
        system. Internal sessions use your active admin session and create no public capability URLs.
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
                <EntityPicker
                  label="Select Target Asset *"
                  entityTypes={["ASSET"]}
                  selectedItem={selectedAsset}
                  onSelect={(item) => setSelectedAsset(item)}
                />
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
              <div className="mt-3">
                <EntityPicker
                  label="Select Target Asset & Revision *"
                  entityTypes={["ASSET"]}
                  selectedItem={selectedAsset}
                  onSelect={(item) => {
                    setSelectedAsset(item);
                    setSelectedRevision(null);
                  }}
                  allowRevisionSelection={true}
                  selectedRevision={selectedRevision}
                  onSelectRevision={(rev) => setSelectedRevision(rev)}
                />
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
          className="cursor-pointer w-full border-2 border-ink bg-ink py-2.5 font-heading text-xs font-bold uppercase tracking-widest text-cream hover:bg-rejection-red disabled:opacity-50"
        >
          {isInitializing ? "Initializing..." : "Start Upload Session &rarr;"}
        </button>
      </div>
    </div>
  );
}
