# Current status

Updated: 2026-09-06.

## Capability

- **Rejectionism CampaignOS MVP**: Full shared domain service layer (`lib/campaign/`) backing both the `/admin` web interface and the `/api/mcp` remote MCP server.
- **MCP Server Endpoints**:
  - `/api/mcp` (canonical): Serves 10 `campaign_*` tools and 2 bootstrap tools (`echo`, `check_database`) over Streamable HTTP with global system instructions.
  - `/mcp` (legacy compatibility): Serves bootstrap and campaign tools.
- **Admin Interface (`/admin`)**:
  - Live Dashboard showing status counters, Now, Next, Blocked, Missing assets, Website statuses, Recent decisions, and Activity feed.
  - Full management screens for Work Items, Canon, Decisions, Assets, Websites, Content, and Contacts.
  - List filters use shared strict schemas, failed retrievals remain distinct from empty datasets, and detail pages use 404 only for missing records.
- **Database Architecture**:
  - Prisma 7 schema and authored migrations (`20260905144500_campaign_os`, additive `20260906090000_assets_and_upload_requests`, `20260906091000_entity_tags_and_relations`) with 12 domain models plus the unrelated bootstrap `User`.
  - Asset storage structures (upgrade plan Phase 2 & 5; ADR 0004): `AssetRevision`, `AssetRepresentation`, `UploadRequest`, `UploadFile` with authored CHECK constraints, one-primary-per-revision partial index, and revision-1 rows for all legacy Assets.
  - Idempotent seed (`pnpm db:seed`) seeds 13 canon entries, 4 websites, 10 ordered work items, and 29 visual assets; existing Assets are never refreshed.
  - Idempotent legacy backfill (`pnpm db:backfill-assets`) migrates valid legacy URLs to primary EXTERNAL_URL representations; invalid URLs remain plain-text legacy data.
  - Integer-based optimistic concurrency (`version`) and transactional audit logging on all mutations.
- **Asset revision/representation services (upgrade plan Phase 3)**: strict focused schemas and DTOs (`asset-schemas.ts`, `asset-dtos.ts`); revision and representation services enforce parent CAS versioning before child writes, SUPERSEDED rejection, empty-revision/status transitions, first-representation-becomes-primary, and already-primary no-op switching; legacy `updateAsset` appends a revision plus primary EXTERNAL_URL representation on a different URL while same-string saves and clears never touch revisions, `registerAsset` strips its `action` discriminator, and `getAssetById`/`listAssets` return detail/list DTOs with legacy-reference warnings.
- **Generic tags and directed relationships (upgrade plan Phase 4; ADR 0005)**: `Tag`/`EntityTag`/`EntityRelation` tables with polymorphic endpoints validated by authored SQL constraint 8 (original seven entity types, no self-relation) plus in-transaction existence checks through the single `lib/campaign/entity-refs.ts` switch; fixed slug normalization; idempotent attach/detach and directed link/unlink with no-op repeats writing no Activity, unique-conflict race retry, immutable relation notes (`ALREADY_EXISTS` on conflict), `USES_ASSET` target rule, and incoming/outgoing/both reads with entity titles and admin hrefs; set operations never bump entity versions (ADR 0002 amendment). Asset detail/list DTOs now carry real tags/relationships and `listAssets` accepts an all-slugs tag filter.
- **Blob storage and upload-request services (upgrade plan Phase 5; ADR 0004)**: private Vercel Blob adapter with stream-cancelling prefix reads (`storage.ts`, `lib/storage/vercel-blob.ts`); server-side file format/size/dimension validation with SVG XML checks (`file-validation.ts`); raw capability tokens hashed via SHA-256 (`upload-tokens.ts`); request lifecycle (`upload-requests.ts`) with target resolution and CAS target versions; immutable file reservation and bounded authorization (`upload-files.ts`); atomic finalization (`upload-finalization.ts`) with identical-request replay, targeting modes, status transitions, and audited receipts; explicit CLI cleanup (`upload-cleanup.ts`, `scripts/cleanup-upload-files.ts` / `pnpm files:cleanup-uploads`) with `--dry-run` default and `--apply` deletion.
- **Security (single-password boundary authentication, ADR 0003)**:
  - Shared `CAMPAIGNOS_PASSWORD` credential (32–256 chars) for admin login and MCP Bearer auth, compared in constant time; missing/invalid config fails closed.
  - Stateless signed session cookie (`campaignos_session`, HMAC-SHA256, 7-day TTL) guarding every admin RSC page and Server Action; both MCP transports require the Bearer credential (401 otherwise).
  - Shared origin guard against validated `CAMPAIGNOS_BASE_URL`; login/logout Server Actions with generic failure feedback.
  - Health endpoint (`GET /api/health`) verifying database connectivity via the shared health service.

## Verification Evidence

- **Unit Test Suite (`tests/unit/`)**: Unit tests verify strict Zod validation schemas (including the Phase 3 asset/representation inputs, Phase 4 tag slug normalization plus tag/relation inputs, and Phase 5 upload schemas, token hashing, and file validation rules), auth configuration/session/boundary/origin guards, the external-URL validator, the shared health service, and MCP tool response formatting without requiring a live database. Executed 2026-09-06: 9 files, 107 tests, all passing.
- **Integration Suite (`tests/integration/`)**: The harness requires a distinct `TEST_MCP_PRISMA_DATABASE_URL`, deploys migrations, runs the asset backfill and seed, and verifies persistence, stale-version rejection, audit rollback, decision supersession, migration constraints, backfill idempotence, seed no-overwrite, the Phase 3 asset rules (revision numbering, primary switching and no-op, SUPERSEDED rejection, APPROVED requiring a latest-revision representation, legacy URL append/clear/same-string, registerAsset dispatch), Phase 4 tag/relation rules (all seven target types, invalid/deleted targets, duplicate and concurrent attaches, no-op detach, slug collisions with immutable names, USES_ASSET and self-link validation, direction reads, relation-note conflict, no-audit failures, asset tag projections and all-slugs filter), and Phase 5 upload request lifecycle, bounded reservation/authorization, idempotent verification with mock storage, atomic finalization with replay safety and targeting modes, and aged orphan cleanup. Executed 2026-09-06 against a disposable remote PostgreSQL target (distinct credential from operational `MCP_PRISMA_DATABASE_URL`; target identity confirmed): 5 files, 47 tests, all passing. Notes: script execution requires `tsx --conditions=react-server` so `server-only` modules resolve outside Next.js, and interactive transactions allow up to 60s for remote latency.
- **Tooling & Build**: Next 16.3.4, React 19.2.8, Tailwind CSS v4.3.3, Prisma 7.10.0 client generation, Vitest 5.0.0, and Prettier 3.9.6 configured.
- **Smoke Client (`scripts/test-client.mjs`)**: Requires successful database and campaign reads with valid structured results. Write checks require an explicit disposable-database acknowledgement.

## Next Work and Mandatory Milestone

- Blob-backed uploads, upload-link administration, and remaining MCP contract surfaces (upgrade plan Phases 5–7).
- MCP/Admin management parity, global search, and documentation reconciliation (upgrade plan Phases 8–10).
- Connect production PostgreSQL database on Vercel and run `pnpm db:deploy` and `pnpm db:seed`.
