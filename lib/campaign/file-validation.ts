/**
 * Server-side upload file validation (upgrade plan sections 5 and 8,
 * "Vercel Blob and file validation" and "Filename, MIME, and size
 * enforcement").
 *
 * Browser metadata is never authoritative: the server decides acceptance
 * from provider-observed byte size and byte-level content inspection. All
 * functions here are pure (no "server-only") so unit tests exercise them
 * directly; no provider call happens in this module.
 */

import { fileTypeFromBuffer } from "file-type";
import { imageSize } from "image-size";
import { XMLParser, XMLValidator } from "fast-xml-parser";

/** Allowed declaration/extension mapping (exact, no wildcards). */
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

/** Maximum size of one uploaded file in bytes. */
export const MAX_FILE_BYTES = 104_857_600;
/** Maximum SVG file size in bytes. */
export const MAX_SVG_BYTES = 2_097_152;
/** Maximum sum of file sizes in one finalized submission. */
export const MAX_SUBMISSION_BYTES = 524_288_000;
/** Maximum summed expectedByteSize of lifetime reservations per request. */
export const MAX_RESERVATION_BYTES = 1_073_741_824;
/** Bytes read for file-type/header inspection. */
export const INSPECTION_PREFIX_BYTES = 262_144;
/** Image dimension limits. */
export const MAX_IMAGE_AXIS = 32_768;
export const MAX_IMAGE_AREA = 100_000_000;

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return Object.hasOwn(ALLOWED_MIME_EXTENSIONS, value);
}

export function canonicalExtensionForMime(mime: AllowedMimeType): string {
  return ALLOWED_MIME_EXTENSIONS[mime];
}

/**
 * Canonical extension for a MIME value previously persisted in UploadFile.
 * Reservation guarantees an allowed MIME; unknown values fall back to the
 * stored string instead of throwing.
 */
export function canonicalExtensionForStoredMime(mime: string): string {
  return isAllowedMimeType(mime) ? ALLOWED_MIME_EXTENSIONS[mime] : mime;
}

const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/;

/**
 * Sanitizes a display filename: strips directory components using both `/`
 * and `\`, rejects NUL/control characters, and enforces 1..255 characters.
 * Returns null when the name is unusable. The filename is display metadata
 * and never contributes to a storage path or HTTP header.
 */
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

/** Per-file byte cap for one file of the given declared MIME type. */
export function maxBytesForMimeType(mime: AllowedMimeType): number {
  return mime === "image/svg+xml" ? MAX_SVG_BYTES : MAX_FILE_BYTES;
}

export interface DetectedFormat {
  mime: string;
}

/**
 * Detects PNG/JPEG/GIF/WebP/PDF/ZIP from leading bytes. Returns null when
 * the format is unrecognized. ZIP container variants detected as other
 * formats come back as their concrete MIME and are rejected by the caller
 * (never reclassified as application/zip without validation).
 */
export async function detectMimeTypeFromBytes(bytes: Uint8Array): Promise<string | null> {
  const result = await fileTypeFromBuffer(bytes);
  return result?.mime ?? null;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Extracts image dimensions from a bounded raster prefix. Returns null when
 * dimensions are unavailable; browser dimension assertions are never used.
 */
export function extractImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  try {
    const size = imageSize(bytes);
    if (
      typeof size.width === "number" &&
      Number.isFinite(size.width) &&
      typeof size.height === "number" &&
      Number.isFinite(size.height)
    ) {
      return { width: size.width, height: size.height };
    }
    return null;
  } catch {
    return null;
  }
}

/** True when either axis exceeds 32768 or the area exceeds 100000000 pixels. */
export function imageDimensionsExceedLimits(dimensions: ImageDimensions): boolean {
  return (
    dimensions.width > MAX_IMAGE_AXIS ||
    dimensions.height > MAX_IMAGE_AXIS ||
    dimensions.width * dimensions.height > MAX_IMAGE_AREA
  );
}

export const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export type SvgValidationResult =
  | { ok: true }
  | { ok: false; reason: "INVALID_UTF8" | "DOCTYPE_DECLARED" | "ENTITY_DECLARED" | "MALFORMED_XML" | "MISSING_SVG_ROOT" | "MISSING_SVG_NAMESPACE" };

/**
 * Validates an SVG document: well-formed UTF-8 XML, no DOCTYPE or ENTITY
 * declarations (rejected before parsing, with entity processing disabled),
 * exactly one `svg` root element carrying the SVG namespace. This checks
 * format only — SVG is never safe to execute and is always delivered as an
 * attachment.
 */
export function validateSvgDocument(bytes: Uint8Array): SvgValidationResult {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, reason: "INVALID_UTF8" };
  }

  if (/<!doctype/i.test(text)) {
    return { ok: false, reason: "DOCTYPE_DECLARED" };
  }
  if (/<!entity/i.test(text)) {
    return { ok: false, reason: "ENTITY_DECLARED" };
  }

  if (XMLValidator.validate(text) !== true) {
    return { ok: false, reason: "MALFORMED_XML" };
  }

  const parser = new XMLParser({ processEntities: false, ignoreAttributes: false });
  const parsed: unknown = parser.parse(text);
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, reason: "MALFORMED_XML" };
  }

  const rootKeys = Object.keys(parsed as Record<string, unknown>).filter(
    (key) => !key.startsWith("?"),
  );
  if (rootKeys.length !== 1 || rootKeys[0] !== "svg") {
    return { ok: false, reason: "MISSING_SVG_ROOT" };
  }

  const root = (parsed as Record<string, unknown>)["svg"];
  const attributes =
    typeof root === "object" && root !== null ? (root as Record<string, unknown>) : {};
  if (attributes["@_xmlns"] !== SVG_NAMESPACE) {
    return { ok: false, reason: "MISSING_SVG_NAMESPACE" };
  }

  return { ok: true };
}
