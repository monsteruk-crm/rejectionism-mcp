# Asset Storage & Private Blob Runbook

Updated: 2026-09-06.

---

## 1. Environment & Storage Configuration

CampaignOS requires a private Vercel Blob store token when handling file uploads.

Configure the following environment variables in `.env` or Vercel project settings:

```env
# Server-only private Vercel Blob read/write token
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxx

# PostgreSQL connection string for Prisma
MCP_PRISMA_DATABASE_URL=postgresql://user:password@localhost:5432/campaignos

# Disposable database URL for integration testing (must differ from operational URL)
TEST_MCP_PRISMA_DATABASE_URL=postgresql://user:password@localhost:5432/campaignos_test

# Admin session & MCP Bearer secret (32-256 characters)
CAMPAIGNOS_PASSWORD=generate-a-long-random-credential

# Application origin
CAMPAIGNOS_BASE_URL=http://localhost:3000
```

---

## 2. File Upload Quotas & Boundaries

| Parameter | Limit | Enforcement Point |
|---|---|---|
| Max File Size | 100 MB (`104,857,600` B) | Reservation, Blob Token, Finalization |
| Max SVG Size | 2 MB (`2,097,152` B) | Verification parser |
| Max Finalized Size Sum | 500 MB (`524,288,000` B) | Atomic Finalization |
| Max Items Per Request | 1..50 (default 20) | Reservation, Finalization |
| Max Lifetime Reservations | `3 * maxItems` | Reservation |
| Max Authorizations Per Slot | 3 transfers | Blob token generation |
| Max Concurrent Browser Transfers | 3 files | Client uploader |

---

## 3. Abandoned & Orphan Upload Cleanup

When contributors or internal sessions reserve file slots or upload files without finalizing the submission, the files remain in `PENDING` or `VERIFIED` state.

To clean up abandoned files whose retention deadline has passed (at least 24 hours old):

### Dry Run (Default: inspect candidates without deleting):
```bash
# Default dry-run with limit 100
pnpm files:cleanup-uploads -- --dry-run --limit 100

# Scope dry-run to a specific request ID
pnpm files:cleanup-uploads -- --dry-run --request-id <REQUEST_ID>
```

### Apply Deletion:
Running with `--apply` requires explicit `--confirm-target <fingerprint>` to guard against targeting unintended databases:

```bash
# 1. Obtain database target fingerprint
node -e '
  import("./scripts/lib/test-target.mjs").then(m => {
    console.log(m.computeDatabaseFingerprint(process.env.MCP_PRISMA_DATABASE_URL));
  });
'

# 2. Execute deletion pass with confirmation
pnpm files:cleanup-uploads -- --apply --confirm-target <DATABASE_FINGERPRINT> --limit 100
```

The CLI script:
1. Identifies `UploadFile` records that are `PENDING`, `VERIFIED`, or `REJECTED`, unreferenced by any `AssetRepresentation`, and whose request status and authorization deadlines are both at least 24 hours old.
2. Under a row lock, re-verifies eligibility before marking the row `DISCARDED`.
3. Commits the transaction and deletes the physical files from private Vercel Blob storage.
4. Marks `deletedAt = now()` upon successful provider deletion (or leaves `deletedAt = null` for retry if the provider fails).
5. Output prints candidate IDs, status, expected byte counts, and totals (never credentials, URLs, or token hashes).
