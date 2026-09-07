/**
 * Session storage draft persistence for upload forms.
 *
 * Persists only non-secret metadata (item names, kinds, notes, labels, variants,
 * formats, and stable clientItemIds).
 * NEVER persists capability tokens, session cookies, Blob write tokens, or binary file bytes.
 */

export interface DraftItemMetadata {
  clientItemId: string;
  type: "FILE" | "EXTERNAL_URL";
  name: string;
  kind: string;
  notes: string;
  label: string;
  variant: string;
  format: string;
  externalUrl?: string;
  sourceFilename?: string;
}

export interface UploadDraftState {
  requestId: string;
  items: DraftItemMetadata[];
  frozenSubmissionKey?: string;
  frozenPayloadHash?: string;
  updatedAt: number;
}

const STORAGE_PREFIX = "campaignos_upload_draft_";

export function saveUploadDraft(requestId: string, draft: UploadDraftState): void {
  if (typeof window === "undefined" || !requestId) return;
  try {
    const key = `${STORAGE_PREFIX}${requestId}`;
    window.sessionStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Session storage full or disabled; quietly ignore
  }
}

export function loadUploadDraft(requestId: string): UploadDraftState | null {
  if (typeof window === "undefined" || !requestId) return null;
  try {
    const key = `${STORAGE_PREFIX}${requestId}`;
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.requestId === requestId && Array.isArray(parsed.items)) {
      return parsed as UploadDraftState;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearUploadDraft(requestId: string): void {
  if (typeof window === "undefined" || !requestId) return;
  try {
    const key = `${STORAGE_PREFIX}${requestId}`;
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore
  }
}
