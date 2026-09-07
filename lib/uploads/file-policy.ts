/**
 * Browser-safe file validation policies, MIME mappings, and upload budgets.
 * Safe for import in both server and client environments (zero server-only dependencies).
 */

export const ALLOWED_MIME_EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "application/zip": "zip",
} as const;

export type AllowedMimeType = keyof typeof ALLOWED_MIME_EXTENSIONS;

export const MAX_FILE_BYTES = 104_857_600; // 100 MB
export const MAX_SVG_BYTES = 2_097_152; // 2 MB
export const MAX_SUBMISSION_BYTES = 524_288_000; // 500 MB
export const MAX_RESERVATION_BYTES = 1_073_741_824; // 1 GB
export const MAX_IMAGE_AXIS = 32_768;
export const MAX_IMAGE_AREA = 100_000_000;
export const MAX_CONCURRENT_TRANSFERS = 3;

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return Object.hasOwn(ALLOWED_MIME_EXTENSIONS, value);
}

export function canonicalExtensionForMime(mime: AllowedMimeType): string {
  return ALLOWED_MIME_EXTENSIONS[mime];
}

export function canonicalExtensionForStoredMime(mime: string): string {
  return isAllowedMimeType(mime) ? ALLOWED_MIME_EXTENSIONS[mime] : mime;
}

export function maxBytesForMimeType(mime: AllowedMimeType): number {
  return mime === "image/svg+xml" ? MAX_SVG_BYTES : MAX_FILE_BYTES;
}

const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/;

export function sanitizeUploadFilename(raw: string): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const base = raw.split("/").pop()?.split("\\").pop() ?? "";
  if (base.length === 0 || base.length > 255 || CONTROL_CHAR_PATTERN.test(base)) {
    return null;
  }
  return base;
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
