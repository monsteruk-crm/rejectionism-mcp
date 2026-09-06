import { AllowedMimeType, ALLOWED_MIME_EXTENSIONS } from "@/lib/campaign/file-validation";
import { UploadFileFailureCode } from "@/lib/campaign/upload-files";

/**
 * Browser-safe client contracts and types for upload routes and UI
 * (upgrade plan section 5, "Public upload and API boundaries"; section 6).
 */

export interface PublicUploadRequestDto {
  title: string;
  instructions: string;
  expiresAt: string;
  maxItems: number;
  targetingMode: "NEW_ASSETS" | "NEW_REVISION" | "APPEND_REPRESENTATIONS";
  status: "OPEN" | "SUBMITTED" | "REVOKED" | "EXPIRED";
  allowedMimeTypes: AllowedMimeType[];
  maxFileBytes: number;
  maxSvgBytes: number;
  maxSubmissionBytes: number;
  submissionReceipt?: {
    submissionKey: string;
    submittedAt: string;
    itemCount: number;
  } | null;
}

export type UploadRowType = "FILE" | "EXTERNAL_URL";

export interface ClientFileItem {
  clientItemId: string; // UUID
  type: "FILE";
  file: File | null;
  fileId: string | null;
  blobPathname: string | null;
  name: string;
  kind: string;
  notes: string;
  label: string;
  variant: string;
  format: string;
  // Progress & verification states
  status: "IDLE" | "PREPARING" | "UPLOADING" | "VERIFYING" | "VERIFIED" | "REJECTED" | "ERROR";
  uploadProgress: number; // 0..100
  verifiedMimeType?: string;
  verifiedByteSize?: number;
  width?: number | null;
  height?: number | null;
  failureCode?: UploadFileFailureCode;
  errorMessage?: string;
}

export interface ClientExternalUrlItem {
  clientItemId: string; // UUID
  type: "EXTERNAL_URL";
  externalUrl: string;
  name: string;
  kind: string;
  notes: string;
  label: string;
  variant: string;
  format: string;
  status: "IDLE" | "ERROR" | "VERIFIED";
  errorMessage?: string;
}

export type ClientUploadItem = ClientFileItem | ClientExternalUrlItem;

export interface PrepareFileResponse {
  fileId: string;
  blobPathname: string;
  clientItemId: string;
}

export interface VerifyFileResponse {
  fileId: string;
  status: "PENDING" | "VERIFIED" | "REJECTED" | "ATTACHED" | "DISCARDED";
  mimeType?: string;
  byteSize?: number;
  width?: number | null;
  height?: number | null;
  failureCode?: UploadFileFailureCode;
}

export interface FinalizeSubmissionResponse {
  ok: true;
  receipt: {
    requestId: string;
    submissionKey: string;
    submittedAt: string;
    itemCount: number;
  };
}

export interface ApiErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
}

export const ALLOWED_FORMATS_DISPLAY = [
  { mime: "image/png", label: "PNG", ext: ".png", maxSize: "100 MB" },
  { mime: "image/jpeg", label: "JPEG", ext: ".jpg, .jpeg", maxSize: "100 MB" },
  { mime: "image/gif", label: "GIF", ext: ".gif", maxSize: "100 MB" },
  { mime: "image/webp", label: "WebP", ext: ".webp", maxSize: "100 MB" },
  { mime: "image/svg+xml", label: "SVG Master", ext: ".svg", maxSize: "2 MB" },
  { mime: "application/pdf", label: "PDF Document", ext: ".pdf", maxSize: "100 MB" },
  { mime: "application/zip", label: "ZIP Archive", ext: ".zip", maxSize: "100 MB" },
] as const;

export function mapMimeTypeFromExtension(filename: string): AllowedMimeType | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "pdf":
      return "application/pdf";
    case "zip":
      return "application/zip";
    default:
      return null;
  }
}
