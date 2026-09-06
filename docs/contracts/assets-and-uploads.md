# Assets, Revisions, Representations, and Upload Contracts

Updated: 2026-09-06. Covers architectural contracts from ADR 0004 and upgrade plan Phases 2, 3, 5, 6, 7.

---

## 1. Data Model Hierarchy

Visual assets in CampaignOS follow a three-tier append-only model:

1. **Asset (Conceptual Entity)**:
   - Contains conceptual identity (`name`, `kind`), workflow status (`MISSING`, `DRAFT`, `NEEDS_WORK`, `APPROVED`, `SUPERSEDED`), notes, optimistic concurrency counter (`version`), and legacy reference compatibility columns (`sourceFilename`, `url`).
   - Structural mutations increment `version` atomically via compare-and-set (`CAS`).
   - Every Asset has at least one sequential revision (initial empty revision 1 created upon asset registration).

2. **AssetRevision (Versioned Snapshot)**:
   - Contains `revisionNumber` (positive integer, sequential per asset), optional `label`, optional `notes`, `createdAt`.
   - Immutable; revisions are never deleted or renumbered.
   - Holds one or more `AssetRepresentation` records.

3. **AssetRepresentation (Concrete File or External URL)**:
   - `storageType`: `BLOB` (private Vercel Blob) or `EXTERNAL_URL` (public HTTP/HTTPS reference).
   - `isPrimary`: boolean flag. Exactly one primary representation is enforced per non-empty revision via partial unique index `AssetRepresentation_one_primary_per_revision`.
   - Metadata: `label`, `notes`, `variant`, `format`, `sourceFilename`, `mimeType`, `byteSize`, `width`, `height`, `checksumSha256`, `blobUrl`, `blobPathname`, `externalUrl`, `createdAt`.
   - Technical metadata on `BLOB` records is verified server-side; clients cannot supply unverified sizes, MIME types, or dimensions.

---

## 2. Storage Adapter & File Validation

- **Storage Provider**: Private Vercel Blob store (`@vercel/blob`).
- **File Restrictions**:
  - Allowed Formats: `PNG`, `JPEG`, `GIF`, `WebP`, `SVG`, `PDF`, `ZIP`.
  - Maximum File Size: `104,857,600` bytes (100 MB); `SVG` maximum: `2,097,152` bytes (2 MB).
  - Maximum Sum of Verified File Sizes in One Finalization: `524,288,000` bytes (500 MB).
  - Maximum Dimension: `32,768` px along any axis, `100,000,000` pixels area.
- **Server-Side Validation**:
  - First 256 KB inspected using `file-type` magic bytes.
  - SVG XML inspected using `fast-xml-parser` for well-formedness and safety (rejects `<!DOCTYPE>` and `<!ENTITY>` tags).
  - Image dimensions extracted safely using `image-size`.

---

## 3. Capability Upload Lifecycle

1. **Link Creation (`createUploadRequest`)**:
   - Generates 32 random bytes, base64url-encoded without padding (43 characters).
   - Only lowercase SHA-256 hash is persisted in `UploadRequest.tokenHash`. The raw token is returned once to the creator and never stored or recoverable.
   - Captures `targetAssetVersion` at creation time if targeting an asset or revision.
   - Bounded parameters: `expiresInDays` (1..30, default 7), `maxItems` (1..50, default 20).

2. **Effective Status State Machine**:
   - Persisted `SUBMITTED` $\rightarrow$ `SUBMITTED`
   - Persisted `REVOKED` $\rightarrow$ `REVOKED`
   - Persisted `OPEN` and `now >= expiresAt` $\rightarrow$ `EXPIRED`
   - Otherwise $\rightarrow$ `OPEN`
   - Mutations (prepare, authorize, verify, finalize) are only accepted when effective status is `OPEN`.

3. **Direct-to-Storage Transfer**:
   - `POST /api/uploads/prepare`: Reserves an immutable `UploadFile` record with server-generated pathname `campaignos/uploads/<requestId>/<fileId>.<ext>`. Streamed body capped at 16 KB.
   - `POST /api/uploads/blob`: Vercel Blob client upload bridge (`handleUpload`). `onBeforeGenerateToken` validates the capability token and increments `authorizationCount` (max 3 authorizations per slot).
   - `POST /api/uploads/verify`: Server-side inspection verifying byte size, MIME type, dimensions, and SVG XML.
   - `POST /api/uploads/finalize`: Atomic finalization transaction locking the request row, verifying all files, CAS updating parent assets, appending revisions/representations, recording audit activity, and persisting a deterministic submission receipt. Streamed body capped at 2 MB.
   - **Replay Safety**: Exactly repeating a successful finalization request with identical payload hash returns the existing receipt without duplicate mutations.
   - The contributor UI retains one submission key across finalization retries until it receives that receipt, including when a successful commit's response is lost.

---

## 4. Private-File Delivery Endpoint

- **Endpoint**: `GET /api/assets/representations/[id]/file`
- **Authentication**: Requires valid admin session cookie OR `Authorization: Bearer <CAMPAIGNOS_PASSWORD>`. Capability upload tokens cannot access file downloads.
- **Headers & CSP**:
  - `Cache-Control: private, no-store`
  - `X-Content-Type-Options: nosniff`
  - Inline disposition for raster images (`image/png`, `image/jpeg`, `image/gif`, `image/webp`) unless `?download=1` is provided.
  - Attachment disposition with sandbox CSP (`Content-Security-Policy: default-src 'none'; sandbox`) for non-raster formats (`SVG`, `PDF`, `ZIP`).
  - `EXTERNAL_URL` representations return HTTP 404 (contributors/admins open external URLs directly).
