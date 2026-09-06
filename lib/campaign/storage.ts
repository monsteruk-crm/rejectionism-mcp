import "server-only";

/**
 * Storage abstraction (upgrade plan section 5, "Vercel Blob and file
 * validation"; implementation in `lib/storage/vercel-blob.ts`).
 *
 * Every method accepts a **server-owned pathname** such as
 * `campaignos/uploads/<requestId>/<fileId>.<ext>` — never a browser URL, and
 * never a user-supplied path. Provider interactions are bounded: prefix reads
 * cancel the provider stream at the cap instead of buffering whole archives.
 *
 * Tests inject a fake provider; no actual provider call ever happens inside
 * the unit/integration suites.
 */

export interface StorageHeadResult {
  /** Exact object size in bytes. */
  size: number;
  /** Provider-recorded content type, when known. */
  contentType: string | null;
  /** Provider URL (signed, private store), when available. */
  url?: string | null;
}

export interface BlobStorageProvider {
  /** Metadata lookup; null when the object does not exist. */
  head(pathname: string): Promise<StorageHeadResult | null>;
  /**
   * Reads at most `maxBytes` from the object start. The provider stream is
   * cancelled once the cap is reached; nothing beyond the cap is buffered.
   */
  readPrefix(pathname: string, maxBytes: number): Promise<Uint8Array>;
  /**
   * Reads the complete object. Fails when the object is larger than
   * `maxBytes` (callers check `head` size first for full-file formats).
   */
  readSmallFile(pathname: string, maxBytes: number): Promise<Uint8Array>;
  /** Streaming read without buffering the whole object. */
  openStream(pathname: string): Promise<ReadableStream<Uint8Array>>;
  /** Deletes exactly the object at the given pathname. */
  delete(pathname: string): Promise<void>;
}

export class StorageUnavailableError extends Error {
  constructor(message = "Blob storage is currently unavailable.") {
    super(message);
    this.name = "StorageUnavailableError";
  }
}

export class StorageConfigurationError extends Error {
  constructor(message = "Blob storage is not configured.") {
    super(message);
    this.name = "StorageConfigurationError";
  }
}

/**
 * The provider-specific bridge for direct browser→provider transfers. The
 * Vercel adapter exposes the SDK's `handleUpload`; its exact transport shape
 * is consumed by the Phase 6 upload callback route, never by domain
 * services, and it never receives a raw capability in the tokenPayload.
 */
export type HandleUploadBridge = typeof import("@vercel/blob/client").handleUpload;
