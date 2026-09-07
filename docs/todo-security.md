# TODO Codex prompt — Rejectionism CampaignOS security hardening

Work in `/home/lisophorm/WebstormProjects/rejectionism-mcp`.

This is the dedicated security-hardening pass to run after the functional-completion work is merged and stable.

Read `AGENTS.md`, current documentation, authentication code, MCP routes/tool registry, upload pipeline, Blob access, admin actions, deployment configuration, package lockfile, tests, and the functional-completion report first.

Do not deploy, push, rotate live credentials, alter production data, or run destructive database commands without explicit approval. Never print or persist secrets, passwords, bearer tokens, capability URLs, private contact information, or credential-bearing database URLs.

Create an ADR before making any breaking decision about roles, credential lifecycle, retention, or external contributor access.

## Security objectives

### 1. Remove single-secret overreach

The current shared credential model must be replaced or deliberately constrained.

Design and implement a scoped, revocable credential model:

- Separate admin-session authentication from MCP credentials.
- Store MCP/API credentials only as hashes.
- Give each credential an identifier, owner/actor label, scope, expiry, revocation status, and last-used information.
- Support at minimum read, write, private-contact, and private-file scopes.
- Ensure an MCP caller cannot silently receive admin-equivalent privileges.
- Ensure private contact fields and private Blob files require explicit scope.
- Add actor identity to audit/activity records.
- Implement safe rotation, expiry, revocation, and emergency disable procedures.
- Preserve a documented local-development bootstrap path without weakening staging/production.

If full token management is not approved, provide a safe intermediate design and document the risk explicitly.

### 2. Add abuse and transport protections

- Add durable platform-backed or storage-backed rate limiting for login, MCP, upload capability validation, and expensive search paths. Do not use an in-memory-only limiter.
- Add tested security headers to admin, login, MCP, API, and upload routes:
    - content-security policy compatible with the app
    - anti-framing protection
    - no-sniff
    - strict referrer policy
    - noindex/no-cache on sensitive routes
    - HSTS only in production
- Verify cookie/session flags, CSRF posture for state-changing admin actions, redirect safety, and logout invalidation.
- Verify auth failures, validation errors, logs, and telemetry never expose credentials or private data.

### 3. Secure untrusted file processing

Run a production dependency audit and eliminate or mitigate all high/moderate findings.

- Upgrade `file-type` to a fixed compatible release and add resource-bound malformed-file regression tests.
- Treat `image-size` as a public-input availability risk. Because upstream fixes may be unavailable, replace, isolate, or strictly resource-bound it so crafted media cannot monopolise the application runtime.
- Upgrade compatible Prisma packages together; do not force incompatible lockfile resolutions.
- Validate only bounded file prefixes, enforce type/extension/magic-byte agreement, and retain server-side size limits.
- Ensure upload callbacks, verification, file retrieval, and cleanup remain idempotent.
- Test malformed, oversized, renamed, decompression-bomb-like, and unsupported samples without embedding exploit material.

### 4. Protect data, Blob storage, and operational visibility

- Confirm all private files require authenticated, scoped access and cannot be guessed, cached publicly, embedded unexpectedly, or served with unsafe content disposition.
- Confirm capability-upload tokens are short-lived, hashed at rest, revocable, and never logged.
- Add monitoring/alerts for failed login bursts, MCP auth failures, denied private-file access, upload rejection/failure, parser failures, cleanup failures, unusual Blob growth, and application exceptions.
- Add data-retention, orphan-cleanup, Blob-cost, backup/restore, and incident-response procedures.
- Test credential compromise response: revoke, rotate, invalidate sessions, disable MCP writes, and restore service safely.

### 5. Security testing and release evidence

Add automated tests for:

- unauthenticated and invalid-token access
- expired/revoked/scoped MCP tokens
- read-only token attempting writes
- private contacts/files without proper scope
- login/MCP/upload rate-limit behaviour
- CSRF and redirect safety
- security headers across all sensitive routes
- secret-redaction in errors/logs
- malformed upload resilience
- canonical and legacy MCP endpoint parity
- dependency audit gate in CI

Perform a staging penetration-oriented verification using only authorised test accounts and test data. Do not target production without written approval.

## Final report

Provide:

1. Threat model and trust boundaries.
2. ADR decisions and any approval still required.
3. Security findings fixed, with severity and evidence.
4. Remaining risks and compensating controls.
5. Exact tests/commands run and their exit outcomes.
6. A clear recommendation: internal test only, limited production use, or broad production use.