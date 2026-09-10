# ADR 0006: Internal Upload Sessions, Purpose Separation, and Shared Recovery

## Status

Accepted

## Context

ADR 0004 established private Blob storage and capability upload links for external contributors using random 32-byte capability tokens. However, internal administrative uploads (such as bulk asset uploads in `/admin/assets/upload`) were previously implemented by creating capability upload links, causing them to pollute the public contributor register, generate unused public URLs, and mix administrative authority with unauthenticated capability delegation.

CampaignOS requires a unified upload pipeline where internal administrative uploads share the exact same validation, direct-to-Blob transfer, verification, and atomic finalization mechanisms without generating public capability URLs or exposing administrative operations to contributor token holders.

## Decision

1. **Upload Request Purpose Separation**:
   - Introduce `UploadRequestPurpose` enum (`CONTRIBUTOR`, `ADMIN_INTERNAL`) and non-null `UploadRequest.purpose` column defaulted to `CONTRIBUTOR`.
   - Contributor requests are created with `purpose: CONTRIBUTOR`, generate a capability URL returned once, and are listed in the Contributor Links register and MCP tools.
   - Internal sessions are created with `purpose: ADMIN_INTERNAL`, have a fixed 24-hour expiration, max 50 items, generate no public capability URL, and are excluded from contributor registers and MCP contributor tools.

2. **Unified Upload Authentication Boundary (`/api/uploads/*`)**:
   - Introduce a shared server-only authorization union (`lib/uploads/upload-auth.ts`).
   - Contributor operations authenticate with `Authorization: Upload <token>`.
   - Internal operations authenticate with active admin session cookie (`campaignos_session`) plus `X-CampaignOS-Upload-Request-Id: <id>`.
   - Simultaneous explicit contributor and internal credentials are rejected (400 `INVALID_AUTH`).
   - Ambient admin cookies do not prevent using contributor links when `Upload <token>` authorization is supplied.
   - Both authorization channels resolve to a shared request-ID core for reservation, verification, status reads, and finalization.

3. **Shared Inspection Core and Verification Webhook**:
   - Extract byte-inspection core (`inspectAndVerifyUploadFile`) operating on request and file IDs.
   - Invoked identically by browser verification (`POST /api/uploads/verify`), SDK completion callbacks (`onUploadCompleted`), and administrative retry actions.
   - Repeated verification of already-verified files returns persisted technical metadata rather than resetting state.

4. **Dedicated Status and Draft Recovery**:
   - Introduce read-only `GET /api/uploads/status` endpoint to rehydrate reservation states without storing file bytes or tokens in browser storage.
   - Contributor status returns scoped request state and minimal receipts, hiding internal target entity IDs and asset links.
   - Internal admin status exposes resulting asset links upon completion.

## Alternatives Considered

- _Separate Internal Upload Controller & Tables_: Rejected; duplicating file reservation, verification, and finalization would create diverging bug vectors and inconsistent concurrency guarantees.
- _Reusing Contributor Links for Admins with UI Filtering_: Rejected; polluting contributor token registers with admin sessions creates auditing confusion and leaves unused capability tokens in the database.

## Consequences

- Positive: Administrative and contributor uploads share one race-safe, auditable pipeline; admin uploads never generate public links; verification is unified across callbacks and browser checks; draft recovery operates without storing credentials or raw file bytes.
- Negative: Requires header/session validation union in upload route handlers; internal uploads require active admin session cookies.

## Implementation References

- `prisma/schema.prisma` (`UploadRequestPurpose`, `UploadRequest.purpose`)
- `prisma/migrations/20260907130000_upload_request_purpose/migration.sql`
- `lib/uploads/upload-auth.ts`
- `lib/campaign/admin-upload-sessions.ts`
- `lib/campaign/upload-status.ts`, `app/api/uploads/status/route.ts`
- `lib/campaign/upload-files.ts`, `lib/campaign/upload-finalization.ts`
- `tests/integration/internal-upload-sessions.test.ts`
