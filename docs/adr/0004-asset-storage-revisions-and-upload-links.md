# ADR 0004: Private Blob Storage, Asset Revisions, and Capability Upload Links

## Status

Accepted

## Context

Rejectionism CampaignOS requires durable, bounded asset storage that supports multi-format exports (master SVG, PNG renders, print PDF, Drive archives) across creative versions of visual assets. The system must accept submissions from untrusted external contributors via single-use upload links without granting contributor accounts, exposing administrative APIs, or trusting client-asserted file types or dimensions.

Uploaded files use Vercel Blob. Because artwork files contain unreleased campaign material, they cannot be stored in a public bucket or served directly from public CDN URLs.

## Decision

1. **Private Vercel Blob Store**:
   - `BLOB_READ_WRITE_TOKEN` is server-only. All Blob operations use the private access mode with CDN caching disabled during verification.
   - Storage pathnames are immutable and server-owned: `campaignos/uploads/<requestId>/<fileId>.<canonicalExtension>`. The server supplies every segment; client-supplied pathnames or extensions are never trusted.
   - Verified file retrieval and raster previews are delivered exclusively through authenticated application endpoints (`/api/assets/representations/[id]/file`), requiring a valid admin session or MCP Bearer credential. Public upload capabilities cannot download private files.

2. **Server-Side Verification Authority**:
   - Browser metadata is never authoritative. The server inspects provider-observed byte size, uses `file-type` for byte-level MIME sniffing, validates SVG XML (strictly rejecting DOCTYPE/ENTITY declarations and requiring the SVG namespace), and extracts raster image dimensions with bounded axis and area caps.
   - Bounded prefix reads cancel the provider stream at the cap (`INSPECTION_PREFIX_BYTES = 262144`) instead of buffering whole archives.

3. **Capability Token Isolation**:
   - Upload capability tokens are 32 cryptographically random bytes (43 base64url characters). Only the lowercase SHA-256 hex hash is ever stored in `UploadRequest.tokenHash`.
   - The raw token is returned exactly once upon creation or regeneration and exists only in recipient memory; it is excluded from Activity, receipts, and administrative list/get projections.
   - Delegation is bounded: maximum items (1..50), lifetime slot budgets (`3 * maxItems`), lifetime reservation byte caps (1 GB), per-file caps (100 MB; SVG 2 MB; submission sum 500 MB), and at most 3 authorizations per file slot.

4. **Atomic Finalization and Identical Replay**:
   - Upload request finalization is an atomic database transaction locking the request row by token hash using `SELECT ... FOR UPDATE`.
   - All storage I/O occurs outside the transaction; no Blob is ever deleted on database failure (failed mutations leave files staged and the request OPEN for retry).
   - Identical-request replay (matching `submissionKey` UUID and canonical payload hash) returns the stored minimal receipt without writes, providing idempotent retry safety even past expiry.
   - Targeted finalization validates the captured `targetAssetVersion` with compare-and-set optimistic locking, bumping the parent Asset version exactly once per operation.

5. **Explicit Abandoned-File Cleanup**:
   - A dedicated CLI script (`scripts/cleanup-upload-files.ts` / `pnpm files:cleanup-uploads`) performs cleanup with `--dry-run` as the default and `--apply` required for deletion.
   - Candidates are unreferenced `UploadFile` rows whose request is terminal or expired and whose deadlines are at least 24 hours old.
   - The database transaction sets status to `DISCARDED` and commits BEFORE the provider delete; a provider failure leaves `DISCARDED` with a null `deletedAt` for retry by the next run.

## Alternatives Considered

- _Public Blob Store with Signed Expiring URLs_: Rejected; signed URLs can leak into proxy logs or browser histories and public blobs cannot be revoked without changing bucket configurations.
- _Multipart Chunk Streaming through Application Server_: Rejected; routing multi-megabyte binary payloads through serverless routes creates memory pressure and timeouts. Direct browser-to-Blob upload via capability tokens isolates data plane from control plane.
- _Automatic Blob Deletion on Transaction Failure_: Rejected; network partitions or database aborts would leave dangling references or discard valid contributor uploads. Staging files independently with explicit cleanup ensures durable retries.

## Consequences

- Positive: Unreleased artwork remains private and access-controlled; contributor submissions are isolated and bounded; finalization is race-free and idempotent; storage costs from abandoned uploads are manageable via explicit cleanup.
- Negative: Private file delivery requires authenticated server proxying; local verification depends on mock providers rather than live cloud bucket access; contributors must regenerate if target assets change concurrently.

## Implementation References

- `prisma/schema.prisma` (`AssetRevision`, `AssetRepresentation`, `UploadRequest`, `UploadFile`)
- `lib/campaign/storage.ts`, `lib/storage/vercel-blob.ts`
- `lib/campaign/file-validation.ts`, `lib/campaign/upload-tokens.ts`
- `lib/campaign/upload-requests.ts`, `lib/campaign/upload-files.ts`
- `lib/campaign/upload-finalization.ts`, `lib/campaign/upload-cleanup.ts`
- `scripts/cleanup-upload-files.ts`
- `tests/unit/upload-tokens.test.ts`, `tests/unit/file-validation.test.ts`
- `tests/integration/upload-requests.test.ts`
