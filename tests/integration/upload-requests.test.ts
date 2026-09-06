import { afterAll, describe, expect, test } from "vitest";
import {
  authorizeUploadFileTransfer,
  createAsset,
  createUploadRequest,
  finalizeUploadRequest,
  getUploadRequest,
  listUploadRequests,
  regenerateUploadRequest,
  reserveUploadFile,
  revokeUploadRequest,
  runUploadCleanup,
  selectDiscardableUploadFiles,
  updateAsset,
  verifyUploadFile,
} from "@/lib/campaign";
import { getPrisma } from "@/lib/prisma";
import { MockBlobStorage } from "../__mocks__/blob-storage";

const runId = `int-uploads-${Date.now()}`;
const requestIds: string[] = [];
const knownAssetIds: string[] = [];

function expectOk<T>(result: { ok: true; data: T } | { ok: false; error: unknown }): T {
  if (!result.ok) {
    throw new Error(`Expected ok but got error: ${JSON.stringify(result.error)}`);
  }
  expect(result.ok).toBe(true);
  return result.data;
}

function expectFail(
  result: { ok: true; data: unknown } | { ok: false; error: { code: string } },
  code: string,
): void {
  if (result.ok) {
    throw new Error(`Expected failure with code ${code} but got success: ${JSON.stringify(result.data)}`);
  }
  expect(result.ok).toBe(false);
  expect(result.error.code).toBe(code);
}

function rawTokenFrom(uploadUrl: string): string {
  const token = uploadUrl.split("/upload/")[1];
  expect(token).toHaveLength(43);
  return token;
}

function pngBytes(size: number, width = 2, height = 3): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  bytes[24] = 0x08;
  bytes[25] = 0x06;
  return bytes;
}

function jpegBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00], 0);
  return bytes;
}

function svgBytes(): Uint8Array {
  return new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
}

function svgWithDoctype(): Uint8Array {
  return new TextEncoder().encode(
    '<!DOCTYPE svg [<!ENTITY xxe "x">]><svg xmlns="http://www.w3.org/2000/svg"></svg>',
  );
}

function htmlBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set(new TextEncoder().encode("<html><body>script</body></html>"), 0);
  return bytes;
}

async function createOpenRequest(options: {
  maxItems?: number;
  targetAssetId?: string;
  targetRevisionId?: string;
}): Promise<{ id: string; rawToken: string }> {
  const created = expectOk(
    await createUploadRequest({
      title: `${runId} link ${requestIds.length + 1}`,
      maxItems: options.maxItems,
      targetAssetId: options.targetAssetId,
      targetRevisionId: options.targetRevisionId,
    }),
  );
  requestIds.push(created.id);
  return { id: created.id, rawToken: rawTokenFrom(created.uploadUrl) };
}

/**
 * Makes a request effectively expired. The authored SQL constraint
 * `UploadRequest_expires_after_created_chk` requires `expiresAt > createdAt`,
 * so both columns move together.
 */
async function expireRequest(id: string): Promise<void> {
  const now = Date.now();
  await getPrisma().uploadRequest.update({
    where: { id },
    data: {
      createdAt: new Date(now - 26 * 60 * 60 * 1000),
      expiresAt: new Date(now - 25 * 60 * 60 * 1000),
    },
  });
}

/** Reserves, seeds the mock provider, and verifies one PNG file. */
async function reserveAndVerifyPng(
  request: { id: string; rawToken: string },
  provider: MockBlobStorage,
  clientItemId: string,
  size = 33,
): Promise<{ fileId: string; clientItemId: string }> {
  const reserved = expectOk(
    await reserveUploadFile(request.rawToken, {
      clientItemId,
      sourceFilename: "artwork.png",
      declaredMimeType: "image/png",
      expectedByteSize: size,
    }),
  );
  provider.put(reserved.blobPathname, pngBytes(size));
  const verified = expectOk(
    await verifyUploadFile(request.rawToken, { fileId: reserved.fileId }, { provider }),
  );
  expect(verified.status).toBe("VERIFIED");
  return { fileId: reserved.fileId, clientItemId };
}

afterAll(async () => {
  const prisma = getPrisma();
  // Untargeted finalization creates Assets with the run marker in notes;
  // targeted tests use runId-prefixed explicit IDs.
  const untargeted = await prisma.asset.findMany({ where: { notes: runId }, select: { id: true } });
  const assetIds = [...knownAssetIds, ...untargeted.map((asset) => asset.id)];
  const revisions = await prisma.assetRevision.findMany({
    where: { assetId: { in: assetIds } },
    select: { id: true },
  });
  const revisionIds = revisions.map((revision) => revision.id);

  await prisma.activity.deleteMany({
    where: { entityId: { in: [...assetIds, ...requestIds] } },
  });
  await prisma.assetRepresentation.deleteMany({
    where: {
      OR: [{ assetRevisionId: { in: revisionIds } }, { uploadRequestId: { in: requestIds } }],
    },
  });
  await prisma.uploadFile.deleteMany({ where: { uploadRequestId: { in: requestIds } } });
  await prisma.uploadRequest.deleteMany({ where: { id: { in: requestIds } } });
  await prisma.assetRevision.deleteMany({ where: { assetId: { in: assetIds } } });
  await prisma.asset.deleteMany({ where: { id: { in: assetIds } } });
  await prisma.$disconnect();
});

