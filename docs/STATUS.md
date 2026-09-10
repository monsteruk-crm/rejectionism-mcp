# Current status

Updated: 2026-09-10.

## Capability

- **Rejectionism CampaignOS**: Full shared domain service layer (`lib/campaign/`) backing both the `/admin` web interface and the remote MCP server.
- **MCP Server Endpoints**:
  - `/api/mcp` (canonical): Serves 55 tools, including 8 persistent-memory tools, over Streamable HTTP with canonical instructions.
  - `/mcp` (legacy compatibility): Serves the exact same authenticated 55 tools via the shared handler factory (`lib/mcp/handler.ts`).
  - Extended tool inputs: `campaign_activity_feed` supports `entityId` filtering, pagination `offset`, and strict `createdAt desc, id desc` ordering; `campaign_list_upload_links` supports effective `EXPIRED` status and `targetAssetId` filtering; `campaign_revoke_upload_link` correctly reports `changed: false` on idempotent repeats.
- **Admin Interface (`/admin`)**:
  - Command Dashboard with status counters, Now, Next, Blocked, Missing assets, Website statuses, Recent decisions, Activity feed, and search.
  - Full management screens for Work Items, Canon, Decisions, Assets, Contributor Links, Websites, Content, and Contacts.
  - Form reliability: Controlled draft state with `useActionState`, typed `ActionResult` return values (`lib/admin/action-result.ts`), field error mapping (`FieldError`), and explicit conflict review (`ConflictReview`) on optimistic concurrency collisions without destroying user input.
  - Navigation & Pagination: Responsive navigation with mobile menu disclosure, 25-row limit/offset pagination (`Pagination`) across all registers and global search, and accessible record selector (`EntityPicker`) eliminating raw ID copying and 100-asset truncation.
- **Upload Services & Purpose Separation (ADR 0004 & ADR 0006)**:
  - Additive `UploadRequestPurpose` enum (`CONTRIBUTOR`, `ADMIN_INTERNAL`) and `UploadRequest.purpose` column with migration `20260907130000_upload_request_purpose`.
  - Contributor links remain capability-authorized via `Authorization: Upload <token>`; internal administrative uploads use active admin session cookies and `X-CampaignOS-Upload-Request-Id`.
  - Unified byte-inspection core (`inspectAndVerifyUploadFile`) invoked by browser verification, signed SDK completion callbacks, and admin retry actions.
  - Read-only status endpoint (`GET /api/uploads/status`) for session recovery and reservation rehydration.
  - Contributor list/get/revoke/regenerate and token services are purpose-scoped; reservation budgets are serialized by locking the request row before counting lifetime slots and bytes.
  - Status recovery accepts an absent browser `Origin` on GET while rejecting a supplied cross-origin value, then merges persisted reservation IDs and states into contributor and admin drafts.
  - Strict cleanup CLI (`scripts/cleanup-upload-files.ts`) requiring target fingerprint confirmation (`--confirm-target`).
- **Persistent Memory (ADR 0007)**:
  - Durable, provenance-bearing CampaignMemory records are shared by Admin and eight MCP tools; stable keys transfer atomically to successors and context packs return persisted category, confidence, source, URL, and version metadata.
- **Database Architecture**:
  - Prisma 7 schema with 16 campaign domain models plus the bootstrap User model and 7 authored migrations.
  - Integer-based optimistic concurrency (`version`) and transactional audit logging on all mutations.

## Verification Evidence

- **Unit Test Suite (`tests/unit/`)**: 26 test files, 207 tests, all passing locally on 2026-09-10. Covers memory schemas, hashing and relevance in addition to boundary, service, MCP, upload, and script helpers.
- **Integration Test Harness (`tests/integration/`)**: Covers asset migration, visual asset workflow, campaign services, entity connections, global substring search, upload request lifecycle, and internal upload sessions.
- **Tooling & Build**: TypeScript strict compilation (`pnpm type-check`) passing with 0 errors; production build (`pnpm build`) passing.
- Connect production PostgreSQL database on Vercel and run `pnpm db:deploy` and `pnpm db:seed`.
