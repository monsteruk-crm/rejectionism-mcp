# ADR 0003: Single-Password Boundary Authentication with Stateless Signed Sessions

## Status

Accepted. Supersedes [ADR 0001](0001-unauthenticated-test-mode.md).

## Context

The temporary unauthenticated fail-closed test mode (ADR 0001) blocked every campaign read and mutation unless `UNAUTHENTICATED_TEST_MODE=true` was set, deliberately deferring real authentication to the first post-MVP milestone. That milestone is now due: deployments must protect data and mutations with actual credentials while keeping operational burden minimal for a single-operator application. Full identity-provider integration (OAuth / CIMD / per-user accounts) remains out of scope for this phase. Two client surfaces must be protected with different credential transports: the `/admin` web interface (cookie-based browser sessions and Server Actions) and the `/api/mcp` MCP transport (non-browser clients sending Bearer tokens). Per ADR 0002, all business logic stays in the shared `lib/campaign/` services; authentication is a boundary concern and must not leak into them.

## Decision

1. Use a single shared credential, `CAMPAIGNOS_PASSWORD` (32–256 characters, strict pattern), as both the admin password and the MCP Bearer secret. Configuration lives in a server-only module, is validated lazily at request time, and fails closed: missing or invalid configuration blocks all authenticated access and never throws during module import.
2. Compare supplied credentials in constant time by hashing both sides to fixed-length SHA-256 digests and using `timingSafeEqual`. Supplied values are never trimmed, logged, or echoed back.
3. Admin UI sessions are stateless signed cookies (`campaignos_session`) with value `v1.<base64url(payload)>.<base64url(HMAC-SHA256 signature)>`. The payload is exactly `{ v, iat, exp, nonce }` in epoch seconds with a random 16-byte nonce, TTL 7 days. The signing key is derived as `HMAC-SHA256(key=CAMPAIGNOS_PASSWORD, message="campaignos:admin-session:v1")`, so rotating the password invalidates every existing session. Cookies are `HttpOnly`, `SameSite=Lax`, `Secure` in production, and bounded in size.
4. Guard every operational entry point at its own boundary rather than relying on layout inheritance:
   - `requireAdminPage()` on every admin RSC page (redirects to `/login`); layouts and pages render in parallel, so each page is guarded independently even though the layout is also guarded.
   - `requireAdminAction()` on every exported admin Server Action, before any input parsing or domain side effect.
   - `authenticateMcpRequest()` on both MCP transport routes (`/api/mcp` and legacy `/mcp`). Only the configured Bearer credential authorizes MCP; a valid admin session cookie is insufficient, and upload capability tokens (future) must never match. Failures return 401 with `WWW-Authenticate: Bearer` and `Cache-Control: no-store`.
5. Validate origins against the configured `CAMPAIGNOS_BASE_URL` (an origin only: no credentials, no path/query/fragment, HTTPS required in production, loopback rejected in production), never against the untrusted `Host` or forwarded-host headers. Missing-Origin policy is per boundary: cookie-authenticated browser endpoints reject a missing Origin; Server Actions compare the header when present (Next.js retains its own Server Action origin validation); MCP permits an omitted Origin for non-browser clients but rejects a mismatched one.
6. Login and logout are Server Actions with same-origin enforcement, bounded password input, generic failure feedback, and no user enumeration. The login page fails closed with a clear message when the credential is unconfigured.
7. The public `GET /api/health` route and the `check_database` MCP bootstrap tool delegate to one shared server-only health service performing a single `SELECT 1` with a 3-second timeout. Health remains unauthenticated, proves connectivity only, and exposes no secrets, table data, or error details.
8. Remove ADR 0001's test mode entirely: the `UNAUTHENTICATED_TEST_MODE` flag, `lib/campaign/test-mode.ts`, the warning banner, and all service-level gates. Fail-closed behavior is preserved at the new authentication boundaries.

## Alternatives Considered

- _Full identity provider (Clerk / NextAuth / OAuth + CIMD) now_: Rejected for this phase; integration and deployment burden exceeds current single-operator needs and remains designated future work.
- _Per-user accounts with database-backed sessions_: Rejected; no user model exists, and server-side session state adds operational surface on a serverless deployment.
- _Reverse-proxy / gateway authentication only_: Rejected; application boundaries must hold independently of hosting topology.
- _Long-lived random session IDs checked against a server-side store_: Rejected in favour of stateless signed tokens, avoiding a session store while accepting the revocation trade-off documented below.

## Consequences

- Positive: Every operational entry point (admin pages, admin Server Actions, MCP transports) requires authentication; the sensitive-data prohibition of ADR 0001 is lifted by enforcement rather than policy; password rotation invalidates all sessions at once; stateless verification suits serverless; MCP clients integrate with a single Bearer credential.
- Negative: One shared credential with no per-user identity; no per-session revocation beyond password rotation and the 7-day expiry; brute-force resistance relies on credential length and hosting-level rate limiting (no built-in lockout or throttling); a missing or malformed `CAMPAIGNOS_PASSWORD` disables the application by design.

## Implementation References

- `lib/auth/config.ts`
- `lib/auth/session.ts`
- `lib/auth/origin.ts`
- `lib/auth/boundaries.ts`
- `lib/campaign/health.ts`
- `app/login/page.tsx`, `app/login/actions.ts`, `app/login/_components/login-submit.tsx`
- `app/api/mcp/route.ts`, `app/mcp/route.ts`
- `app/admin/layout.tsx` and all admin pages/Server Actions carrying the guards