describe("Upload request lifecycle", () => {
  test("creates with hashed tokens, reads, and lists without exposing the raw token", async () => {
    const created = expectOk(
      await createUploadRequest({
        title: `${runId} lifecycle`,
        instructions: "Send the artwork",
        maxItems: 5,
        expiresInDays: 3,
      }),
    );
    requestIds.push(created.id);
    const rawToken = rawTokenFrom(created.uploadUrl);

    const row = await getPrisma().uploadRequest.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(rawToken);
    expect(row.status).toBe("OPEN");
    expect(row.maxItems).toBe(5);

    const activity = await getPrisma().activity.findFirst({
      where: { entityId: created.id, action: "UPLOAD_LINK_CREATED" },
    });
    expect(activity).not.toBeNull();
    expect(JSON.stringify(activity?.metadata)).not.toContain(rawToken);
    expect(JSON.stringify(activity?.metadata)).not.toContain(row.tokenHash);

    const got = expectOk(await getUploadRequest({ id: created.id }));
    expect(got.request.effectiveStatus).toBe("OPEN");
    expect(JSON.stringify(got)).not.toContain(rawToken);

    const list = expectOk(await listUploadRequests({ status: "OPEN" }));
    expect(list.items.some((item) => item.id === created.id)).toBe(true);
  });

  test("rejects out-of-bounds expiry and item counts", async () => {
    expectFail(
      await createUploadRequest({ title: "bounds", expiresInDays: 0 }),
      "VALIDATION_ERROR",
    );
    expectFail(
      await createUploadRequest({ title: "bounds", expiresInDays: 31 }),
      "VALIDATION_ERROR",
    );
    expectFail(await createUploadRequest({ title: "bounds", maxItems: 0 }), "VALIDATION_ERROR");
    expectFail(await createUploadRequest({ title: "bounds", maxItems: 51 }), "VALIDATION_ERROR");
  });

  test("resolves targets in the creation transaction and rejects mismatches", async () => {
    const asset = expectOk(
      await createAsset({
        id: `${runId}-target`,
        name: runId,
        kind: "test",
        url: "https://example.com/target.png",
      }),
    );
    knownAssetIds.push(asset.id);
    expect(asset.version).toBe(1);

    const byAsset = await createOpenRequest({ targetAssetId: asset.id });
    const byAssetRow = await getPrisma().uploadRequest.findUniqueOrThrow({
      where: { id: byAsset.id },
    });
    expect(byAssetRow.targetAssetId).toBe(asset.id);
    expect(byAssetRow.targetAssetVersion).toBe(1);
    expect(byAssetRow.targetRevisionId).toBeNull();

    const revision = await getPrisma().assetRevision.findFirstOrThrow({
      where: { assetId: asset.id },
    });
    const byRevision = await createOpenRequest({ targetRevisionId: revision.id });
    const byRevisionRow = await getPrisma().uploadRequest.findUniqueOrThrow({
      where: { id: byRevision.id },
    });
    // A revision target persists its parent Asset ID too.
    expect(byRevisionRow.targetAssetId).toBe(asset.id);
    expect(byRevisionRow.targetRevisionId).toBe(revision.id);
    expect(byRevisionRow.targetAssetVersion).toBe(1);

    const otherAsset = expectOk(
      await createAsset({ id: `${runId}-other`, name: runId, kind: "test" }),
    );
    knownAssetIds.push(otherAsset.id);
    expectFail(
      await createUploadRequest({ title: "mismatch", targetAssetId: otherAsset.id, targetRevisionId: revision.id }),
      "VALIDATION_ERROR",
    );
    expectFail(await createUploadRequest({ title: "missing", targetAssetId: "missing-target" }), "NOT_FOUND");
    expectFail(
      await createUploadRequest({ title: "missing-rev", targetRevisionId: "missing-revision" }),
      "NOT_FOUND",
    );
  });

  test("rejects targeted requests for SUPERSEDED assets", async () => {
    const asset = expectOk(
      await createAsset({ id: `${runId}-superseded`, name: runId, kind: "test" }),
    );
    knownAssetIds.push(asset.id);
    expectOk(
      await updateAsset({ id: asset.id, expectedVersion: 1, changes: { status: "SUPERSEDED" } }),
    );
    expectFail(await createUploadRequest({ targetAssetId: asset.id }), "VALIDATION_ERROR");
  });

  test("revokes idempotently and regenerates only OPEN requests once", async () => {
    const revoked = await createOpenRequest({});
    const revokedBefore = await getPrisma().activity.count({ where: { entityId: revoked.id } });
    expectOk(await revokeUploadRequest({ id: revoked.id }));
    // Idempotent repeat: no state change and no new Activity.
    expectOk(await revokeUploadRequest({ id: revoked.id }));
    expect(
      await getPrisma().activity.count({ where: { entityId: revoked.id } }),
    ).toBe(revokedBefore + 1);
    expectFail(await revokeUploadRequest({ id: "missing-request" }), "NOT_FOUND");

    const original = await createOpenRequest({ targetAssetId: `${runId}-target` });
    const regenerated = expectOk(await regenerateUploadRequest({ id: original.id }));
    requestIds.push(regenerated.id);
    expect(regenerated.id).not.toBe(original.id);
    expect(regenerated.uploadUrl).not.toContain(original.rawToken);

    const oldRow = await getPrisma().uploadRequest.findUniqueOrThrow({
      where: { id: original.id },
    });
    expect(oldRow.status).toBe("REVOKED");
    const newRow = await getPrisma().uploadRequest.findUniqueOrThrow({
      where: { id: regenerated.id },
    });
    expect(newRow.replacesId).toBe(original.id);
    expect(newRow.status).toBe("OPEN");
    expect(newRow.targetAssetVersion).toBe(1);

    expectFail(await regenerateUploadRequest({ id: original.id }), "ALREADY_EXISTS");
    expectFail(await regenerateUploadRequest({ id: revoked.id }), "UPLOAD_REVOKED");
  });
});

