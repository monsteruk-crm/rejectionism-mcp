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

When contributors reserve file slots or upload files without finalizing the submission, the files remain in `PENDING` or `VERIFIED` state.

To clean up abandoned files older than a specified duration (e.g. 24 hours):

### Dry Run (Default: inspect without deleting):
```bash
pnpm files:cleanup-uploads --hours=24
```

### Apply Deletion:
```bash
pnpm files:cleanup-uploads --hours=24 --apply
```

The CLI script:
1. Identifies `UploadFile` records that are `PENDING`, `VERIFIED`, or `REJECTED`, not linked to any `AssetRepresentation`, and created more than `--hours` ago.
2. Deletes the physical files from private Vercel Blob storage.
3. Updates `UploadFile.status = "DISCARDED"` and sets `deletedAt = now()`.
4. Output prints file counts and freed byte totals only (never credentials or raw tokens).
