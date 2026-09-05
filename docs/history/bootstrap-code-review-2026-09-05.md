# Bootstrap code review

> Historical review record, captured 2026-09-05 against commit `d5a4508` on the
> local `work` branch. This document records review evidence and is not a
> current capability contract. Consult [current status](../STATUS.md) for the
> latest project state.

## Scope and review boundary

<<<<<<< ours
Pull request #1 could not be retrieved from this checkout: no Git remote is
configured and GitHub CLI is unauthenticated. The review therefore covers the
entire bootstrap commit available locally rather than a verified pull-request
diff.

The review traced the documented entry points through the MCP routes, tool
adapters, shared campaign services, Prisma schema and migrations, admin Server
Actions and pages, tests, and operational documentation. No deployment or
live-database verification was performed.

## Recommendation

**Request changes before treating the bootstrap as release-ready.** The
application builds and its current unit tests pass, but its required lint gate
does not run, its smoke client can return success when core checks fail, and
admin pages can present validation or availability failures as empty data or
404 responses. The transactional database behavior also has no automated
integration coverage.

## Findings

### 1. High: the required lint gate crashes before checking source

`pnpm lint` exits with code 2 while loading the ESLint configuration, reporting
`TypeError: Converting circular structure to JSON`. The flat configuration
adapts `next/core-web-vitals` through `FlatCompat`, while the repository also
retains a legacy `.eslintrc.json`. As a result, the required lint command
provides no evidence about rule compliance and cannot protect the branch.

**Evidence:** `eslint.config.mjs:1-17`, `.eslintrc.json:1-3`, and the executed
`pnpm lint` result.

**Required fix:** replace the compatibility bridge with the supported Next.js
flat-config exports (and remove the obsolete legacy config), then make
`pnpm lint` pass in CI.

### 2. High: the smoke client reports success after database and campaign failures

The smoke client only throws when tool registration or `echo` fails. A failed
`check_database` call and failed campaign read calls are logged as warnings;
execution then reaches `All smoke test assertions completed successfully.` and
exits successfully. This permits a deployment with a broken database, disabled
campaign access, invalid output, or failed campaign tools to pass its advertised
protocol smoke check.

The optional write check also creates a persistent work item without deleting
it or using a deterministic id, so repeated smoke runs pollute operational data.

**Evidence:** `scripts/test-client.mjs:78-120` and
`scripts/test-client.mjs:122-140`.

**Required fix:** fail the default smoke command when database or required
campaign calls return `isError`; assert the expected structured response shape;
and make write verification reversible or deterministic against a disposable
test database. If degraded checks are useful, expose them through an explicit
flag that cannot be confused with release verification.

### 3. Medium: admin list pages hide invalid filters and backend failures as empty registers

List pages cast query-string values directly to enum types and pass them to the
strict service schemas. When validation, the test-mode gate, or the database
fails, several pages replace the error with `[]` and `0`. For example,
`/admin/work-items?status=typo` displays a valid-looking empty register instead
of an invalid-filter message. The same pattern is present in assets, canon,
contacts, content, decisions, and websites.

**Evidence:** `app/admin/work-items/page.tsx:8-22`,
`app/admin/assets/page.tsx:8-22`, `app/admin/canon/page.tsx:8-23`,
`app/admin/contacts/page.tsx:7-10`, `app/admin/content/page.tsx:8-20`,
`app/admin/decisions/page.tsx:7-10`, and `app/admin/websites/page.tsx:7-10`.

**Required fix:** validate URL filters at the page boundary and render a clear
validation or availability state whenever a service result is not `ok`. Do not
equate failed retrieval with an authoritative empty dataset.

### 4. Medium: detail pages convert every service failure into a 404

Each admin detail page calls `notFound()` for all unsuccessful service results,
not only `NOT_FOUND`. A disabled test-mode gate, unavailable database,
validation failure, or internal failure is therefore reported as a missing
entity. This obscures incidents and contradicts the UI notice that operational
views are blocked when test mode is disabled.

**Evidence:** `app/admin/work-items/[id]/page.tsx:12-17`,
`app/admin/assets/[id]/page.tsx:12-17`,
`app/admin/canon/[id]/page.tsx:11-16`,
`app/admin/contacts/[id]/page.tsx:11-16`,
`app/admin/content/[id]/page.tsx:12-17`,
`app/admin/decisions/[id]/page.tsx:10-15`, and
`app/admin/websites/[id]/page.tsx:12-17`.

**Required fix:** call `notFound()` only for `NOT_FOUND`; render or throw a
distinct operational error for all other error codes.

### 5. Medium: the core transaction and concurrency claims are not integration-tested

The three unit-test files cover schemas, the test-mode predicate, and MCP result
formatting. The configured integration suite contains no test files and reports
`No test files found, exiting with code 0`. Consequently, there is no automated
evidence that migrations apply, services can read and write PostgreSQL,
optimistic concurrency rejects stale updates, failed transactions omit activity
records, or decision-plus-canon mutations are atomic.