describe("File reservation and bounded authorization", () => {
  test("returns the same file for identical reservations and rejects metadata changes", async () => {
    const request = await createOpenRequest({ maxItems: 2 });
    const clientItemId = crypto.randomUUID();

    const first = expectOk(
      await reserveUploadFile(request.rawToken, {
        clientItemId,
        sourceFilename: "assets/logo.png",
        declaredMimeType: "image/png",
        expectedByteSize: 33,
      }),
    );
    expect(first.blobPathname).toBe(`campaignos/uploads/${request.id}/${first.fileId}.png`);

    // Filename directories are stripped for comparison.
    const repeat = expectOk(
      await reserveUploadFile(request.rawToken, {
        clientItemId,
        sourceFilename: "logo.png",
        declaredMimeType: "image/png",
        expectedByteSize: 33,
      }),
    );
    expect(repeat.fileId).toBe(first.fileId);
    expect(repeat.blobPathname).toBe(first.blobPathname);

    expectFail(
      await reserveUploadFile(request.rawToken, {
        clientItemId,
        sourceFilename: "logo.png",
        declaredMimeType: "image/png",
        expectedByteSize: 34,
      }),
      "VALIDATION_ERROR",
    );
    expectFail(
      await reserveUploadFile(request.rawToken, {
        clientItemId,
        sourceFilename: "logo.png",
        declaredMimeType: "image/gif",
        expectedByteSize: 33,
      }),
      "VALIDATION_ERROR",
    );
    // Disallowed formats and wildcard declarations never reserve.
    expectFail(
      await reserveUploadFile(request.rawToken, {
        clientItemId: crypto.randomUUID(),
        sourceFilename: "page.html",
        declaredMimeType: "text/html",
        expectedByteSize: 10,
      }),
      "VALIDATION_ERROR",
    );
  });

  test("enforces lifetime slot and byte budgets across retries", async () => {
    // maxItems 1 → 3 lifetime slots.
    const slotRequest = await createOpenRequest({ maxItems: 1 });
    for (let index = 0; index < 3; index += 1) {
      expectOk(
        await reserveUploadFile(slotRequest.rawToken, {
          clientItemId: crypto.randomUUID(),
          sourceFilename: `slot-${index}.png`,
          declaredMimeType: "image/png",
          expectedByteSize: 33,
        }),
      );
    }
    expectFail(
      await reserveUploadFile(slotRequest.rawToken, {
        clientItemId: crypto.randomUUID(),
        sourceFilename: "slot-overflow.png",
        declaredMimeType: "image/png",
        expectedByteSize: 33,
      }),
      "UPLOAD_LIMIT_EXCEEDED",
    );

    // 10 maximum-size reservations fit the byte budget; the 11th exceeds it.
    const byteRequest = await createOpenRequest({ maxItems: 20 });
    for (let index = 0; index < 10; index += 1) {
      expectOk(
        await reserveUploadFile(byteRequest.rawToken, {
          clientItemId: crypto.randomUUID(),
          sourceFilename: `archive-${index}.zip`,
          declaredMimeType: "application/zip",
          expectedByteSize: 104_857_600,
        }),
      );
    }
    expectFail(
      await reserveUploadFile(byteRequest.rawToken, {
        clientItemId: crypto.randomUUID(),
        sourceFilename: "archive-overflow.zip",
        declaredMimeType: "application/zip",
        expectedByteSize: 104_857_600,
      }),
      "UPLOAD_LIMIT_EXCEEDED",
    );
  });

  test("rejects reservations for terminal or expired requests", async () => {
    const revoked = await createOpenRequest({});
    expectOk(await revokeUploadRequest({ id: revoked.id }));
    expectFail(
      await reserveUploadFile(revoked.rawToken, {
        clientItemId: crypto.randomUUID(),
        sourceFilename: "late.png",
        declaredMimeType: "image/png",
        expectedByteSize: 33,
      }),
      "UPLOAD_REVOKED",
    );

    const expired = await createOpenRequest({});
    await expireRequest(expired.id);
    expectFail(
      await reserveUploadFile(expired.rawToken, {
        clientItemId: crypto.randomUUID(),
        sourceFilename: "late.png",
        declaredMimeType: "image/png",
        expectedByteSize: 33,
      }),
      "UPLOAD_EXPIRED",
    );

    // Malformed tokens fail closed before any lookup.
    expectFail(
      await reserveUploadFile("short-token", {
        clientItemId: crypto.randomUUID(),
        sourceFilename: "x.png",
        declaredMimeType: "image/png",
        expectedByteSize: 33,
      }),
      "VALIDATION_ERROR",
    );
  });

  test("bounds each slot to three authorizations and rejects foreign files", async () => {
    const request = await createOpenRequest({ maxItems: 2 });
    const reserved = expectOk(
      await reserveUploadFile(request.rawToken, {
        clientItemId: crypto.randomUUID(),
        sourceFilename: "auth.png",
        declaredMimeType: "image/png",
        expectedByteSize: 33,
      }),
    );

    const first = expectOk(
      await authorizeUploadFileTransfer(request.rawToken, { fileId: reserved.fileId }),
    );
    expect(first.authorizationCount).toBe(1);
    expect(first.allowedContentTypes).toEqual(["image/png"]);
    expect(first.maximumSizeInBytes).toBe(33);
    expect(first.addRandomSuffix).toBe(false);
    expect(first.allowOverwrite).toBe(false);
    expect(first.callbackUrl).toContain("/api/uploads/blob");
    expect(JSON.stringify(first)).not.toContain(request.rawToken);

    expectOk(await authorizeUploadFileTransfer(request.rawToken, { fileId: reserved.fileId }));
    expectOk(await authorizeUploadFileTransfer(request.rawToken, { fileId: reserved.fileId }));
    expectFail(
      await authorizeUploadFileTransfer(request.rawToken, { fileId: reserved.fileId }),
      "UPLOAD_LIMIT_EXCEEDED",
    );

    // A file reserved under a different request is never disclosed.
    const otherRequest = await createOpenRequest({ maxItems: 2 });
    const foreign = expectOk(
      await reserveUploadFile(otherRequest.rawToken, {
        clientItemId: crypto.randomUUID(),
        sourceFilename: "foreign.png",
        declaredMimeType: "image/png",
        expectedByteSize: 33,
      }),
    );
    expectFail(
      await authorizeUploadFileTransfer(request.rawToken, { fileId: foreign.fileId }),
      "NOT_FOUND",
    );
  });
});

