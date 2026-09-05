# Local Development and Verification

Use pnpm 8.15.7 and a Prisma-compatible Node release: **20.19+**, **22.12+**, or **24+**.

## Setup

1. Copy `.env.example` to `.env` (or configure your development database):
   ```bash
   cp .env.example .env
   ```
2. Set `DATABASE_URL` to your local or development PostgreSQL database.
3. Keep `UNAUTHENTICATED_TEST_MODE=true` for local development.

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
```

---

## Testing & Quality Commands

```bash
# Run unit test suite (Vitest)
pnpm test

# Run tests in watch mode
pnpm test:watch

# Apply migrations and seed data, then run integration tests. TEST_DATABASE_URL
# must be a disposable PostgreSQL database and must differ from DATABASE_URL.
TEST_DATABASE_URL=postgresql://... pnpm test:integration

# Format code with Prettier
pnpm format
pnpm format:check

# Run smoke test client against running local server
pnpm test:client -- http://localhost:3000

# Run smoke writes only against a disposable database-backed server.
pnpm test:client -- http://localhost:3000 --test-writes --disposable-database
```

The default smoke command is a release gate: tool registration, `echo`, database connectivity, and required campaign reads must succeed with the documented structured response shape. It exits nonzero for degraded results. Write mode creates a uniquely identified work item, requires the disposable-database acknowledgement, and must never target persistent operational data.

The integration harness refuses to run without `TEST_DATABASE_URL` or when it exactly matches `DATABASE_URL`. It does not reset or drop the target. Tests remove run-specific records, while deterministic seed fixtures remain for subsequent idempotent runs.

---

## MCP Inspector Debugging

Connect MCP Inspector to inspect tools and run interactive calls:

```bash
npx @modelcontextprotocol/inspector http://localhost:3000/api/mcp
```
