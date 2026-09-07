# Local Development and Verification

Use pnpm 8.15.7 and a Prisma-compatible Node release: **20.19+**, **22.12+**, or **24+**.

## Setup

1. Copy `.env.example` to `.env.local` (or configure your development database):
   ```bash
   cp .env.example .env.local
   ```
2. Set `MCP_PRISMA_DATABASE_URL` to your local or development PostgreSQL database (named `MCP_PRISMA_DATABASE_URL` because Vercel reserves `DATABASE_URL`).
3. Set `TEST_MCP_PRISMA_DATABASE_URL` to a disposable PostgreSQL database for integration tests.
4. Set `CAMPAIGNOS_PASSWORD` to a generated 32–256 character credential (allowed: letters, digits, `-`, `_`). It is the admin login password and the MCP Bearer token.
5. Set `BLOB_READ_WRITE_TOKEN` to your private Vercel Blob store token.
6. `CAMPAIGNOS_BASE_URL` defaults to `http://localhost:3000` in development. Missing or invalid configuration fails closed (ADR 0003).

```bash
pnpm install
pnpm db:generate
pnpm dev
```

App will be available at `http://localhost:3000` (Admin at `http://localhost:3000/admin`, MCP at `http://localhost:3000/api/mcp`).

---

## Prisma Database Operations

All Prisma scripts use `prisma7.config.ts` explicitly:

```bash
# Validate Prisma schema
pnpm db:validate

# Generate Prisma Client
pnpm db:generate

# Apply migrations in development
pnpm db:migrate

# Apply migrations in production / CI
pnpm db:deploy

# Run idempotent database seed
pnpm db:seed

# Idempotent legacy asset reference backfill (counts only; safe to repeat)
pnpm db:backfill-assets
```

### Legacy Asset Migration Cutover

Migration `20260906090000_assets_and_upload_requests` is purely additive: new
enums, tables, and authored CHECK constraints, plus a revision-1 row for every
existing Asset. The authorized cutover sequence for any database that already
holds Assets is, in order:

1. `pnpm db:deploy` — applies the migration (also inserts revision 1 rows).
2. `pnpm db:backfill-assets` — creates an EXTERNAL_URL representation on
   revision 1 for each Asset whose legacy URL passes validation. Idempotent:
   the `legacyAssetId` marker skips already migrated rows, invalid URLs stay
   untouched, and no Asset column, version, or timestamp is modified.
3. `pnpm db:seed` — seeds missing fixtures; existing Assets are never
   refreshed.

Run the sequence on an explicitly disposable development database first. For
any shared or deployed database, the backfill is a separately authorized
cutover step and is never executed by build, startup, or a page request.

---

## Testing & Quality Commands

```bash
# Run unit test suite (Vitest)
pnpm test

# Run tests in watch mode
pnpm test:watch

# Apply migrations and seed data, then run integration tests. TEST_MCP_PRISMA_DATABASE_URL
# must be a disposable PostgreSQL database and must differ from MCP_PRISMA_DATABASE_URL.
TEST_MCP_PRISMA_DATABASE_URL=postgresql://... pnpm test:integration

# Run MCP protocol suite against running server
pnpm test:mcp --origin=http://localhost:3000

# Run functional release verification gate
pnpm verify:functional --origin=http://localhost:3000

# Format code with Prettier
pnpm format
pnpm format:check

# Run smoke test client against running local server
pnpm test:client -- http://localhost:3000

# Run smoke writes only against a disposable database-backed server.
pnpm test:client -- http://localhost:3000 --test-writes --disposable-database
```

The default smoke command is a release gate: tool registration, `echo`, database connectivity, and required campaign reads must succeed with the documented structured response shape. It exits nonzero for degraded results. Write mode creates a uniquely identified work item, requires the disposable-database acknowledgement, and must never target persistent operational data.

The integration harness refuses to run without `TEST_MCP_PRISMA_DATABASE_URL` or when it exactly matches `MCP_PRISMA_DATABASE_URL`. It does not reset or drop the target. Tests remove run-specific records, while deterministic seed fixtures remain for subsequent idempotent runs.

### Integration Harness Behavior

`scripts/test-integration.mjs` is self-configuring — no shell exports required:

- It resolves both targets from the canonical `.env.local`: `TEST_MCP_PRISMA_DATABASE_URL` (disposable test database) and `MCP_PRISMA_DATABASE_URL` (operational target used only for the isolation check). Inherited environment variables take precedence when set, but the file is the source of truth; stale `DATABASE_URL` values in the shell cannot defeat the check.
- It runs, in order: `pnpm db:deploy` (apply migrations), `pnpm db:backfill-assets` (idempotent legacy backfill), `pnpm db:seed`, then the Vitest integration suites. Child processes receive `MCP_PRISMA_DATABASE_URL` set to the test target.
- `vitest.integration.config.ts` runs test files sequentially (they share one database), with 240s per-test/hook timeouts for remote-database latency.

### Server-Only Script Convention

`lib/campaign/*` modules import the `server-only` guard package, which throws when resolved outside Next.js's `react-server` condition. Any standalone TS script that transitively imports them (seed, asset backfill) MUST run through tsx with that condition enabled:

```bash
tsx --conditions=react-server <script.ts>
```

This is already configured for `db:seed` (via `prisma7.config.ts`) and `db:backfill-assets` (via `package.json`). The `--conditions` flag maps `server-only` to its empty entry, matching Next.js server behavior; the seed additionally allows up to 120s for its single atomic transaction because it performs ~200 sequential queries and remote PostgreSQL latency can exceed the default 20s interactive-transaction budget.

---

## MCP Inspector Debugging

Connect MCP Inspector to inspect tools and run interactive calls:

```bash
npx @modelcontextprotocol/inspector http://localhost:3000/api/mcp
```