describe("Per-file inspection with the mock provider", () => {
  test("missing blobs stay PENDING and valid PNGs verify once", async () => {
    const provider = new MockBlobStorage();
    const request = await createOpenRequest({ maxItems: 2 });
    const reserved = expectOk(
      await reserveUploadFile(request.rawToken, {
        clientItemId: crypto.randomUUID(),
        sourceFilename: "inspect.png",
        declaredMimeType: "image/png",
        expectedByteSize: 33,
      }),
    );

    const pending = expectOk(
      await verifyUploadFile(request.rawToken, { fileId: reserved.fileId }, { provider }),
    );
    expect(pending.status).toBe("PENDING");
    expect(pending.mutated).toBe(false);
    expect(pending.retryable).toBe(true);

    provider.put(reserved.blobPathname, pngBytes(33));
    const verified = expectOk(
      await verifyUploadFile(request.rawToken, { fileId: reserved.fileId }, { provider }),
    );
    expect(verified.status).toBe("VERIFIED");
    expect(verified.mutated).toBe(true);
    expect(verified.mimeType).toBe("image/png");
    expect(verified.byteSize).toBe(33);
    expect(verified.width).toBe(2);
    expect(verified.height).toBe(3);

    // VERIFIED repeat is unchanged.
    const repeat = expectOk(
      await verifyUploadFile(request.rawToken, { fileId: reserved.fileId }, { provider }),
    );
    expect(repeat.status).toBe("VERIFIED");
    expect(repeat.mutated).toBe(false);

    const row = await getPrisma().uploadFile.findUniqueOrThrow({
      where: { id: reserved.fileId },
    });
    expect(row.status).toBe("VERIFIED");
    expect(row.verifiedAt).not.toBeNull();
  });

  test("deterministic failures persist fixed failure codes and never flip to VERIFIED", async () => {
    const provider = new MockBlobStorage();

    const sizeRequest = await createOpenRequest({ maxItems: 3 });
    const sizeFile = expectOk(
      await reserveUploadFile(sizeRequest.rawToken, {
        clientItemId: crypto.randomUUID(),
        sourceFilename: "size.png",
        declaredMimeType: "image/png",
        expectedByteSize: 40,
      }),
    );
    provider.put(sizeFile.blobPathname, pngBytes(33));
    const sizeResult = expectOk(
      await verifyUploadFile(sizeRequest.rawToken, { fileId: sizeFile.fileId }, { provider }),
    );
    expect(sizeResult).toMatchObject({ status: "REJECTED", failureCode: "SIZE_MISMATCH" });

    const mimeRequest = await createOpenRequest({ maxItems: 3 });
    const mimeFile = expectOk(
      await reserveUploadFile(mimeRequest.rawToken, {
        clientItemId: crypto.randomUUID(),
        sourceFilename: "mime.png",
        declaredMimeType: "image/png",
        expectedByteSize: 20,
      }),
    );
    provider.put(mimeFile.blobPathname, jpegBytes(20));
    const mimeResult = expectOk(
      await verifyUploadFile(mimeRequest.rawToken, { fileId: mimeFile.fileId }, { provider }),
    );
    expect(mimeResult).toMatchObject({ status: "REJECTED", failureCode: "MIME_MISMATCH" });

    const formatRequest = await createOpenRequest({ maxItems: 3 });
    const formatFile = expectOk(
      await reserveUploadFile(formatRequest.rawToken, {
        clientItemId: crypto.randomUUID(),
        sourceFilename: "format.png",
        declaredMimeType: "image/png",
        expectedByteSize: 40,
      }),
    );
    provider.put(formatFile.blobPathname, htmlBytes(40));
    const formatResult = expectOk(
      await verifyUploadFile(formatRequest.rawToken, { fileId: formatFile.fileId }, { provider }),
    );
    expect(formatResult).toMatchObject({ status: "REJECTED", failureCode: "FORMAT_NOT_ALLOWED" });

    const dimsRequest = await createOpenRequest({ maxItems: 3 });
    const dimsFile = expectOk(
      await reserveUploadFile(dimsRequest.rawToken, {
        clientItemId: crypto.randomUUID(),
        sourceFilename: "dims.png",
        declaredMimeType: "image/png",
        expectedByteSize: 33,
      }),
    );
    provider.put(dimsFile.blobPathname, pngBytes(33, 40_000, 40_000));
    const dimsResult = expectOk(
      await verifyUploadFile(dimsRequest.rawToken, { fileId: dimsFile.fileId }, { provider }),
    );
    expect(dimsResult).toMatchObject({ status: "REJECTED", failureCode: "DIMENSIONS_EXCEEDED" });

    // REJECTED never becomes VERIFIED even with correct bytes later.
    provider.put(sizeFile.blobPathname, pngBytes(40));
    const rechecked = expectOk(
      await verifyUploadFile(sizeRequest.rawToken, { fileId: sizeFile.fileId }, { provider }),
    );
    expect(rechecked.status).toBe("REJECTED");
    expect(rechecked.mutated).toBe(false);
  });

  test("valid SVGs verify without dimensions; DOCTYPE documents are rejected", async () => {
    const provider = new MockBlobStorage();
    const request = await createOpenRequest({ maxItems: 3 });

    const svgFile = expectOk(
      await reserveUploadFile(request.rawToken, {
        clientItemId: crypto.randomUUID(),
        sourceFilename: "logo.svg",
        declaredMimeType: "image/svg+xml",
        expectedByteSize: svgBytes().byteLength,
      }),
    );
    provider.put(svgFile.blobPathname, svgBytes());
    const svgResult = expectOk(
      await verifyUploadFile(request.rawToken, { fileId: svgFile.fileId }, { provider }),
    );
    expect(svgResult.status).toBe("VERIFIED");
    expect(svgResult.width).toBeNull();
    expect(svgResult.height).toBeNull();

    const doctypeFile = expectOk(
      await reserveUploadFile(request.rawToken, {
        clientItemId: crypto.randomUUID(),
        sourceFilename: "evil.svg",
        declaredMimeType: "image/svg+xml",
        expectedByteSize: svgWithDoctype().byteLength,
      }),
    );
    provider.put(doctypeFile.blobPathname, svgWithDoctype());
    const doctypeResult = expectOk(
      await verifyUploadFile(request.rawToken, { fileId: doctypeFile.fileId }, { provider }),
    );
    expect(doctypeResult).toMatchObject({ status: "REJECTED", failureCode: "SVG_MALFORMED" });
  });

  test("transient provider failures keep PENDING and return retryable unavailability", async () => {
    const provider = new MockBlobStorage();
    const request = await createOpenRequest({ maxItems: 2 });
    const reserved = expectOk(
      await reserveUploadFile(request.rawToken, {
        clientItemId: crypto.randomUUID(),
        sourceFilename: "outage.png",
        declaredMimeType: "image/png",
        expectedByteSize: 33,
      }),
    );
    provider.put(reserved.blobPathname, pngBytes(33));
    provider.failNextOperations = true;
    expectFail(
      await verifyUploadFile(request.rawToken, { fileId: reserved.fileId }, { provider }),
      "STORAGE_UNAVAILABLE",
    );
    provider.failNextOperations = false;

    const row = await getPrisma().uploadFile.findUniqueOrThrow({
      where: { id: reserved.fileId },
    });
    expect(row.status).toBe("PENDING");

    // Recovers on retry.
    const recovered = expectOk(
      await verifyUploadFile(request.rawToken, { fileId: reserved.fileId }, { provider }),
    );
    expect(recovered.status).toBe("VERIFIED");
  });

  test("late verification after terminal request state performs no mutation", async () => {
    const provider = new MockBlobStorage();
    const request = await createOpenRequest({ maxItems: 2 });
    const reserved = expectOk(
      await reserveUploadFile(request.rawToken, {
        clientItemId: crypto.randomUUID(),
        sourceFilename: "late-verify.png",
        declaredMimeType: "image/png",
        expectedByteSize: 33,
      }),
    );
    provider.put(reserved.blobPathname, pngBytes(33));

    expectOk(await revokeUploadRequest({ id: request.id }));
    const late = expectOk(
      await verifyUploadFile(request.rawToken, { fileId: reserved.fileId }, { provider }),
    );
    expect(late.status).toBe("PENDING");
    expect(late.mutated).toBe(false);

    const row = await getPrisma().uploadFile.findUniqueOrThrow({
      where: { id: reserved.fileId },
    });
    expect(row.status).toBe("PENDING");
  });
});

