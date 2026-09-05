# ADR 0002: Shared PostgreSQL Domain Services with Transactional Audit and Optimistic Concurrency

## Status
Accepted

## Context
CampaignOS operations must be driven identically by two client interfaces: the `/admin` web interface (React Server Actions) and the `/api/mcp` remote MCP server. Business rules (such as work-item completion evidence and blocked reason requirements), optimistic concurrency version checks, and activity audit logging must not be duplicated or drift between these access surfaces.

## Decision
1. Implement a single server-only domain service layer under `lib/campaign/` containing all Prisma interactions, input validation, and business logic.
2. Both Server Actions (`app/admin/actions.ts`) and MCP tool handlers (`lib/mcp/campaign-tools.ts`) act as thin adapters calling the shared domain services.
3. Use integer versioning (`version Int @default(1)`) on all mutable entities. Updates require `expectedVersion` and execute an atomic update predicate (`WHERE id = :id AND version = :expectedVersion`) in an interactive transaction.
4. Every successful entity creation or mutation writes an `Activity` record in the same database transaction. Failed or stale mutations roll back and produce no audit entries.
5. Decisions are strictly append-only and immutable. An optional supersession link (`supersedesId`) allows tracking decision evolution without deleting historical decisions.

## Alternatives Considered
- *Separate business logic in Server Actions and MCP handlers*: Rejected due to duplication and high probability of rule divergence.
- *Generic Repository / Unit-of-Work abstraction layer*: Rejected as unnecessary indirection over Prisma Client.

## Consequences
- Positive: Guaranteed parity between Web Admin and MCP operations, audit log consistency, and race-free concurrent updates.
- Negative: All updates must provide `expectedVersion`, requiring clients and forms to hold current version state.

## Implementation References
- `lib/campaign/work-items.ts`
- `lib/campaign/canon.ts`
- `lib/campaign/decisions.ts`
- `lib/campaign/assets.ts`
- `lib/campaign/websites.ts`
- `lib/campaign/contacts.ts`
- `lib/campaign/content.ts`
- `lib/campaign/activity.ts`
