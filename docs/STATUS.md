# Current status

Updated: 2026-09-07.

## Capability

- **Rejectionism CampaignOS**: Full shared domain service layer (`lib/campaign/`) backing both the `/admin` web interface and the remote MCP server.
- **MCP Server Endpoints**:
  - `/api/mcp` (canonical): Serves 47 tools (2 bootstrap, 1 status, 4 work items, 3 canon, 3 decisions, 8 assets, 1 legacy asset, 5 upload links, 4 websites, 4 content items, 4 contacts, 6 tags/relations, 1 global search `campaign_search`, 1 activity feed) over Streamable HTTP with canonical instructions.
  - `/mcp` (legacy compatibility): Serves the exact same authenticated 47 tools via the shared handler factory (`lib/mcp/handler.ts`).
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
  - Strict cleanup CLI (`scripts/cleanup-upload-files.ts`) requiring target fingerprint confirmation (`--confirm-target`).
- **Database Architecture**:
  - Prisma 7 schema with 12 domain models, 4 migrations (`init`, `campaign_os`, `assets_and_upload_requests`, `entity_tags_and_relations`, `upload_request_purpose`).
  - Integer-based optimistic concurrency (`version`) and transactional audit logging on all mutations.

## Verification Evidence

- **Unit Test Suite (`tests/unit/`)**: 23 test files, 184 tests, all passing. Covers script environment loading, test target guards, readiness checks, MCP tool contracts and annotations, shared MCP handler, admin form values and actions, entity links and lookups, file validation, upload tokens, upload routes, upload draft storage, and cleanup CLI argument parsing.
- **Integration Test Harness (`tests/integration/`)**: Covers asset migration, visual asset workflow, campaign services, entity connections, global substring search, upload request lifecycle, and internal upload sessions.
- **Tooling & Build**: TypeScript strict compilation (`pnpm type-check`) passing with 0 errors; production build (`pnpm build`) passing.
- Connect production PostgreSQL database on Vercel and run `pnpm db:deploy` and `pnpm db:seed`.
