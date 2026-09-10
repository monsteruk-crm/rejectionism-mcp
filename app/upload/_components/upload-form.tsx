"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { upload } from "@vercel/blob/client";
import Link from "next/link";
import {
  ALLOWED_FORMATS_DISPLAY,
  ClientExternalUrlItem,
  ClientFileItem,
  ClientUploadItem,
  mapMimeTypeFromExtension,
  PublicUploadRequestDto,
  UploadFileStatusDto,
} from "@/lib/uploads/client-contract";
import { isAllowedMimeType } from "@/lib/uploads/file-policy";
import { saveUploadDraft, loadUploadDraft, clearUploadDraft } from "@/lib/uploads/draft";

interface UploadFormProps {
  uploadToken?: string;
  requestId?: string;
  request: PublicUploadRequestDto;
  isAdminInternal?: boolean;
  initialServerFiles?: UploadFileStatusDto[];
}

const MAX_CONCURRENT_TRANSFERS = 3;

export function UploadForm({
  uploadToken,
  requestId: directRequestId,
  request,
  isAdminInternal = false,
  initialServerFiles,
}: UploadFormProps) {
  const [items, setItems] = useState<ClientUploadItem[]>([]);
  const [isSubmittingFinalize, setIsSubmittingFinalize] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTransfers, setActiveTransfers] = useState(0);

  const [completedReceipt, setCompletedReceipt] = useState<{
    submissionKey: string;
    submittedAt: string;
    itemCount: number;
    items?: Array<{
      clientItemId: string;
      name: string;
      assetId: string;
      revisionId: string;
      representationId: string;
    }>;
  } | null>(request.submissionReceipt ?? null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const submissionKeyRef = useRef<string | null>(null);
  const activeSessionKey = directRequestId || uploadToken || "upload_session";
  const getAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (uploadToken) {
      headers["Authorization"] = `Upload ${uploadToken}`;
    } else if (directRequestId) {
      headers["X-CampaignOS-Upload-Request-Id"] = directRequestId;
    }
    return headers;
  }, [directRequestId, uploadToken]);

  // Rehydrate non-secret form metadata locally, then merge authoritative
  // reservation IDs and verification states from the server.
  useEffect(() => {
    if (completedReceipt) return;
    const draft = loadUploadDraft(activeSessionKey);
    const restore = (serverFiles: UploadFileStatusDto[]) => {
      const draftItems = draft?.items ?? [];
      const serverByClientId = new Map(serverFiles.map((file) => [file.clientItemId, file]));
      const restoredItems: ClientUploadItem[] = draftItems.map((m) => {
        if (m.type === "EXTERNAL_URL") {
          return {
            clientItemId: m.clientItemId,
            type: "EXTERNAL_URL",
            externalUrl: m.externalUrl || "",
            name: m.name,
            kind: m.kind,
            notes: m.notes,
            label: m.label,
            variant: m.variant,
            format: m.format,
            status: m.externalUrl ? "VERIFIED" : "IDLE",
          };
        }
        const serverFile = serverByClientId.get(m.clientItemId);
        if (serverFile) serverByClientId.delete(m.clientItemId);
        return {
          clientItemId: m.clientItemId,
          type: "FILE",
          file: null, // Binary bytes are never stored in session storage
          fileId: serverFile?.id ?? null,
          blobPathname: null,
          name: m.name,
          kind: m.kind,
          notes: m.notes,
          label: m.label,
          variant: m.variant,
          format: m.format,
          status:
            serverFile?.status === "VERIFIED" || serverFile?.status === "ATTACHED"
              ? "VERIFIED"
              : serverFile?.status === "REJECTED"
                ? "REJECTED"
                : serverFile
                  ? "ERROR"
                  : "IDLE",
          uploadProgress: serverFile?.status === "VERIFIED" ? 100 : 0,
          verifiedMimeType: serverFile?.mimeType ?? undefined,
          verifiedByteSize: serverFile?.byteSize ?? undefined,
          failureCode: serverFile?.failureCode as ClientFileItem["failureCode"],
          errorMessage:
            serverFile?.status === "PENDING"
              ? "Upload reservation recovered. Click Retry Verification."
              : undefined,
        };
      });

      for (const serverFile of serverByClientId.values()) {
        const baseName = serverFile.sourceFilename.replace(/\.[^/.]+$/, "") || "Artwork";
        restoredItems.push({
          clientItemId: serverFile.clientItemId,
          type: "FILE",
          file: null,
          fileId: serverFile.id,
          blobPathname: null,
          name: baseName,
          kind: "artwork",
          notes: "",
          label: baseName,
          variant: "",
          format: serverFile.declaredMimeType,
          status:
            serverFile.status === "VERIFIED" || serverFile.status === "ATTACHED"
              ? "VERIFIED"
              : serverFile.status === "REJECTED"
                ? "REJECTED"
                : "ERROR",
          uploadProgress: serverFile.status === "VERIFIED" ? 100 : 0,
          verifiedMimeType: serverFile.mimeType ?? undefined,
          verifiedByteSize: serverFile.byteSize ?? undefined,
          failureCode: serverFile.failureCode as ClientFileItem["failureCode"],
          errorMessage:
            serverFile.status === "PENDING"
              ? "Upload reservation recovered. Click Retry Verification."
              : undefined,
        });
      }
      setItems(restoredItems);
      if (draft?.frozenSubmissionKey) {
        submissionKeyRef.current = draft.frozenSubmissionKey;
      }
    };

    if (initialServerFiles) {
      restore(initialServerFiles);
      return;
    }

    fetch("/api/uploads/status", { headers: getAuthHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to recover upload status.");
        return response.json() as Promise<{ files?: UploadFileStatusDto[] }>;
      })
      .then((status) => restore(status.files ?? []))
      .catch(() => restore([]));
  }, [activeSessionKey, completedReceipt, getAuthHeaders, initialServerFiles]);

  // Save non-secret metadata to sessionStorage on change
  useEffect(() => {
    if (completedReceipt || items.length === 0) return;
    saveUploadDraft(activeSessionKey, {
      requestId: activeSessionKey,
      items: items.map((item) => ({
        clientItemId: item.clientItemId,
        type: item.type,
        name: item.name,
        kind: item.kind,
        notes: item.notes,
        label: item.label,
        variant: item.variant,
        format: item.format,
        externalUrl: item.type === "EXTERNAL_URL" ? item.externalUrl : undefined,
        sourceFilename: item.type === "FILE" && item.file ? item.file.name : undefined,
      })),
      frozenSubmissionKey: submissionKeyRef.current ?? undefined,
      updatedAt: Date.now(),
    });
  }, [items, activeSessionKey, completedReceipt]);

  const updateItem = useCallback((clientItemId: string, updates: Partial<ClientUploadItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.clientItemId === clientItemId ? ({ ...item, ...updates } as ClientUploadItem) : item)),
    );
  }, []);

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
      for (const item of newItems) {
        processFileUpload(item, item.format || "image/png");
      }
    }
  };

  const processFileUpload = async (item: ClientFileItem, mimeType: string) => {
    if (!item.file) return;

    updateItem(item.clientItemId, { status: "PREPARING", errorMessage: undefined });
    let fileId: string;
    let blobPathname: string;

    try {
      const prepRes = await fetch("/api/uploads/prepare", {
        method: "POST",
        headers: getAuthHeaders(),
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

    // Direct Upload via @vercel/blob/client
    try {
      setActiveTransfers((c) => c + 1);
      const payloadObj: Record<string, string> = { fileId };
      if (uploadToken) payloadObj.uploadToken = uploadToken;
      if (directRequestId) payloadObj.requestId = directRequestId;

      await upload(blobPathname, item.file, {
        access: "private",
        handleUploadUrl: "/api/uploads/blob",
        clientPayload: JSON.stringify(payloadObj),
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
    } finally {
      setActiveTransfers((c) => Math.max(0, c - 1));
    }

    // Verify
    await retryVerification(item.clientItemId, fileId);
  };

  const retryVerification = async (clientItemId: string, fileId: string) => {
    updateItem(clientItemId, { status: "VERIFYING", errorMessage: undefined });
    try {
      const verifyRes = await fetch("/api/uploads/verify", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ fileId }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.ok) {
        throw new Error(verifyData.error?.message || "Verification failed.");
      }

      if (verifyData.status === "VERIFIED") {
        updateItem(clientItemId, {
          status: "VERIFIED",
          verifiedMimeType: verifyData.mimeType,
          verifiedByteSize: verifyData.byteSize,
          width: verifyData.width,
          height: verifyData.height,
        });
      } else if (verifyData.status === "REJECTED") {
        updateItem(clientItemId, {
          status: "REJECTED",
          failureCode: verifyData.failureCode,
          errorMessage: `File rejected: ${verifyData.failureCode || "Format mismatch"}.`,
        });
      } else {
        updateItem(clientItemId, {
          status: "ERROR",
          errorMessage: "Verification pending. Click Retry Verification.",
        });
      }
    } catch (err) {
      updateItem(clientItemId, {
        status: "ERROR",
        errorMessage: err instanceof Error ? err.message : "Verification request failed.",
      });
    }
  };

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
    const item = items.find((i) => i.clientItemId === clientItemId);
    if (item && item.status === "UPLOADING") {
      alert("Cannot remove a file while upload is in progress.");
      return;
    }
    setItems((prev) => prev.filter((i) => i.clientItemId !== clientItemId));
  };

  const allFilesVerified =
    items.length > 0 &&
    items.every((item) => {
      if (item.type === "FILE") return item.status === "VERIFIED";
      if (item.type === "EXTERNAL_URL") return item.externalUrl.trim().startsWith("http");
      return false;
    });

  const handleFinalize = async () => {
    if (!allFilesVerified || isSubmittingFinalize) return;

    // Check if any item is not verified
    const unverifiedCount = items.filter((i) => (i.type === "FILE" && i.status !== "VERIFIED") || (i.type === "EXTERNAL_URL" && !i.externalUrl.trim().startsWith("http"))).length;
    if (unverifiedCount > 0) {
      const confirmed = confirm(`You have ${unverifiedCount} unverified or incomplete item(s). Exclude them and proceed with only verified items?`);
      if (!confirmed) return;
    }

    setIsSubmittingFinalize(true);
    setFinalizeError(null);

    const submissionKey = submissionKeyRef.current ?? crypto.randomUUID();
    submissionKeyRef.current = submissionKey;

    const verifiedItems = items.filter((item) => {
      if (item.type === "FILE") return item.status === "VERIFIED" && item.fileId !== null;
      if (item.type === "EXTERNAL_URL") return item.externalUrl.trim().startsWith("http");
      return false;
    });

    const payloadItems = verifiedItems.map((item) => {
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
        headers: getAuthHeaders(),
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
      clearUploadDraft(activeSessionKey);
    } catch (err) {
      setFinalizeError(err instanceof Error ? err.message : "Submission finalization failed.");
    } finally {
      setIsSubmittingFinalize(false);
    }
  };

  if (completedReceipt) {
    return (
      <div className="border-2 border-ink bg-paper p-8 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)] space-y-6">
        <div className="flex items-center space-x-3 text-ink">
          <span className="text-2xl font-black text-rejection-red">&#10003;</span>
          <h2 className="font-heading text-2xl font-black uppercase tracking-wider">Submission Complete</h2>
        </div>
        <p className="text-xs text-ink/80">
          Your campaign deliverables have been securely processed into the CampaignOS registry.
        </p>

        <div className="border border-ink bg-cream p-4 space-y-2 text-xs font-mono">
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

        {isAdminInternal && (
          <div className="pt-2">
            <Link
              href="/admin/assets"
              className="inline-block border-2 border-ink bg-ink px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider text-cream hover:bg-rejection-red"
            >
              &larr; Return to Asset Library
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Instructions header */}
      <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)] space-y-3">
        <h1 className="font-heading text-2xl font-black uppercase text-ink">{request.title}</h1>
        {request.instructions && (
          <p className="text-xs text-ink/80 whitespace-pre-wrap">{request.instructions}</p>
        )}
        <div className="flex flex-wrap gap-4 pt-2 font-mono text-xs text-ink/60 border-t border-ink/15">
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
      <div className="border border-ink/30 bg-paper/50 p-4 text-xs">
        <span className="font-heading font-bold uppercase text-ink/70 block mb-2">Accepted Formats:</span>
        <div className="flex flex-wrap gap-2">
          {ALLOWED_FORMATS_DISPLAY.map((fmt) => (
            <span
              key={fmt.mime}
              className="px-2 py-1 bg-cream border border-ink/20 text-ink/80 font-mono text-[11px]"
            >
              {fmt.label} ({fmt.ext}, max {fmt.maxSize})
            </span>
          ))}
        </div>
      </div>

      {/* Upload Rows */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold text-xs uppercase text-ink/80">
            Submission Items ({items.length}/{request.maxItems})
          </h2>
          <div className="space-x-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={items.length >= request.maxItems}
              className="cursor-pointer border-2 border-ink bg-ink px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wider text-cream hover:bg-rejection-red disabled:opacity-50"
            >
              + Add Files
            </button>
            <button
              type="button"
              onClick={addExternalUrlRow}
              disabled={items.length >= request.maxItems}
              className="cursor-pointer border border-ink bg-cream px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wider text-ink hover:bg-paper disabled:opacity-50"
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
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files) handleFilesSelected(e.dataTransfer.files);
            }}
            className={`border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
              isDragging ? "border-rejection-red bg-cream" : "border-ink/30 bg-paper hover:border-ink"
            }`}
          >
            <p className="font-heading text-sm font-bold uppercase text-ink">
              Click or drag & drop artwork files here to begin
            </p>
            <p className="text-xs text-ink/60 mt-1">Direct upload to private storage (max 3 concurrent transfers)</p>
          </div>
        )}

        {items.map((item, idx) => (
          <div
            key={item.clientItemId}
            className="border-2 border-ink bg-paper p-4 space-y-3 shadow-[2px_2px_0px_0px_rgba(13,13,13,1)] text-xs"
          >
            <div className="flex items-center justify-between border-b border-ink/10 pb-2 font-heading uppercase font-bold">
              <span className="text-ink/60 text-[11px]">
                Item #{idx + 1} &bull; {item.type}
              </span>
              <button
                type="button"
                onClick={() => removeItem(item.clientItemId)}
                className="cursor-pointer text-xs text-rejection-red hover:underline"
              >
                Remove
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-heading font-bold uppercase text-ink mb-1">Display Name *</label>
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(item.clientItemId, { name: e.target.value })}
                  className="w-full border border-ink bg-cream p-1.5 text-ink"
                  required
                />
              </div>

              <div>
                <label className="block font-heading font-bold uppercase text-ink mb-1">Kind / Category *</label>
                <input
                  type="text"
                  value={item.kind}
                  onChange={(e) => updateItem(item.clientItemId, { kind: e.target.value })}
                  className="w-full border border-ink bg-cream p-1.5 text-ink"
                  required
                />
              </div>

              {item.type === "EXTERNAL_URL" && (
                <div className="sm:col-span-2">
                  <label className="block font-heading font-bold uppercase text-ink mb-1">External HTTPS URL *</label>
                  <input
                    type="url"
                    placeholder="https://example.com/asset.png"
                    value={item.externalUrl}
                    onChange={(e) => updateItem(item.clientItemId, { externalUrl: e.target.value })}
                    className="w-full border border-ink bg-cream p-1.5 font-mono text-ink"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block font-heading font-bold uppercase text-ink mb-1">Label (Optional)</label>
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateItem(item.clientItemId, { label: e.target.value })}
                  className="w-full border border-ink bg-cream p-1.5 text-ink"
                />
              </div>

              <div>
                <label className="block font-heading font-bold uppercase text-ink mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={item.notes}
                  onChange={(e) => updateItem(item.clientItemId, { notes: e.target.value })}
                  className="w-full border border-ink bg-cream p-1.5 text-ink"
                />
              </div>
            </div>

            {/* Status / Progress */}
            {item.type === "FILE" && (
              <div className="pt-2 border-t border-ink/10 flex items-center justify-between font-mono text-[11px]">
                <div className="flex items-center space-x-2">
                  {item.status === "VERIFIED" && <span className="text-green-700 font-bold">&#10003; VERIFIED</span>}
                  {item.status === "UPLOADING" && (
                    <span className="text-blue-700 font-bold">Uploading {item.uploadProgress}%...</span>
                  )}
                  {item.status === "VERIFYING" && <span className="text-amber-700 font-bold">Inspecting bytes...</span>}
                  {item.status === "PREPARING" && <span className="text-ink/60">Reserving slot...</span>}
                  {item.status === "REJECTED" && (
                    <span className="text-rejection-red font-bold">REJECTED ({item.failureCode})</span>
                  )}
                  {item.status === "ERROR" && (
                    <div className="flex items-center gap-2">
                      <span className="text-rejection-red font-bold">{item.errorMessage || "Error"}</span>
                      {item.fileId && (
                        <button
                          type="button"
                          onClick={() => retryVerification(item.clientItemId, item.fileId!)}
                          className="cursor-pointer border border-ink bg-cream px-2 py-0.5 text-[10px] font-bold uppercase hover:bg-ink hover:text-cream"
                        >
                          Retry Verify
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-ink/50">
                  {item.file ? `${(item.file.size / 1024).toFixed(1)} KB` : ""}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {finalizeError && (
        <div className="border-2 border-blood-red bg-paper p-4 font-mono text-xs text-rejection-red">
          {finalizeError}
        </div>
      )}

      {/* Finalize Button */}
      <div className="pt-4 flex justify-end">
        <button
          type="button"
          onClick={handleFinalize}
          disabled={!allFilesVerified || isSubmittingFinalize || activeTransfers > 0}
          className="cursor-pointer border-2 border-ink bg-ink px-6 py-2.5 font-heading text-xs font-bold uppercase tracking-widest text-cream hover:bg-rejection-red disabled:opacity-40"
        >
          {isSubmittingFinalize ? "Submitting Deliverables..." : "Finalize & Submit Artwork"}
        </button>
      </div>
    </div>
  );
}
