import { describe, expect, it } from "vitest";
import {
  canonicalExtensionForMime,
  detectMimeTypeFromBytes,
  extractImageDimensions,
  imageDimensionsExceedLimits,
  isAllowedMimeType,
  MAX_FILE_BYTES,
  MAX_SVG_BYTES,
  MAX_SUBMISSION_BYTES,
  MAX_RESERVATION_BYTES,
  maxBytesForMimeType,
  sanitizeUploadFilename,
  validateSvgDocument,
} from "@/lib/campaign/file-validation";

function pngWithDimensions(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // signature
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8); // IHDR length
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  bytes[24] = 0x08; // bit depth
  bytes[25] = 0x06; // color type RGBA
  return bytes;
}

describe("filename sanitization", () => {
  it("strips directory components using both separators", () => {
    expect(sanitizeUploadFilename("assets/logo.png")).toBe("logo.png");
    expect(sanitizeUploadFilename("C:\\tmp\\logo.png")).toBe("logo.png");
    expect(sanitizeUploadFilename("/etc/passwd")).toBe("passwd");
    expect(sanitizeUploadFilename("plain.png")).toBe("plain.png");
  });

  it("rejects unusable names", () => {
    expect(sanitizeUploadFilename("dir/")).toBe(null);
    expect(sanitizeUploadFilename("dir/\u0000.png")).toBe(null);
    expect(sanitizeUploadFilename("bad\u0007name.png")).toBe(null);
    expect(sanitizeUploadFilename("x".repeat(256))).toBe(null);
    expect(sanitizeUploadFilename("x".repeat(255))).toBe("x".repeat(255));
  });
});

describe("allowed MIME mapping", () => {
  it("maps each allowed MIME to its canonical extension", () => {
    expect(canonicalExtensionForMime("image/png")).toBe("png");
    expect(canonicalExtensionForMime("image/jpeg")).toBe("jpg");
    expect(canonicalExtensionForMime("image/svg+xml")).toBe("svg");
    expect(canonicalExtensionForMime("application/zip")).toBe("zip");
  });

  it("accepts only the exact allowed formats", () => {
    expect(isAllowedMimeType("image/webp")).toBe(true);
    expect(isAllowedMimeType("application/pdf")).toBe(true);
    expect(isAllowedMimeType("image/*")).toBe(false);
    expect(isAllowedMimeType("application/octet-stream")).toBe(false);
    expect(isAllowedMimeType("text/html")).toBe(false);
    expect(isAllowedMimeType("image/jpegx")).toBe(false);
  });

  it("enforces per-format byte caps", () => {
    expect(MAX_FILE_BYTES).toBe(104_857_600);
    expect(MAX_SVG_BYTES).toBe(2_097_152);
    expect(maxBytesForMimeType("image/png")).toBe(MAX_FILE_BYTES);
    expect(maxBytesForMimeType("image/svg+xml")).toBe(MAX_SVG_BYTES);
    expect(MAX_SUBMISSION_BYTES).toBe(524_288_000);
    expect(MAX_RESERVATION_BYTES).toBe(1_073_741_824);
  });
});

describe("byte-level format detection", () => {
  it("detects PNG, JPEG, GIF, WebP, PDF, and ZIP from leading bytes", async () => {
    expect(await detectMimeTypeFromBytes(pngWithDimensions(1, 1))).toBe("image/png");
    expect(await detectMimeTypeFromBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]))).toBe("image/jpeg");
    expect(await detectMimeTypeFromBytes(new TextEncoder().encode("GIF89a"))).toBe("image/gif");
    expect(
      await detectMimeTypeFromBytes(new TextEncoder().encode("RIFF\x00\x00\x00\x00WEBPVP8 \x00\x00\x00\x00")),
    ).toBe("image/webp");
    expect(await detectMimeTypeFromBytes(new TextEncoder().encode("%PDF-1.4\n"))).toBe("application/pdf");
    expect(await detectMimeTypeFromBytes(new TextEncoder().encode("PK\x03\x04"))).toBe("application/zip");
  });

  it("returns null for unrecognized or script content", async () => {
    expect(await detectMimeTypeFromBytes(new TextEncoder().encode("<html><body></body></html>"))).toBeNull();
    expect(await detectMimeTypeFromBytes(new TextEncoder().encode("plain text"))).toBeNull();
    expect(await detectMimeTypeFromBytes(new Uint8Array(0))).toBeNull();
  });
});

describe("SVG document validation", () => {
  const encoder = new TextEncoder();

  it("accepts a well-formed SVG with the SVG namespace", () => {
    const svg = encoder.encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
    expect(validateSvgDocument(svg)).toEqual({ ok: true });
  });

  it("rejects DOCTYPE and ENTITY declarations before parsing", () => {
    const withDoctype = encoder.encode(
      '<!DOCTYPE svg [<!ENTITY xxe "x">]><svg xmlns="http://www.w3.org/2000/svg"></svg>',
    );
    expect(validateSvgDocument(withDoctype)).toEqual({ ok: false, reason: "DOCTYPE_DECLARED" });

    const withEntity = encoder.encode(
      '<svg xmlns="http://www.w3.org/2000/svg"><!ENTITY boom "x"></svg>',
    );
    expect(validateSvgDocument(withEntity)).toEqual({ ok: false, reason: "ENTITY_DECLARED" });
  });

  it("rejects malformed XML, wrong roots, and missing namespaces", () => {
    expect(validateSvgDocument(encoder.encode("<svg><svg>"))).toEqual({
      ok: false,
      reason: "MALFORMED_XML",
    });
    expect(validateSvgDocument(encoder.encode("<rect/>"))).toEqual({
      ok: false,
      reason: "MISSING_SVG_ROOT",
    });
    expect(validateSvgDocument(encoder.encode("<svg></svg>"))).toEqual({
      ok: false,
      reason: "MISSING_SVG_NAMESPACE",
    });
  });

  it("rejects invalid UTF-8 payloads", () => {
    const invalid = new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0xff, 0xfe, 0x3e]); // <svg> + invalid
    expect(validateSvgDocument(invalid).ok).toBe(false);
  });
});

describe("image dimensions", () => {
  it("extracts dimensions from a bounded PNG header", () => {
    expect(extractImageDimensions(pngWithDimensions(2, 3))).toEqual({ width: 2, height: 3 });
  });

  it("returns null for non-image bytes", () => {
    expect(extractImageDimensions(new TextEncoder().encode("%PDF-1.4\n"))).toBeNull();
    expect(extractImageDimensions(new Uint8Array(0))).toBeNull();
  });

  it("enforces axis and area limits", () => {
    expect(imageDimensionsExceedLimits({ width: 32_768, height: 1 })).toBe(false);
    expect(imageDimensionsExceedLimits({ width: 32_769, height: 1 })).toBe(true);
    expect(imageDimensionsExceedLimits({ width: 1, height: 32_769 })).toBe(true);
    expect(imageDimensionsExceedLimits({ width: 10_000, height: 10_001 })).toBe(true);
    expect(imageDimensionsExceedLimits({ width: 10_000, height: 10_000 })).toBe(false);
  });
});
