# ADR 0002: Shared PostgreSQL Domain Services with Transactional Audit and Optimistic Concurrency

## Status

Accepted (amended 2026-09-06: scoped set-operation concurrency exception, see ADR 0005)

## Context

CampaignOS operations must be driven identically by two client interfaces: the `/admin` web interface (React Server Actions) and the `/api/mcp` remote MCP server. Business rules (such as work-item completion evidence and blocked reason requirements), optimistic concurrency version checks, and activity audit logging must not be duplicated or drift between these access surfaces.

## Decision

1. Implement a single server-only domain service layer under `lib/campaign/` containing all Prisma interactions, input validation, and business logic.
2. Both Server Actions (`app/admin/actions.ts`) and MCP tool handlers (`lib/mcp/campaign-tools.ts`) act as thin adapters calling the shared domain services.
3. Use integer versioning (`version Int @default(1)`) on all mutable entities. Updates require `expectedVersion` and execute an atomic update predicate (`WHERE id = :id AND version = :expectedVersion`) in an interactive transaction.
4. Every successful entity creation or mutation writes an `Activity` record in the same database transaction. Failed or stale mutations roll back and produce no audit entries.
5. Decisions are strictly append-only and immutable. An optional supersession link (`supersedesId`) allows tracking decision evolution without deleting historical decisions.

## Alternatives Considered

- _Separate business logic in Server Actions and MCP handlers_: Rejected due to duplication and high probability of rule divergence.
- _Generic Repository / Unit-of-Work abstraction layer_: Rejected as unnecessary indirection over Prisma Client.

## Consequences

- Positive: Guaranteed parity between Web Admin and MCP operations, audit log consistency, and race-free concurrent updates.
- Negative: All updates must provide `expectedVersion`, requiring clients and forms to hold current version state.

## Amendment (2026-09-06): Set-Operation Concurrency Exception

Generic tag membership (`EntityTag`) and directed relationships (`EntityRelation`) are independent set operations, not versioned entity mutations. They do not require `expectedVersion` and do not increment an entity `version`; they serialize through unique constraints plus idempotent add/remove, write no Activity on no-op repeats, and retry unique-conflict races outside the failed transaction. This scoped exception is specified in ADR 0005 and applies only to these two tables — every other mutation keeps expected-version concurrency.

## Amendment (2026-09-10): Access Telemetry Exception

CampaignMemory read access tracking (`accessCount`, `lastAccessedAt`) is updated by a best-effort, short-timeout parameterized raw UPDATE outside the read transaction; it does not increment `version`, change `updatedAt`, or write an `Activity` audit record. All semantic and metadata mutations of `CampaignMemory` remain fully subject to expected-version CAS and transactional audit logging (see ADR 0007).

## Implementation References

- `lib/campaign/work-items.ts`
- `lib/campaign/canon.ts`
- `lib/campaign/decisions.ts`
- `lib/campaign/assets.ts`
- `lib/campaign/websites.ts`
- `lib/campaign/contacts.ts`
- `lib/campaign/content.ts`
- `lib/campaign/activity.ts`
