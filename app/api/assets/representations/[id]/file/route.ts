import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { authenticateFileRequest } from "@/lib/auth/boundaries";
import { getPrisma } from "@/lib/prisma";
import { StorageUnavailableError } from "@/lib/campaign/storage";
import { getStorageProvider } from "@/lib/storage/vercel-blob";

/**
 * GET /api/assets/representations/[id]/file
 * Authenticated private file retrieval (upgrade plan section 5 and 8).
 *
 * - Protected by admin session cookie OR CampaignOS MCP Bearer token.
 * - Resolves representation ID through Prisma; EXTERNAL_URL returns 404.
 * - Streams private storage without buffering whole objects.
 * - Raster images default to inline preview with verified MIME; non-raster
 *   formats (SVG, PDF, ZIP) or `download=1` use attachment disposition
 *   with sandbox CSP.
 */

const RASTER_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

function formatContentDisposition(
  filename: string,
  isAttachment: boolean,
): string {
  const safeAscii = filename.replace(/[^\w.-]/g, "_") || "file";
  const encodedUtf8 = encodeURIComponent(filename);
  const type = isAttachment ? "attachment" : "inline";
  return `${type}; filename="${safeAscii}"; filename*=UTF-8''${encodedUtf8}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authenticateFileRequest(req);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Representation not found." } },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const prisma = getPrisma();
  const representation = await prisma.assetRepresentation.findUnique({
    where: { id },
    select: {
      id: true,
      storageType: true,
      blobPathname: true,
      mimeType: true,
      sourceFilename: true,
    },
  });

  if (
    !representation ||
    representation.storageType !== "BLOB" ||
    !representation.blobPathname
  ) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Blob file not found." } },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const provider = getStorageProvider();
  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await provider.openStream(representation.blobPathname);
  } catch (error) {
    if (error instanceof StorageUnavailableError) {
      return NextResponse.json(
        { ok: false, error: { code: "STORAGE_UNAVAILABLE", message: "Blob storage is currently unreachable." } },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Blob object not found in store." } },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const searchParams = req.nextUrl.searchParams;
  const isDownload = searchParams.get("download") === "1";
  const verifiedMime = representation.mimeType ?? "application/octet-stream";
  const isRaster = RASTER_MIME_TYPES.has(verifiedMime);
  const filename = representation.sourceFilename || `asset-${representation.id}`;

  const responseHeaders = new Headers();
  responseHeaders.set("Cache-Control", "private, no-store");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  responseHeaders.set("Referrer-Policy", "no-referrer");

  if (isRaster && !isDownload) {
    responseHeaders.set("Content-Type", verifiedMime);
    responseHeaders.set(
      "Content-Disposition",
      formatContentDisposition(filename, false),
    );
  } else {
    responseHeaders.set("Content-Type", "application/octet-stream");
    responseHeaders.set(
      "Content-Disposition",
      formatContentDisposition(filename, true),
    );
    // Sandboxing for non-raster attachments (SVG, PDF, ZIP)
    responseHeaders.set("Content-Security-Policy", "default-src 'none'; sandbox");
  }

  return new Response(stream, {
    status: 200,
    headers: responseHeaders,
  });
}
