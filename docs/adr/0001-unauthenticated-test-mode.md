# ADR 0001: Temporary Unauthenticated Fail-Closed Test Mode

## Status

Superseded by [ADR 0003](0003-single-password-boundary-authentication.md).

## Context

Rejectionism CampaignOS MVP requires immediate operational accessibility for development, testing, and AI client integration via MCP without requiring full OAuth or credentials management. However, deploying an unauthenticated database-backed server introduces security risks if sensitive data or open write access is exposed.

## Decision

1. Implement a temporary test mode governed strictly by `process.env.UNAUTHENTICATED_TEST_MODE === "true"`.
2. Fail closed dynamically: when the variable is missing or anything other than `"true"`, all campaign reads and mutations are blocked, returning `TEST_MODE_DISABLED` to MCP clients and displaying a clear notice in the `/admin` interface.
3. Conspicuous warning banner (`UNAUTHENTICATED TEST SYSTEM — DO NOT STORE PRIVATE OR SENSITIVE DATA`) displayed across all admin views and documentation.
4. Strictly prohibit storing private credentials, bank details, passwords, or sensitive personal data.
5. Do not provide entity deletion or bulk-delete MCP tools.
6. Designate proper authentication and authorization (e.g. OAuth / CIMD / session auth) as the first mandatory post-MVP milestone.

## Alternatives Considered

- _Open unauthenticated access without an environment gate_: Rejected due to high risk of unintended data leakage or unauthorized mutations in deployed environments.
- _Full authentication (Clerk / NextAuth) in MVP_: Rejected per product specifications (MVP explicitly excludes authentication frameworks).

## Consequences

- Positive: Safe local and preview testing with unambiguous fail-closed behavior.
- Negative: Operational data must remain non-sensitive until proper authentication is implemented.

## Implementation References

- `lib/campaign/test-mode.ts`
- `lib/campaign/results.ts`
- `app/admin/layout.tsx`
- `app/api/health/route.ts`
