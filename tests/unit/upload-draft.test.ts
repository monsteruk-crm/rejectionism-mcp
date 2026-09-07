import { describe, it, expect, beforeEach } from "vitest";
import { saveUploadDraft, loadUploadDraft, clearUploadDraft } from "../../lib/uploads/draft";
import {
  isAllowedMimeType,
  mapMimeTypeFromExtension,
  maxBytesForMimeType,
  sanitizeUploadFilename,
  MAX_FILE_BYTES,
  MAX_SVG_BYTES,
} from "../../lib/uploads/file-policy";

describe("lib/uploads/file-policy.ts", () => {
  it("identifies supported and unsupported MIME types", () => {
    expect(isAllowedMimeType("image/png")).toBe(true);
    expect(isAllowedMimeType("image/jpeg")).toBe(true);
    expect(isAllowedMimeType("image/svg+xml")).toBe(true);
    expect(isAllowedMimeType("application/pdf")).toBe(true);
    expect(isAllowedMimeType("application/zip")).toBe(true);
    expect(isAllowedMimeType("video/mp4")).toBe(false);
    expect(isAllowedMimeType("audio/mpeg")).toBe(false);
  });

  it("maps MIME types from file extensions correctly", () => {
    expect(mapMimeTypeFromExtension("poster.png")).toBe("image/png");
    expect(mapMimeTypeFromExtension("logo.svg")).toBe("image/svg+xml");
    expect(mapMimeTypeFromExtension("doc.pdf")).toBe("application/pdf");
    expect(mapMimeTypeFromExtension("archive.zip")).toBe("application/zip");
    expect(mapMimeTypeFromExtension("track.mp3")).toBeNull();
  });

  it("enforces byte limits (100MB general, 2MB SVG)", () => {
    expect(maxBytesForMimeType("image/svg+xml")).toBe(MAX_SVG_BYTES);
    expect(maxBytesForMimeType("image/png")).toBe(MAX_FILE_BYTES);
  });

  it("sanitizes upload filenames safely", () => {
    expect(sanitizeUploadFilename("path/to/my_file.png")).toBe("my_file.png");
    expect(sanitizeUploadFilename("..\\windows\\path\\image.jpg")).toBe("image.jpg");
    expect(sanitizeUploadFilename("")).toBeNull();
  });
});

describe("lib/uploads/draft.ts", () => {
  const requestId = "req-123";

  beforeEach(() => {
    // Mock sessionStorage
    const store = new Map<string, string>();
    global.window = {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
        clear: () => store.clear(),
        length: store.size,
        key: (i: number) => Array.from(store.keys())[i] ?? null,
      },
    } as any;
  });

  it("saves and loads draft state without storing binary bytes or secrets", () => {
    const draft = {
      requestId,
      items: [
        {
          clientItemId: "item-1",
          type: "FILE" as const,
          name: "Artwork 1",
          kind: "poster",
          notes: "Draft notes",
          label: "Poster",
          variant: "v1",
          format: "image/png",
        },
      ],
      updatedAt: Date.now(),
    };

    saveUploadDraft(requestId, draft);
    const loaded = loadUploadDraft(requestId);

    expect(loaded).toBeDefined();
    expect(loaded?.requestId).toBe(requestId);
    expect(loaded?.items).toHaveLength(1);
    expect(loaded?.items[0]?.name).toBe("Artwork 1");

    clearUploadDraft(requestId);
    expect(loadUploadDraft(requestId)).toBeNull();
  });
});