**Evidence:** `tests/unit/`, `vitest.integration.config.ts`, the executed
`pnpm test` result, and the executed `pnpm test:integration` result.

**Required fix:** add disposable-PostgreSQL integration tests for migration and
seed execution, one representative CRUD flow per service, stale-version races,
transaction rollback/audit invariants, decision supersession, and compound
decision/canon mutations. Do not describe these properties as locally verified
until those checks execute against PostgreSQL.

### 6. Low: the repository-wide format check is already red

`pnpm format:check` exits with code 1 and reports 49 files, including application
code and canonical documentation. This is not a runtime defect, but it makes the
documented quality command unusable as a clean baseline and will obscure later
formatting regressions.

**Evidence:** the executed `pnpm format:check` result.

**Required fix:** format the intended source/documentation scope and enforce the
check in CI. Exclude vendored or mirrored skill content if it should not be
rewritten by this repository.

## Checks executed

| Command                 | Result                       | Boundary                                                               |
| ----------------------- | ---------------------------- | ---------------------------------------------------------------------- |
| `node --version`        | Pass (`v24.15.0`)            | Local toolchain only                                                   |
| `pnpm --version`        | Pass (`8.15.7`)              | Local toolchain only                                                   |
| `pnpm lint`             | Fail (exit 2)                | ESLint configuration crashes before linting                            |
| `pnpm type-check`       | Pass                         | Strict TypeScript no-emit check                                        |
| `pnpm test`             | Pass (18 tests in 3 files)   | Unit tests only; Vite emitted a config-loader warning                  |
| `pnpm test:integration` | Pass with no tests collected | No database behavior verified                                          |
| `pnpm format:check`     | Fail (49 files)              | Repository formatting baseline is not clean                            |
| `pnpm db:validate`      | Pass                         | Prisma schema parses; no database connection required                  |
| `pnpm build`            | Pass                         | Production compilation and page generation; no live database exercised |

## Documentation impact and ADR decision

This review adds historical evidence only. It does not change a contract,
runbook, architecture, current capability, or deployment state. No ADR is
needed because the review makes no durable architectural decision.
=======
Pull request #1 could not be retrieved from this checkout: no Git remote was configured and GitHub CLI was unauthenticated. The review therefore covered the entire bootstrap commit available locally rather than a verified pull-request diff.

The review traced the MCP routes, tool adapters, shared campaign services, Prisma schema and migrations, admin Server Actions and pages, tests, and operational documentation. No deployment or live-database verification was performed.

## Recommendation at capture time

The review requested changes before treating the bootstrap as release-ready. Application builds and unit tests passed, but the lint gate crashed, the smoke client tolerated core failures, admin pages obscured service errors, database invariants lacked integration coverage, and the format baseline was red.

## Findings at capture time

1. **High — lint configuration:** `pnpm lint` crashed while adapting the legacy Next.js ESLint configuration, so it provided no source-quality evidence.
2. **High — smoke false positives:** database and campaign `isError` results only produced warnings, and the optional write check left persistent nondeterministic records.
3. **Medium — list error handling:** admin list pages cast URL filters to enums and represented validation, gate, or database failures as empty registers.
4. **Medium — detail error handling:** admin detail pages converted every unsuccessful service result, not only `NOT_FOUND`, into a 404.
5. **Medium — database verification:** the integration configuration collected no tests, leaving migration, persistence, concurrency, rollback/audit, supersession, and compound mutation claims unverified against PostgreSQL.
6. **Low — formatting baseline:** `pnpm format:check` reported 49 unformatted source and canonical documentation files.

## Checks recorded by the review

| Command                 | Historical result            | Boundary                                    |
| ----------------------- | ---------------------------- | ------------------------------------------- |
| `node --version`        | Pass (`v24.15.0`)            | Local toolchain only                        |
| `pnpm --version`        | Pass (`8.15.7`)              | Local toolchain only                        |
| `pnpm lint`             | Fail (exit 2)                | ESLint configuration crashed before linting |
| `pnpm type-check`       | Pass                         | Strict TypeScript no-emit check             |
| `pnpm test`             | Pass (18 tests in 3 files)   | Unit tests only                             |
| `pnpm test:integration` | Pass with no tests collected | No database behavior verified               |
| `pnpm format:check`     | Fail (49 files)              | Formatting baseline was not clean           |
| `pnpm db:validate`      | Pass                         | Schema parsing only                         |
| `pnpm build`            | Pass                         | No live database exercised                  |

## Documentation and ADR boundary

This historical record itself made no contract or architecture decision. No ADR was needed. Current behavior and verification evidence belong in the canonical status, contract, project-context, and runbook documents linked from the [documentation index](../00-index.md).
>>>>>>> theirs
