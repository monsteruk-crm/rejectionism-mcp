# Repository Guidelines

These instructions apply throughout this repository unless a nested `AGENTS.md` overrides them.

## Authority and Task Startup

Follow the current user request and applicable agent instructions first, then current status and accepted ADRs, canonical project documentation, implementation/tests, runbooks, and finally agent memory. Documentation describes intended behaviour; source and executed checks establish what actually works. Resolve disagreements explicitly rather than treating a plan or stale document as runtime evidence.

For every non-trivial task:

1. Read this file, `docs/00-index.md`, `docs/STATUS.md`, and `docs/PROJECT-CONTEXT.md`.
2. Follow their links to the relevant contracts, architecture, and runbooks.
3. Check `git status` and preserve existing user changes.
4. State a concise plan naming docs read, relevant constraints, source entry points, documentation impact, and whether an ADR is needed.

Start source inspection at task-defined or documented entry points. Follow imports and callers incrementally. Use `rg` with a specific question and the smallest useful scope; avoid speculative repository-wide inventories. Explain why before widening a search beyond the affected area.

## Project Structure & Module Organization

This minimal Next.js 15 App Router application exposes a stateless Model Context Protocol (MCP) server. The main implementation is `app/mcp/route.ts`; keep tools, prompts, and resources there unless a feature warrants a separate module. `scripts/test-client.mjs` is the MCP smoke-test client. Static files belong in `public/`; root-level files configure the application and tooling.

## Build, Test, and Development Commands

Use pnpm 8.15.7. Prisma 7 requires Node.js 20.19+, 22.12+, or 24+; Node 22.21.1 was used for the bootstrap checks. Check installed versions before giving initialization or upgrade commands. Do not mix Prisma 7 ORM commands with Prisma 8 or Composer commands.

- `pnpm install` installs dependencies from `pnpm-lock.yaml`.
- `pnpm dev` starts the local Next.js server at `http://localhost:3000`.
- `pnpm build` creates a production build and catches Next.js integration errors.
- `pnpm start` serves the completed production build.
- `pnpm type-check` runs TypeScript in strict, no-emit mode.
- `pnpm lint` checks the repository with ESLint and Next.js Core Web Vitals rules.
- `pnpm test:client -- http://localhost:3000` connects to a running server, lists tools, and calls `echo` and `check_database`. Always pass the target origin explicitly.

## Coding Style & Naming Conventions

Write strict TypeScript for application code and modern ESM JavaScript for scripts. Follow two-space indentation, double quotes, semicolons, and trailing commas in multiline structures. Use `camelCase` for variables and functions, `PascalCase` for types or components, and lowercase route directories. Give MCP tools concise verb-oriented names and bounded, `.strict()` Zod schemas. Include accurate annotations, especially for read-only or destructive behavior.

## Testing Guidelines

There is currently no unit-test framework or coverage threshold. For application code changes, run `pnpm lint`, `pnpm type-check`, and `pnpm build` before handoff, unless the user explicitly defers verification. For protocol changes, start the app and run the client smoke test against it. For documentation-only changes, check links, consistency, and `git diff --check`; do not run application checks solely for prose edits. If adding automated tests, place them beside the code as `*.test.ts` or under a focused `tests/` directory, and add the corresponding pnpm script.

Report implemented, inspected, locally tested, and deployed verification separately. Record the actual target and date. A successful `SELECT 1` proves connectivity, not table access, migration correctness, write permissions, or business workflows. Never report an unexecuted runbook as passing.

## Commit & Pull Request Guidelines

Use short, imperative commit subjects such as `Add resource listing tool`, and keep each commit focused. Pull requests should explain the behavior changed, list verification commands, link relevant issues, and include sample MCP requests/responses when contracts change. Add screenshots only for visible UI or static-asset changes. Do not commit, push, deploy, or start child agents unless authorized by the user.

## Security & Configuration

Do not commit `.env*`, credentials, private keys, or deployment secrets. Validate all externally supplied tool arguments with Zod, preserve conservative MCP annotations, and document any new environment variables in `README.md` without including real values.

Keep database access server-side through `lib/prisma.ts`. Do not edit generated Prisma code. Review schema changes and authored migrations; do not reset databases or apply migrations to a shared/deployed database without authority for that target. Do not expose arbitrary SQL, user records, connection strings, or raw database errors through diagnostic tools.

## Documentation Maintenance

Documentation is part of a behaviour-changing task. Update affected canonical documents and runbooks in the same task:

| Information | Destination |
| --- | --- |
| Navigation only | `docs/00-index.md` |
| Source entry points and current architecture | `docs/PROJECT-CONTEXT.md` |
| Current capability, blockers, verification, next work | `docs/STATUS.md` |
| MCP schemas, annotations, results, errors | `docs/contracts/` |
| Setup, operations, executable checks | `docs/runbooks/` |
| Durable architectural decisions and trade-offs | `docs/adr/` when needed |
| Future product or expanded architecture specifications | `docs/product/` or `docs/architecture/` when needed |

Keep the index a router and status a concise current snapshot. Do not create task-summary or milestone-change dumps. Promote durable facts from temporary plans into canonical docs. Historical material, if needed, belongs under `docs/history/` and must be labelled as non-current.

Create an ADR only for a durable change to authentication, trust, data ownership, storage, integration, deployment, or concurrency strategy. Use the next four-digit number; include status, context, decision, alternatives, consequences, and implementation references. Create/update `docs/adr/README.md` and the documentation index when adding an ADR. Do not invent retrospective decisions for existing code or create ADRs for routine fixes.

Before handoff, confirm that affected contracts/runbooks match the code, status accurately distinguishes verification boundaries, links resolve, and no secrets or speculative capabilities were documented. Briefly report documentation changed, ADR decision, checks actually run, and relevant verification gaps.

## Memory Rules

Canonical repository documentation is the durable project memory. Agent/local memory is a navigation aid, never a substitute for these documents. Verify remembered paths, versions, commands, deployment status, and configuration against current evidence before relying on them; disclose when relying on an unverified historical fact.

Update external agent memory only when the user explicitly requests it and the memory provider permits it. A routine documentation update does not authorize an external memory write. Prefer short, scoped notes pointing to canonical files, with checkout and date, over copying entire documents. Follow provider-specific update rules; do not edit generated memory registries directly.

Never store credentials, tokens, connection strings, personal data, production payloads, raw transient logs, or speculative conclusions in memory. Do not turn a one-time success into a permanent health claim. When a remembered fact is stale, correct canonical documentation first and submit a memory correction only when authorized.
