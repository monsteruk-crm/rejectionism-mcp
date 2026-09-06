import "server-only";
import { del, get, head, BlobAccessError, BlobNotFoundError } from "@vercel/blob";
import {
  BlobStorageProvider,
  StorageConfigurationError,
  StorageHeadResult,
  StorageUnavailableError,
} from "../campaign/storage";

/**
 * Vercel Blob adapter for the private upload store (upgrade plan section 5).
 *
 * - `BLOB_READ_WRITE_TOKEN` stays server-only and is passed explicitly on
 *   every command; a missing token fails closed at call time, never at import.
 * - Reads use the private access mode with the CDN cache disabled so
 *   verification never observes a stale cached object.
 * - `readPrefix` cancels the provider stream at its cap rather than buffering
 *   a whole archive.
 */

const BLOB_READ_WRITE_TOKEN_ERROR =
  "BLOB_READ_WRITE_TOKEN is not configured; blob storage operations fail closed.";

function requireToken(token: string | undefined): string {
  if (typeof token !== "string" || token.trim() === "") {
    throw new StorageConfigurationError(BLOB_READ_WRITE_TOKEN_ERROR);
  }
  return token;
}

function mapProviderError(error: unknown, pathname: string): never {
  if (error instanceof BlobAccessError) {
    throw new StorageConfigurationError(BLOB_READ_WRITE_TOKEN_ERROR);
  }
  if (error instanceof BlobNotFoundError) {
    throw new StorageUnavailableError(`Blob object not found: ${pathname}`);
  }
  throw new StorageUnavailableError(
    `Blob storage request failed while reading ${pathname}.`,
  );
}

async function collectPrefix(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
  mode: "prefix" | "small",
): Promise<Uint8Array> {
  const reader = stream.getReader();
  try {
    const chunks: Uint8Array[] = [];
    let received = 0;
    let truncated = false;

    while (received < maxBytes) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (received + value.byteLength > maxBytes) {
        // Keep only the capped prefix; for full reads this is an error path.
        chunks.push(value.subarray(0, maxBytes - received));
        received = maxBytes;
        truncated = true;
        break;
      }
      chunks.push(value);
      received += value.byteLength;
    }

    if (truncated && mode === "small") {
      throw new StorageUnavailableError(
        "Blob object exceeds the maximum allowed full-read size.",
      );
    }

    const out = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  } finally {
    // Cancel whatever remains; the provider stops transmitting at the cap.
    await reader.cancel().catch(() => undefined);
  }
}

export function createVercelBlobProvider(
  token: string | undefined = process.env.BLOB_READ_WRITE_TOKEN,
): BlobStorageProvider {
  return {
    async head(pathname: string): Promise<StorageHeadResult | null> {
      try {
        const result = await head(pathname, { token: requireToken(token) });
        return {
          size: result.size,
          contentType: result.contentType ?? null,
          url: result.url ?? null,
        };
      } catch (error) {
        if (error instanceof BlobNotFoundError) {
          return null;
        }
        mapProviderError(error, pathname);
      }
    },

    async readPrefix(pathname: string, maxBytes: number): Promise<Uint8Array> {
      try {
        const result = await get(pathname, {
          access: "private",
          useCache: false,
          token: requireToken(token),
        });
        if (result === null || result.statusCode !== 200 || result.stream === null) {
          throw new StorageUnavailableError(`Blob object unreadable: ${pathname}`);
        }
        return await collectPrefix(result.stream, maxBytes, "prefix");
      } catch (error) {
        if (error instanceof StorageUnavailableError) {
          throw error;
        }
        mapProviderError(error, pathname);
      }
    },

    async readSmallFile(pathname: string, maxBytes: number): Promise<Uint8Array> {
      try {
        const result = await get(pathname, {
          access: "private",
          useCache: false,
          token: requireToken(token),
        });
        if (result === null || result.statusCode !== 200 || result.stream === null) {
          throw new StorageUnavailableError(`Blob object unreadable: ${pathname}`);
        }
        return await collectPrefix(result.stream, maxBytes, "small");
      } catch (error) {
        if (error instanceof StorageUnavailableError) {
          throw error;
        }
        mapProviderError(error, pathname);
      }
    },

    async openStream(pathname: string): Promise<ReadableStream<Uint8Array>> {
      try {
        const result = await get(pathname, {
          access: "private",
          useCache: false,
          token: requireToken(token),
        });
        if (result === null || result.statusCode !== 200 || result.stream === null) {
          throw new StorageUnavailableError(`Blob object unreadable: ${pathname}`);
        }
        return result.stream;
      } catch (error) {
        mapProviderError(error, pathname);
      }
    },

    async delete(pathname: string): Promise<void> {
      try {
        await del(pathname, { token: requireToken(token) });
      } catch (error) {
        mapProviderError(error, pathname);
      }
    },
  };
}

let cachedProvider: BlobStorageProvider | null = null;

/**
 * Lazy process-wide provider. Domain services accept an explicit provider
 * parameter, so tests never touch this accessor.
 */
export function getStorageProvider(): BlobStorageProvider {
  cachedProvider ??= createVercelBlobProvider();
  return cachedProvider;
}

