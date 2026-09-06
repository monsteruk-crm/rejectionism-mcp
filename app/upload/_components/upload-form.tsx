"use client";

import { useState, useCallback, useRef } from "react";
import { upload } from "@vercel/blob/client";
import {
  ALLOWED_FORMATS_DISPLAY,
  ClientExternalUrlItem,
  ClientFileItem,
  ClientUploadItem,
  mapMimeTypeFromExtension,
  PublicUploadRequestDto,
} from "@/lib/uploads/client-contract";
import { isAllowedMimeType } from "@/lib/campaign/file-validation";

interface UploadFormProps {
  uploadToken: string;
  request: PublicUploadRequestDto;
}

export function UploadForm({ uploadToken, request }: UploadFormProps) {
  const [items, setItems] = useState<ClientUploadItem[]>([]);
  const [isSubmittingFinalize, setIsSubmittingFinalize] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [completedReceipt, setCompletedReceipt] = useState<{
    submissionKey: string;
    submittedAt: string;
    itemCount: number;
  } | null>(request.submissionReceipt ?? null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const submissionKeyRef = useRef<string | null>(null);

  // Add files selected via file dialog or drop
  const handleFilesSelected = (files: FileList | File[]) => {
    const newItems: ClientFileItem[] = [];
    const remainingSlots = request.maxItems - items.length;

    for (let i = 0; i < Math.min(files.length, remainingSlots); i++) {
      const file = files[i];
      if (!file) continue;

      const detectedMime =
        (file.type && isAllowedMimeType(file.type) ? file.type : mapMimeTypeFromExtension(file.name)) ??
        "image/png";

      const baseName = file.name.replace(/\.[^/.]+$/, "") || "Artwork";

      newItems.push({
        clientItemId: crypto.randomUUID(),
        type: "FILE",
        file,
        fileId: null,
        blobPathname: null,
        name: baseName,
        kind: "artwork",
        notes: "",
        label: baseName,
        variant: "",
        format: detectedMime,
        status: "IDLE",
        uploadProgress: 0,
      });
    }

    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems]);
      // Auto-trigger preparation and upload for new file items
      for (const item of newItems) {
        processFileUpload(item, item.format || "image/png");
      }
    }
  };

  const processFileUpload = async (item: ClientFileItem, mimeType: string) => {
    if (!item.file) return;

    // 1. Prepare
    updateItem(item.clientItemId, { status: "PREPARING", errorMessage: undefined });
    let fileId: string;
    let blobPathname: string;

    try {
      const prepRes = await fetch("/api/uploads/prepare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Upload ${uploadToken}`,
        },
        body: JSON.stringify({
          clientItemId: item.clientItemId,
          sourceFilename: item.file.name,
          declaredMimeType: mimeType,
          expectedByteSize: item.file.size,
        }),
      });

      const prepData = await prepRes.json();
      if (!prepRes.ok || !prepData.ok) {
        throw new Error(prepData.error?.message || "Failed to reserve file slot.");
      }

      fileId = prepData.fileId;
      blobPathname = prepData.blobPathname;
      updateItem(item.clientItemId, { fileId, blobPathname, status: "UPLOADING" });
    } catch (err) {
      updateItem(item.clientItemId, {
        status: "ERROR",
        errorMessage: err instanceof Error ? err.message : "Preparation failed.",
      });
      return;
    }

    // 2. Direct Upload via @vercel/blob/client
    try {
      await upload(blobPathname, item.file, {
        access: "private",
        handleUploadUrl: "/api/uploads/blob",
        clientPayload: JSON.stringify({ uploadToken, fileId }),
        multipart: item.file.size > 8_388_608,
        onUploadProgress: (progress) => {
          updateItem(item.clientItemId, { uploadProgress: progress.percentage });
        },
      });
      updateItem(item.clientItemId, { status: "VERIFYING", uploadProgress: 100 });
    } catch (err) {
      updateItem(item.clientItemId, {
        status: "ERROR",
        errorMessage: err instanceof Error ? err.message : "Upload transfer failed.",
      });
      return;
    }

    // 3. Verify
    try {
      const verifyRes = await fetch("/api/uploads/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Upload ${uploadToken}`,
        },
        body: JSON.stringify({ fileId }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.ok) {
        throw new Error(verifyData.error?.message || "Verification failed.");
      }

      if (verifyData.status === "VERIFIED") {
        updateItem(item.clientItemId, {
          status: "VERIFIED",
          verifiedMimeType: verifyData.mimeType,
          verifiedByteSize: verifyData.byteSize,
          width: verifyData.width,
          height: verifyData.height,
        });
      } else if (verifyData.status === "REJECTED") {
        updateItem(item.clientItemId, {
          status: "REJECTED",
          failureCode: verifyData.failureCode,
          errorMessage: `File rejected: ${verifyData.failureCode || "Format mismatch"}.`,
        });
      } else {
        updateItem(item.clientItemId, {
          status: "ERROR",
          errorMessage: "Verification pending. Please retry.",
        });
      }
    } catch (err) {
      updateItem(item.clientItemId, {
        status: "ERROR",
        errorMessage: err instanceof Error ? err.message : "Verification request failed.",
      });
    }
  };

  const updateItem = useCallback((clientItemId: string, updates: Partial<ClientUploadItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.clientItemId === clientItemId ? ({ ...item, ...updates } as ClientUploadItem) : item)),
    );
  }, []);

  const addExternalUrlRow = () => {
    if (items.length >= request.maxItems) return;
    const newItem: ClientExternalUrlItem = {
      clientItemId: crypto.randomUUID(),
      type: "EXTERNAL_URL",
      externalUrl: "",
      name: "External Resource",
      kind: "link",
      notes: "",
      label: "",
      variant: "",
      format: "",
      status: "IDLE",
    };
    setItems((prev) => [...prev, newItem]);
  };

  const removeItem = (clientItemId: string) => {
    setItems((prev) => prev.filter((item) => item.clientItemId !== clientItemId));
  };

  // Check if submission is ready
  const allFilesVerified =
    items.length > 0 &&
    items.every((item) => {
      if (item.type === "FILE") return item.status === "VERIFIED";
      if (item.type === "EXTERNAL_URL") return item.externalUrl.trim().startsWith("http");
      return false;
    });

  const handleFinalize = async () => {
    if (!allFilesVerified || isSubmittingFinalize) return;
    setIsSubmittingFinalize(true);
    setFinalizeError(null);

    // Keep the idempotency key stable until the server returns a receipt. If
    // the commit succeeds but its response is lost, the next click must send
    // the exact same key so finalization can replay the stored receipt.
    const submissionKey = submissionKeyRef.current ?? crypto.randomUUID();
    submissionKeyRef.current = submissionKey;
    const payloadItems = items.map((item) => {
      if (item.type === "FILE") {
        return {
          clientItemId: item.clientItemId,
          type: "FILE" as const,
          fileId: item.fileId!,
          name: item.name.trim() || "Artwork",
          kind: item.kind.trim() || "artwork",
          notes: item.notes.trim() || null,
          label: item.label.trim() || null,
          variant: item.variant.trim() || null,
          format: item.format.trim() || null,
        };
      }
      return {
        clientItemId: item.clientItemId,
        type: "EXTERNAL_URL" as const,
        externalUrl: item.externalUrl.trim(),
        name: item.name.trim() || "Resource",
        kind: item.kind.trim() || "link",
        notes: item.notes.trim() || null,
        label: item.label.trim() || null,
        variant: item.variant.trim() || null,
        format: item.format.trim() || null,
      };
    });

    try {
      const res = await fetch("/api/uploads/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Upload ${uploadToken}`,
        },
        body: JSON.stringify({
          submissionKey,
          items: payloadItems,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error?.message || "Finalization failed.");
      }

      setCompletedReceipt(data.receipt);
    } catch (err) {
      setFinalizeError(err instanceof Error ? err.message : "Submission finalization failed.");
    } finally {
      setIsSubmittingFinalize(false);
    }
  };

  if (completedReceipt) {
    return (
      <div className="bg-paper border border-ink/10 rounded-sm p-8 shadow-sm space-y-6">
        <div className="flex items-center space-x-3 text-green-700">
          <span className="text-2xl">&#10003;</span>
          <h2 className="text-xl font-bold font-serif">Submission Complete</h2>
        </div>
        <p className="text-sm text-ink/80">
          Your campaign deliverables have been securely received and recorded into the CampaignOS registry.
        </p>

        <div className="bg-cream p-4 rounded border border-ink/10 space-y-2 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-ink/60">SUBMISSION RECEIPT KEY:</span>
            <span className="font-bold">{completedReceipt.submissionKey}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink/60">RECORDED TIMESTAMP:</span>
            <span>{new Date(completedReceipt.submittedAt).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink/60">ITEMS DELIVERED:</span>
            <span>{completedReceipt.itemCount}</span>
          </div>
        </div>

        <p className="text-xs text-ink/50 italic">
          This upload link has now been consumed and cannot accept additional submissions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Instructions header */}
      <div className="bg-paper border border-ink/10 rounded-sm p-6 shadow-sm space-y-3">
        <h1 className="text-2xl font-bold font-serif text-ink">{request.title}</h1>
        {request.instructions && (
          <p className="text-sm text-ink/80 whitespace-pre-wrap">{request.instructions}</p>
        )}
        <div className="flex flex-wrap gap-4 pt-2 text-xs font-mono text-ink/60 border-t border-ink/10">
          <div>
            MAX ITEMS: <span className="font-bold text-ink">{request.maxItems}</span>
          </div>
          <div>
            EXPIRY: <span className="font-bold text-ink">{new Date(request.expiresAt).toLocaleDateString()}</span>
          </div>
          <div>
            TARGETING: <span className="font-bold text-ink">{request.targetingMode}</span>
          </div>
        </div>
      </div>

      {/* Allowed formats guidance */}
      <div className="bg-paper/50 border border-ink/10 rounded-sm p-4 text-xs">
        <span className="font-mono font-bold uppercase text-ink/60 block mb-2">Accepted Formats:</span>
        <div className="flex flex-wrap gap-2">
          {ALLOWED_FORMATS_DISPLAY.map((fmt) => (
            <span
              key={fmt.mime}
              className="px-2 py-1 bg-cream rounded border border-ink/10 text-ink/70 font-mono"
            >
              {fmt.label} ({fmt.ext}, max {fmt.maxSize})
            </span>
          ))}
        </div>
      </div>

      {/* Upload Rows */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono font-bold text-sm uppercase text-ink/80">Submission Items ({items.length}/{request.maxItems})</h2>
          <div className="space-x-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={items.length >= request.maxItems}
              className="px-3 py-1.5 bg-ink text-cream hover:bg-ink/90 disabled:opacity-50 text-xs font-mono font-bold rounded cursor-pointer"
            >
              + Add Files
            </button>
            <button
              type="button"
              onClick={addExternalUrlRow}
              disabled={items.length >= request.maxItems}
              className="px-3 py-1.5 bg-cream hover:bg-paper border border-ink/20 disabled:opacity-50 text-xs font-mono font-bold rounded cursor-pointer"
            >
              + Add External Link
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFilesSelected(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {items.length === 0 && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-ink/20 hover:border-ink/40 rounded-sm p-8 text-center bg-paper/40 cursor-pointer transition-colors"
          >
            <p className="text-sm font-medium text-ink/70">Click or drag and drop artwork files here to begin</p>
            <p className="text-xs text-ink/50 mt-1">Direct upload to secure private storage</p>
          </div>
        )}

        {items.map((item, idx) => (
          <div
            key={item.clientItemId}
            className="bg-paper border border-ink/10 rounded-sm p-4 space-y-3 shadow-xs"
          >
            <div className="flex items-center justify-between border-b border-ink/5 pb-2">
              <span className="text-xs font-mono font-bold text-ink/50 uppercase">
                Item #{idx + 1} &bull; {item.type}
              </span>
              <button
                type="button"
                onClick={() => removeItem(item.clientItemId)}
                className="text-xs text-rejection-red hover:underline font-mono cursor-pointer"
              >
                Remove
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-ink/60 font-mono mb-1">Display Name *</label>
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(item.clientItemId, { name: e.target.value })}
                  className="w-full px-2 py-1.5 bg-cream border border-ink/15 rounded text-ink"
                  required
                />
              </div>

              <div>
                <label className="block text-ink/60 font-mono mb-1">Category / Kind *</label>
                <input
                  type="text"
                  value={item.kind}
                  onChange={(e) => updateItem(item.clientItemId, { kind: e.target.value })}
                  className="w-full px-2 py-1.5 bg-cream border border-ink/15 rounded text-ink"
                  required
                />
              </div>

              {item.type === "EXTERNAL_URL" && (
                <div className="sm:col-span-2">
                  <label className="block text-ink/60 font-mono mb-1">External HTTPS URL *</label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/..."
                    value={item.externalUrl}
                    onChange={(e) => updateItem(item.clientItemId, { externalUrl: e.target.value })}
                    className="w-full px-2 py-1.5 bg-cream border border-ink/15 rounded text-ink"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-ink/60 font-mono mb-1">Label (Optional)</label>
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateItem(item.clientItemId, { label: e.target.value })}
                  className="w-full px-2 py-1.5 bg-cream border border-ink/15 rounded text-ink"
                />
              </div>

              <div>
                <label className="block text-ink/60 font-mono mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={item.notes}
                  onChange={(e) => updateItem(item.clientItemId, { notes: e.target.value })}
                  className="w-full px-2 py-1.5 bg-cream border border-ink/15 rounded text-ink"
                />
              </div>
            </div>

            {/* Status / Progress Indicator */}
            {item.type === "FILE" && (
              <div className="pt-2 border-t border-ink/5 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center space-x-2">
                  {item.status === "VERIFIED" && <span className="text-green-700 font-bold">&#10003; VERIFIED</span>}
                  {item.status === "UPLOADING" && (
                    <span className="text-blue-700">Uploading {item.uploadProgress}%...</span>
                  )}
                  {item.status === "VERIFYING" && <span className="text-amber-700">Inspecting bytes...</span>}
                  {item.status === "PREPARING" && <span className="text-ink/60">Reserving slot...</span>}
                  {item.status === "REJECTED" && (
                    <span className="text-rejection-red font-bold">REJECTED ({item.failureCode})</span>
                  )}
                  {item.status === "ERROR" && (
                    <span className="text-rejection-red">{item.errorMessage || "Error"}</span>
                  )}
                </div>
                <div className="text-ink/40">
                  {item.file ? `${(item.file.size / 1024).toFixed(1)} KB` : ""}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {finalizeError && (
        <div className="p-4 bg-red-50 border border-rejection-red/30 rounded text-rejection-red text-xs font-mono">
          {finalizeError}
        </div>
      )}

      {/* Finalize Button */}
      <div className="pt-4 flex justify-end">
        <button
          type="button"
          onClick={handleFinalize}
          disabled={!allFilesVerified || isSubmittingFinalize}
          className="px-6 py-2.5 bg-ink text-cream hover:bg-ink/90 disabled:opacity-40 text-sm font-mono font-bold rounded cursor-pointer transition-opacity"
        >
          {isSubmittingFinalize ? "Submitting Deliverables..." : "Finalize & Submit Artwork"}
        </button>
      </div>
    </div>
  );
}