describe("Atomic finalization", () => {
  test("untargeted submission creates one DRAFT asset per item and replays identically", async () => {
    const provider = new MockBlobStorage();
    const request = await createOpenRequest({ maxItems: 5 });

    const fileA = await reserveAndVerifyPng(request, provider, crypto.randomUUID());
    const fileB = await reserveAndVerifyPng(request, provider, crypto.randomUUID(), 40);

    const input = {
      submissionKey: crypto.randomUUID(),
      items: [
        {
          clientItemId: fileA.clientItemId,
          type: "FILE" as const,
          fileId: fileA.fileId,
          name: `${runId} Logo`,
          kind: "artwork",
          notes: runId,
          label: "Primary",
          variant: null,
          format: null,
        },
        {
          clientItemId: fileB.clientItemId,
          type: "FILE" as const,
          fileId: fileB.fileId,
          name: `${runId} Alt`,
          kind: "artwork",
          notes: runId,
        },
        {
          clientItemId: crypto.randomUUID(),
          type: "EXTERNAL_URL" as const,
          externalUrl: "https://example.com/external.png",
          name: `${runId} Ext`,
          kind: "artwork",
          notes: runId,
        },
      ],
    };

    const finalized = expectOk(await finalizeUploadRequest(request.rawToken, input));
    expect(finalized.receipt.submissionKey).toBe(input.submissionKey);
    expect(finalized.receipt.itemCount).toBe(3);
    // Public receipt: no entity IDs, filenames, or download URLs.
    expect(JSON.stringify(finalized.receipt)).not.toContain("assetId");
    expect(JSON.stringify(finalized.receipt)).not.toContain("Logo");

    const prisma = getPrisma();
    const assets = await prisma.asset.findMany({ where: { notes: runId } });
    expect(assets).toHaveLength(3);
    for (const asset of assets) {
      expect(asset.status).toBe("DRAFT");
      expect(asset.version).toBe(1);
      const revision = await prisma.assetRevision.findFirstOrThrow({
        where: { assetId: asset.id },
      });
      expect(revision.revisionNumber).toBe(1);
      const representations = await prisma.assetRepresentation.findMany({
        where: { assetRevisionId: revision.id },
      });
      expect(representations).toHaveLength(1);
      expect(representations[0]?.isPrimary).toBe(true);
    }

    const blobReps = await prisma.assetRepresentation.findMany({
      where: { storageType: "BLOB", uploadRequestId: request.id },
    });
    expect(blobReps).toHaveLength(2);
    for (const rep of blobReps) {
      expect(rep.mimeType).toBe("image/png");
      expect(rep.byteSize).not.toBeNull();
      expect(rep.format).toBe("png");
      expect(rep.blobPathname).not.toBeNull();
      expect(rep.uploadFileId).not.toBeNull();
    }
    const externalReps = await prisma.assetRepresentation.findMany({
      where: { storageType: "EXTERNAL_URL", uploadRequestId: request.id },
    });
    expect(externalReps).toHaveLength(1);
    expect(externalReps[0]?.externalUrl).toBe("https://example.com/external.png");

    const files = await prisma.uploadFile.findMany({
      where: { uploadRequestId: request.id },
    });
    expect(files.every((file) => file.status === "ATTACHED")).toBe(true);

    const requestRow = await prisma.uploadRequest.findUniqueOrThrow({
      where: { id: request.id },
    });
    expect(requestRow.status).toBe("SUBMITTED");
    expect(requestRow.submissionKey).toBe(input.submissionKey);

    const activityAfter = await prisma.activity.count({
      where: { entityType: "UPLOAD_REQUEST", entityId: request.id },
    });
    expect(activityAfter).toBe(2); // UPLOAD_LINK_CREATED + UPLOAD_SUBMITTED

    // Identical replay returns the stored receipt without another mutation.
    const replayed = expectOk(await finalizeUploadRequest(request.rawToken, input));
    expect(replayed.receipt).toEqual(finalized.receipt);
    expect(
      await prisma.activity.count({
        where: { entityType: "UPLOAD_REQUEST", entityId: request.id },
      }),
    ).toBe(activityAfter);
    expect(await prisma.asset.count({ where: { notes: runId } })).toBe(3);

    // A different key is never a second submission.
    expectFail(
      await finalizeUploadRequest(request.rawToken, {
        ...input,
        submissionKey: crypto.randomUUID(),
      }),
      "UPLOAD_ALREADY_SUBMITTED",
    );
  });

  test("targeted submission appends one revision once and conflicts on stale versions", async () => {
    const provider = new MockBlobStorage();
    const asset = expectOk(
      await createAsset({ id: `${runId}-targeted`, name: runId, kind: "test" }),
    );
    knownAssetIds.push(asset.id);

    const request = await createOpenRequest({ targetAssetId: asset.id });
    const file = await reserveAndVerifyPng(request, provider, crypto.randomUUID());

    // An intervening mutation invalidates the captured target version.
    expectOk(
      await updateAsset({ id: asset.id, expectedVersion: 1, changes: { notes: "edited" } }),
    );
    expectFail(
      await finalizeUploadRequest(request.rawToken, {
        submissionKey: crypto.randomUUID(),
        items: [
          {
            clientItemId: file.clientItemId,
            type: "FILE" as const,
            fileId: file.fileId,
            name: "Conflicted",
            kind: "artwork",
            notes: runId,
          },
        ],
      }),
      "VERSION_CONFLICT",
    );

    // Failure state: the request stays OPEN, the file stays VERIFIED, and no
    // Blob is deleted.
    const prisma = getPrisma();
    const requestAfterFailure = await prisma.uploadRequest.findUniqueOrThrow({
      where: { id: request.id },
    });
    expect(requestAfterFailure.status).toBe("OPEN");
    const fileAfterFailure = await prisma.uploadFile.findUniqueOrThrow({
      where: { id: file.fileId },
    });
    expect(fileAfterFailure.status).toBe("VERIFIED");
    expect(provider.deletedPathnames).toHaveLength(0);

    // Regeneration refreshes the captured target version.
    const regenerated = expectOk(await regenerateUploadRequest({ id: request.id }));
    requestIds.push(regenerated.id);
    const regeneratedToken = rawTokenFrom(regenerated.uploadUrl);
    const newFile = await reserveAndVerifyPng({ id: regenerated.id, rawToken: regeneratedToken }, provider, crypto.randomUUID());

    expectFail(
      await finalizeUploadRequest(regeneratedToken, {
        submissionKey: crypto.randomUUID(),
        items: [
          {
            clientItemId: newFile.clientItemId,
            type: "FILE" as const,
            fileId: "not-a-real-file",
            name: "Foreign",
            kind: "artwork",
          },
        ],
      }),
      "NOT_FOUND",
    );

    const finalized = expectOk(
      await finalizeUploadRequest(regeneratedToken, {
        submissionKey: crypto.randomUUID(),
        items: [
          {
            clientItemId: newFile.clientItemId,
            type: "FILE" as const,
            fileId: newFile.fileId,
            name: "Uploaded",
            kind: "artwork",
            notes: runId,
          },
        ],
      }),
    );
    expect(finalized.receipt.itemCount).toBe(1);

    const assetAfter = await prisma.asset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(assetAfter.version).toBe(3); // 1 → notes edit → submission
    expect(assetAfter.status).toBe("DRAFT");

    const revisions = await prisma.assetRevision.findMany({
      where: { assetId: asset.id },
      orderBy: { revisionNumber: "asc" },
    });
    expect(revisions).toHaveLength(2);
    expect(revisions[1]?.revisionNumber).toBe(2);

    const reps = await prisma.assetRepresentation.findMany({
      where: { assetRevisionId: revisions[1]?.id },
    });
    expect(reps).toHaveLength(1);
    expect(reps[0]?.isPrimary).toBe(true);

    const attachedFile = await prisma.uploadFile.findUniqueOrThrow({
      where: { id: newFile.fileId },
    });
    expect(attachedFile.status).toBe("ATTACHED");
    // The original file from the conflicted attempt remains staged (VERIFIED)
    // and was not attached to the new revision.
    const unboundOldFile = await prisma.uploadFile.findUniqueOrThrow({
      where: { id: file.fileId },
    });
    expect(unboundOldFile.status).toBe("VERIFIED");
  });

  test("APPROVED assets become NEEDS_WORK on submission", async () => {
    const provider = new MockBlobStorage();
    const asset = expectOk(
      await createAsset({
        id: `${runId}-approved`,
        name: runId,
        kind: "test",
        url: "https://example.com/approved.png",
      }),
    );
    knownAssetIds.push(asset.id);
    expectOk(
      await updateAsset({ id: asset.id, expectedVersion: 1, changes: { status: "APPROVED" } }),
    );

    const request = await createOpenRequest({ targetAssetId: asset.id });
    const file = await reserveAndVerifyPng(request, provider, crypto.randomUUID());
    expectOk(
      await finalizeUploadRequest(request.rawToken, {
        submissionKey: crypto.randomUUID(),
        items: [
          {
            clientItemId: file.clientItemId,
            type: "FILE" as const,
            fileId: file.fileId,
            name: "Revision",
            kind: "artwork",
            notes: runId,
          },
        ],
      }),
    );

    const assetAfter = await getPrisma().asset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(assetAfter.status).toBe("NEEDS_WORK");
    expect(assetAfter.version).toBe(3);
  });

  test("SUPERSEDED targets reject finalization without consuming files", async () => {
    const provider = new MockBlobStorage();
    const asset = expectOk(
      await createAsset({ id: `${runId}-fin-superseded`, name: runId, kind: "test" }),
    );
    knownAssetIds.push(asset.id);

    const request = await createOpenRequest({ targetAssetId: asset.id });
    const file = await reserveAndVerifyPng(request, provider, crypto.randomUUID());

    expectOk(
      await updateAsset({ id: asset.id, expectedVersion: 1, changes: { status: "SUPERSEDED" } }),
    );
    expectFail(
      await finalizeUploadRequest(request.rawToken, {
        submissionKey: crypto.randomUUID(),
        items: [
          {
            clientItemId: file.clientItemId,
            type: "FILE" as const,
            fileId: file.fileId,
            name: "Blocked",
            kind: "artwork",
            notes: runId,
          },
        ],
      }),
      "VALIDATION_ERROR",
    );

    const requestRow = await getPrisma().uploadRequest.findUniqueOrThrow({
      where: { id: request.id },
    });
    expect(requestRow.status).toBe("OPEN");
    expect(provider.deletedPathnames).toHaveLength(0);
  });

  test("targetRevision submissions preserve an existing primary", async () => {
    const provider = new MockBlobStorage();
    const asset = expectOk(
      await createAsset({
        id: `${runId}-revision-target`,
        name: runId,
        kind: "test",
        url: "https://example.com/legacy.png",
      }),
    );
    knownAssetIds.push(asset.id);
    const revision = await getPrisma().assetRevision.findFirstOrThrow({
      where: { assetId: asset.id },
    });

    const request = await createOpenRequest({ targetRevisionId: revision.id });
    const firstFile = await reserveAndVerifyPng(request, provider, crypto.randomUUID());
    expectOk(
      await finalizeUploadRequest(request.rawToken, {
        submissionKey: crypto.randomUUID(),
        items: [
          {
            clientItemId: firstFile.clientItemId,
            type: "FILE" as const,
            fileId: firstFile.fileId,
            name: "Append",
            kind: "artwork",
            notes: runId,
          },
        ],
      }),
    );

    const prisma = getPrisma();
    const reps = await prisma.assetRepresentation.findMany({
      where: { assetRevisionId: revision.id },
      orderBy: { createdAt: "asc" },
    });
    expect(reps).toHaveLength(2);
    // The legacy external representation keeps the primary; the first added
    // item only becomes primary on an empty revision.
    expect(reps[0]?.isPrimary).toBe(true);
    expect(reps[0]?.storageType).toBe("EXTERNAL_URL");
    expect(reps[1]?.isPrimary).toBe(false);
    expect(reps[1]?.storageType).toBe("BLOB");

    const assetAfter = await prisma.asset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(assetAfter.version).toBe(2); // bumped exactly once

    // A second submission appends again without touching the primary.
    const second = await createOpenRequest({ targetRevisionId: revision.id });
    const secondFile = await reserveAndVerifyPng(second, provider, crypto.randomUUID());
    expectOk(
      await finalizeUploadRequest(second.rawToken, {
        submissionKey: crypto.randomUUID(),
        items: [
          {
            clientItemId: secondFile.clientItemId,
            type: "FILE" as const,
            fileId: secondFile.fileId,
            name: "Append 2",
            kind: "artwork",
            notes: runId,
          },
        ],
      }),
    );
    const repsAfter = await prisma.assetRepresentation.findMany({
      where: { assetRevisionId: revision.id },
      orderBy: { createdAt: "asc" },
    });
    expect(repsAfter).toHaveLength(3);
    expect(repsAfter.filter((rep) => rep.isPrimary)).toHaveLength(1);
    expect(repsAfter.find((rep) => rep.isPrimary)?.storageType).toBe("EXTERNAL_URL");
    expect(
      (await prisma.asset.findUniqueOrThrow({ where: { id: asset.id } })).version,
    ).toBe(3);
  });

  test("rejects foreign files, mismatches, unverified files, and terminal requests", async () => {
    const provider = new MockBlobStorage();
    const request = await createOpenRequest({ maxItems: 1 });
    const owned = await reserveAndVerifyPng(request, provider, crypto.randomUUID());
    const otherRequest = await createOpenRequest({ maxItems: 2 });
    const foreign = await reserveAndVerifyPng(otherRequest, provider, crypto.randomUUID());

    // Another request's file is never disclosed or attached.
    expectFail(
      await finalizeUploadRequest(request.rawToken, {
        submissionKey: crypto.randomUUID(),
        items: [
          {
            clientItemId: owned.clientItemId,
            type: "FILE" as const,
            fileId: foreign.fileId,
            name: "Foreign",
            kind: "artwork",
            notes: runId,
          },
        ],
      }),
      "NOT_FOUND",
    );

    // The clientItemId must match the reserved file.
    expectFail(
      await finalizeUploadRequest(request.rawToken, {
        submissionKey: crypto.randomUUID(),
        items: [
          {
            clientItemId: crypto.randomUUID(),
            type: "FILE" as const,
            fileId: owned.fileId,
            name: "Mismatch",
            kind: "artwork",
            notes: runId,
          },
        ],
      }),
      "VALIDATION_ERROR",
    );

    // PENDING (never verified) files cannot finalize.
    const pendingId = crypto.randomUUID();
    expectOk(
      await reserveUploadFile(request.rawToken, {
        clientItemId: pendingId,
        sourceFilename: "pending.png",
        declaredMimeType: "image/png",
        expectedByteSize: 33,
      }),
    );
    expectFail(
      await finalizeUploadRequest(request.rawToken, {
        submissionKey: crypto.randomUUID(),
        items: [
          {
            clientItemId: pendingId,
            type: "FILE" as const,
            fileId: expectOk(
              await getUploadRequest({ id: request.id }),
            ).files.find((file) => file.clientItemId === pendingId)?.id ?? "",
            name: "Pending",
            kind: "artwork",
            notes: runId,
          },
        ],
      }),
      "UPLOAD_NOT_READY",
    );

    // maxItems is enforced server-side at finalization.
    const smallRequest = await createOpenRequest({ maxItems: 1 });
    expectFail(
      await finalizeUploadRequest(smallRequest.rawToken, {
        submissionKey: crypto.randomUUID(),
        items: [
          {
            clientItemId: crypto.randomUUID(),
            type: "EXTERNAL_URL" as const,
            externalUrl: "https://example.com/one.png",
            name: "One",
            kind: "artwork",
          },
          {
            clientItemId: crypto.randomUUID(),
            type: "EXTERNAL_URL" as const,
            externalUrl: "https://example.com/two.png",
            name: "Two",
            kind: "artwork",
          },
        ],
      }),
      "UPLOAD_LIMIT_EXCEEDED",
    );

    // Expired and revoked requests reject finalization.
    const expired = await createOpenRequest({ maxItems: 1 });
    await expireRequest(expired.id);
    expectFail(
      await finalizeUploadRequest(expired.rawToken, {
        submissionKey: crypto.randomUUID(),
        items: [
          {
            clientItemId: crypto.randomUUID(),
            type: "EXTERNAL_URL" as const,
            externalUrl: "https://example.com/late.png",
            name: "Late",
            kind: "artwork",
          },
        ],
      }),
      "UPLOAD_EXPIRED",
    );

    const revoked = await createOpenRequest({ maxItems: 1 });
    expectOk(await revokeUploadRequest({ id: revoked.id }));
    expectFail(
      await finalizeUploadRequest(revoked.rawToken, {
        submissionKey: crypto.randomUUID(),
        items: [
          {
            clientItemId: crypto.randomUUID(),
            type: "EXTERNAL_URL" as const,
            externalUrl: "https://example.com/revoked.png",
            name: "Revoked",
            kind: "artwork",
          },
        ],
      }),
      "UPLOAD_REVOKED",
    );

    // Unknown raw tokens fail closed.
    const unknownToken = "A".repeat(43);
    expectFail(
      await finalizeUploadRequest(unknownToken, {
        submissionKey: crypto.randomUUID(),
        items: [
          {
            clientItemId: crypto.randomUUID(),
            type: "EXTERNAL_URL" as const,
            externalUrl: "https://example.com/unknown.png",
            name: "Unknown",
            kind: "artwork",
          },
        ],
      }),
      "NOT_FOUND",
    );
  });
});

