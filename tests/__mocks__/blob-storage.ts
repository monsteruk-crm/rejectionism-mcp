import {
  StorageUnavailableError,
  type BlobStorageProvider,
  type StorageHeadResult,
} from "@/lib/campaign/storage";

/**
 * In-memory fake blob provider for unit/integration tests. No actual
 * provider call ever happens in the suites; services receive this fake
 * explicitly. Outage simulation throws the same retryable error type the
 * real adapter throws, so service-level mapping is exercised.
 */
export class MockBlobStorage implements BlobStorageProvider {
  private readonly objects = new Map<string, { bytes: Uint8Array; contentType: string | null }>();
  /** Pathnames successfully deleted through delete(). */
  deletedPathnames: string[] = [];
  /** When true, every operation throws a retryable unavailability error. */
  failNextOperations = false;

  private failIfSimulated(): void {
    if (this.failNextOperations) {
      throw new StorageUnavailableError("Simulated provider outage");
    }
  }

  /** Seeds an object as if a browser had uploaded it. */
  put(pathname: string, bytes: Uint8Array, contentType: string | null = null): void {
    this.objects.set(pathname, { bytes, contentType });
  }

  clear(): void {
    this.objects.clear();
    this.deletedPathnames = [];
    this.failNextOperations = false;
  }

  has(pathname: string): boolean {
    return this.objects.has(pathname);
  }

  async head(pathname: string): Promise<StorageHeadResult | null> {
    this.failIfSimulated();
    const object = this.objects.get(pathname);
    if (!object) {
      return null;
    }
    return {
      size: object.bytes.byteLength,
      contentType: object.contentType,
      url: `mock://${pathname}`,
    };
  }

  async readPrefix(pathname: string, maxBytes: number): Promise<Uint8Array> {
    this.failIfSimulated();
    const object = this.objects.get(pathname);
    if (!object) {
      throw new StorageUnavailableError(`Mock object not found: ${pathname}`);
    }
    return object.bytes.subarray(0, Math.min(maxBytes, object.bytes.byteLength));
  }

  async readSmallFile(pathname: string, maxBytes: number): Promise<Uint8Array> {
    this.failIfSimulated();
    const object = this.objects.get(pathname);
    if (!object) {
      throw new StorageUnavailableError(`Mock object not found: ${pathname}`);
    }
    if (object.bytes.byteLength > maxBytes) {
      throw new StorageUnavailableError("Mock object exceeds the maximum allowed full-read size.");
    }
    return object.bytes;
  }

  async openStream(pathname: string): Promise<ReadableStream<Uint8Array>> {
    this.failIfSimulated();
    const object = this.objects.get(pathname);
    if (!object) {
      throw new StorageUnavailableError(`Mock object not found: ${pathname}`);
    }
    const bytes = object.bytes;
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
  }

  async delete(pathname: string): Promise<void> {
    this.failIfSimulated();
    this.deletedPathnames.push(pathname);
    this.objects.delete(pathname);
  }
}
