# Local development and verification

Use pnpm 8.15.7 and a Prisma-compatible Node release: 20.19+, 22.12+, or 24+. Bootstrap verification used Node 22.21.1. The repository already contains a Prisma schema/config; do not repeat `prisma init` during routine setup.

## Setup

Set `DATABASE_URL` privately in the project environment to a PostgreSQL connection string accepted by the `pg` adapter. Do not use an Accelerate `prisma+postgres://` URL with this direct adapter. Never paste credentials into docs or MCP arguments.

Next.js loads its environment files; `prisma7.config.ts` imports `dotenv/config` for CLI usage. A value present only in `.env.local` is not automatically loaded by plain dotenv. Ensure CLI and application intentionally target the same database when comparing results.

```bash
pnpm install
pnpm exec prisma --version
pnpm exec prisma generate
pnpm dev
```

Installation already runs generation through `postinstall`; explicit generation is useful after schema changes. Generated files are not edited manually.

## Schema and migration checks

```bash
pnpm exec prisma migrate status
```

This is a separate check from `check_database`. Review schema changes and create migrations against an intended development database. Applying migrations to a shared/deployed database or resetting data requires authorization for that target. Never infer authority from a connectivity check request.

## Protocol acceptance

With a local server running, use a second terminal:

```bash
pnpm test:client -- http://localhost:3000
```

Expect tools to include `echo` and `check_database`, echoed content to match the input, and database structured content to contain `status: "ok"`, `result: 1`, and nonnegative `latencyMs`. Failure must be investigated at the correct layer: missing tool/deployment, MCP connection, environment, or database query.

For production-build verification:

```bash
pnpm lint
pnpm type-check
pnpm build
pnpm start
```

Stop a development server using the same port before `pnpm start`, then run the smoke client again. Stop only processes started for your task; do not kill unrelated servers.

For an authorized deployed check:

```bash
pnpm test:client -- https://rejectionism-mcp.vercel.app
```

Always provide the origin: the script's fallback still points at the original template. Record target, date, command result, and relevant structured output without secrets. Local success does not prove deployed success; `SELECT 1` does not prove application behaviour or table access.
