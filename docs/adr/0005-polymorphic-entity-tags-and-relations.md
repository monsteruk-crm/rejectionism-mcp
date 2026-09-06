# ADR 0005: Polymorphic Entity Tags and Directed Relationships with Service-Enforced Integrity

## Status

Accepted

## Context

CampaignOS needs generic tags and typed, directed relationships that can connect any of the seven original domain entity types (WorkItem, CanonEntry, Decision, Asset, Website, ContentItem, Contact) without adding fields to every table or creating per-pair junction tables. Tag membership and relations are independent set operations, not versioned entity mutations, and the existing aggregate optimistic-concurrency model (ADR 0002) does not describe how such operations should serialize.

The polymorphic endpoints (`entityType` + `entityId` strings) cannot carry database foreign keys to seven different tables in a single column pair. Some integrity must therefore live outside the database.

## Decision

1. Store tags and relations in three new tables: `Tag` (unique `slug`), `EntityTag` (composite primary key `tagId` + `entityType` + `entityId`), and `EntityRelation` (unique across both endpoints and `relationType`). The endpoints are polymorphic: `EntityType` enum plus a plain `entityId` string, with no per-entity foreign keys.
2. Integrity is enforced in two explicit layers instead of foreign keys:
   - **Authored SQL constraint 8** restricts `EntityTag.entityType` and both `EntityRelation` endpoint types to the original seven values, and forbids a relation from pointing from an entity to itself.
   - **Service-side existence validation** inside each mutation transaction. `lib/campaign/entity-refs.ts` contains the single explicit switch from an entity type to the corresponding Prisma model; every tag attach/detach and relation link validates both endpoints through it before writing.
3. Tag membership and relations are **independent set operations** and are a scoped exception to ADR 0002's aggregate optimistic locking: they require no `expectedVersion`, never increment an entity `version`, and serialize through unique constraints plus idempotent add/remove instead. This exception exists because set membership is convergence-oriented (attaching twice is one membership), not state-transition-oriented.
4. No-op repeats write no Activity. Unique-conflict races are resolved by retrying the whole procedure outside the failed transaction; SQL is never issued inside an aborted PostgreSQL transaction. `Tag.slug` creation races and `EntityTag` primary-key races both converge to a single tag, a single membership, and at most one audit record.
5. Relations are directed and typed (`RELATES_TO`, `USES_ASSET`, `PART_OF`); reverse records are never fabricated automatically. `USES_ASSET` requires the target to be an ASSET. Relation notes are immutable after creation: relinking the same edge with different notes is `ALREADY_EXISTS`, never a silent overwrite.
6. Tags are content labelling, not permissions. Tag definitions and domain entities are never hard-deleted; detaching removes only the association.

## Alternatives Considered

- _Per-entity junction tables with real foreign keys_: Rejected; it would multiply tables and service code for each new entity type and still not cover relations uniformly.
- _A polymorphic association with per-endpoint foreign keys enforced by triggers_: Rejected; triggers hide integrity from the reviewed migration SQL and complicate the Prisma-only access pattern.
- _Routing set operations through expectedVersion bumps on the parent entity_: Rejected; it would force concurrent taggers to conflict with unrelated metadata edits and leak membership churn into version history.

## Consequences

- Positive: One uniform tagging/linking model for all seven entity types; referential drift (unknown or deleted targets) is rejected inside the mutation transaction; races converge deterministically with minimal audit noise.
- Negative: The database alone cannot prevent a membership row pointing at a nonexistent or out-of-scope entity; that guarantee lives in `lib/campaign/entity-refs.ts` and constraint 8 and must be preserved by any new writer. Deleting a domain entity would orphan its membership/relation rows, which is acceptable because domain entities are never hard-deleted.
- Scoped exception: ADR 0002's "all mutations require expectedVersion" rule explicitly does not apply to `EntityTag`/`EntityRelation` membership changes.

## Implementation References

- `prisma/schema.prisma` (`Tag`, `EntityTag`, `EntityRelation`)
- `prisma/migrations/20260906091000_entity_tags_and_relations/migration.sql` (constraint 8)
- `lib/campaign/entity-refs.ts`
- `lib/campaign/tag-schemas.ts`, `lib/campaign/tags.ts`
- `lib/campaign/relation-schemas.ts`, `lib/campaign/relations.ts`
- `tests/unit/entity-links.test.ts`, `tests/integration/entity-links.test.ts`
- ADR 0002 (amended: set-operation concurrency exception)