describe("Abandoned file cleanup", () => {
  test("selects only aged orphans, honors dry-run, and deletes only after discard", async () => {
    const provider = new MockBlobStorage();
    const prisma = getPrisma();

    // Expired OPEN request with two seeded PENDING files.
    const expired = await createOpenRequest({ maxItems: 5 });
    const expiredFileA = await reserveAndVerifyPng(expired, provider, crypto.randomUUID());
    const expiredFileB = await reserveAndVerifyPng(expired, provider, crypto.randomUUID());
    // Not seeded: deleting a missing provider object counts as success.
    expectOk(
      await reserveUploadFile(expired.rawToken, {
        clientItemId: crypto.randomUUID(),
        sourceFilename: "missing-object.png",
        declaredMimeType: "image/png",
        expectedByteSize: 33,
      }),
    );

    // Submitted request with an ATTACHED file: never a cleanup candidate.
    const submitted = await createOpenRequest({ maxItems: 5 });
    const attachedFile = await reserveAndVerifyPng(submitted, provider, crypto.randomUUID());
    expectOk(
      await finalizeUploadRequest(submitted.rawToken, {
        submissionKey: crypto.randomUUID(),
        items: [
          {
            clientItemId: attachedFile.clientItemId,
            type: "FILE" as const,
            fileId: attachedFile.fileId,
            name: "Attached",
            kind: "artwork",
            notes: runId,
          },
        ],
      }),
    );

    // Revoked request with one PENDING file.
    const revoked = await createOpenRequest({ maxItems: 5 });
    const revokedFile = expectOk(
      await reserveUploadFile(revoked.rawToken, {
        clientItemId: crypto.randomUUID(),
        sourceFilename: "revoked.png",
        declaredMimeType: "image/png",
        expectedByteSize: 33,
      }),
    );
    provider.put(revokedFile.blobPathname, pngBytes(33));
    expectOk(await revokeUploadRequest({ id: revoked.id }));

    // Backdate everything past the 24-hour retention window. The created/
    // expiry check requires expiresAt > createdAt, so both move together.
    const cutoff = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await expireRequest(expired.id);
    await prisma.uploadRequest.update({ where: { id: submitted.id }, data: { submittedAt: cutoff } });
    await prisma.uploadRequest.update({ where: { id: revoked.id }, data: { revokedAt: cutoff } });
    await prisma.uploadFile.updateMany({
      where: { uploadRequestId: { in: [expired.id, submitted.id, revoked.id] } },
      data: { createdAt: cutoff, authorizationExpiresAt: cutoff },
    });

    const candidates = await selectDiscardableUploadFiles();
    const candidateIds = candidates.map((candidate) => candidate.id);
    const orphanFiles = await prisma.uploadFile.findMany({
      where: { uploadRequestId: { in: [expired.id, revoked.id] } },
      select: { id: true },
    });
    for (const orphan of orphanFiles) {
      expect(candidateIds).toContain(orphan.id);
    }
    expect(candidateIds).not.toContain(attachedFile.fileId);

    // Dry run changes nothing.
    const dryRun = await runUploadCleanup({ apply: false, provider });
    expect(dryRun.dryRun).toBe(true);
    expect(
      await prisma.uploadFile.findUniqueOrThrow({ where: { id: expiredFileA.fileId } }),
    ).toMatchObject({ status: "VERIFIED", deletedAt: null });
    expect(provider.deletedPathnames).toHaveLength(0);

    // Apply discards, commits, then deletes from the provider.
    const applied = await runUploadCleanup({ apply: true, provider });
    expect(applied.dryRun).toBe(false);
    expect(applied.failedCount).toBe(0);
    expect(applied.discardedCount).toBe(orphanFiles.length);
    for (const orphan of orphanFiles) {
      const row = await prisma.uploadFile.findUniqueOrThrow({ where: { id: orphan.id } });
      expect(row.status).toBe("DISCARDED");
      expect(row.deletedAt).not.toBeNull();
    }
    // The missing provider object still counts as deleted.
    expect(applied.deletedCount).toBe(orphanFiles.length);

    // ATTACHED files and their bytes are never deleted.
    const attachedRow = await prisma.uploadFile.findUniqueOrThrow({
      where: { id: attachedFile.fileId },
    });
    expect(attachedRow.status).toBe("ATTACHED");
    expect(provider.deletedPathnames).not.toContain(attachedRow.blobPathname);
    // The attached file's bytes are never removed from the store.
    expect(provider.has(attachedRow.blobPathname)).toBe(true);
  });

  test("provider failures leave DISCARDED with a null deletedAt and retry later", async () => {
    const provider = new MockBlobStorage();
    const prisma = getPrisma();

    const request = await createOpenRequest({ maxItems: 5 });
    const reserved = expectOk(
      await reserveUploadFile(request.rawToken, {
        clientItemId: crypto.randomUUID(),
        sourceFilename: "failed-delete.png",
        declaredMimeType: "image/png",
        expectedByteSize: 33,
      }),
    );
    provider.put(reserved.blobPathname, pngBytes(33));

    const cutoff = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await expireRequest(request.id);
    await prisma.uploadFile.update({
      where: { id: reserved.fileId },
      data: { createdAt: cutoff, authorizationExpiresAt: cutoff },
    });

    provider.failNextOperations = true;
    const discardResult = await runUploadCleanup({ apply: true, provider, limit: 1 });
    provider.failNextOperations = false;

    const row = await prisma.uploadFile.findUniqueOrThrow({ where: { id: reserved.fileId } });
    expect(row.status).toBe("DISCARDED");
    expect(row.deletedAt).toBeNull();
    expect(discardResult.failedCount).toBe(1);

    // The next run retries the delete for the DISCARDED row.
    const retried = await runUploadCleanup({ apply: true, provider, limit: 1 });
    expect(retried.deletedCount).toBe(1);
    const retriedRow = await prisma.uploadFile.findUniqueOrThrow({
      where: { id: reserved.fileId },
    });
    expect(retriedRow.deletedAt).not.toBeNull();
    expect(provider.deletedPathnames).toContain(reserved.blobPathname);
  });
});
