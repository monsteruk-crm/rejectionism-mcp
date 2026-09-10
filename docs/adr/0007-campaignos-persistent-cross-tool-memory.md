# ADR 0007: CampaignOS Persistent Cross-Tool Memory

- **Status**: Accepted (2026-09-10)
- **Date**: 2026-09-10
- **Supersedes**: none
- **Superseded by**: none
- **Related ADRs**: 0002 (service / audit / concurrency), 0003 (boundary auth), 0005 (generic tags/relations), 0006 (upload sessions)

## Context

Rejectionism CampaignOS is exposed to human operators through a `/admin` interface
and to external clients (ChatGPT, Codex, Claude, IDE agents) through the
`/api/mcp` and `/mcp` Model Context Protocol endpoints. Conversation history
inside any one client is private to that client; deleting a ChatGPT thread
does not delete Codex-side context, and vice versa.

Without a shared durable store, every client re-derives durable campaign
knowledge (preferred voice, recurring lessons, deliberate constraints,
people, projects, durable creative direction) from scratch. Repeated
mistakes, lost context, and contradictory in-flight updates are recurring
operational costs.

There is also a strict architectural separation already in force:

- **Canon** is official, mutable-by-design, authoritative truth (e.g. "Pope
  Valeriano's papal name is Rejectus IV"). It is operationally heavy (every
  change writes Activity) and exists to be the single source of truth.
- **Decision** records why an authoritative choice was made and retains full
  supersession history.
- **WorkItem** records something that must be done.
- **Activity** records that something happened inside CampaignOS.
- **Asset** records visual media with revisions and representations.
- **Contact / Website / Content** record the people, channels, and external
  surfaces of the campaign.

None of those is the right home for "the founders prefer papal imagery to
look plausibly ecclesiastical before the joke is obvious". That kind of
operational context is durable cross-session knowledge that does not
belong in Canon but must outlive any single chat.

## Decision

Implement **`CampaignMemory`**, a first-class PostgreSQL-backed durable
operational memory layer, shared across every MCP client and the Admin
back-office. PostgreSQL is the source of truth; chat history in any
external client is explicitly NOT a durable memory.

### Distinctions

| Concern | Role | Authoritative precedence |
| --- | --- | --- |
| `Canon` | official, mutable-by-design truth | outranks Memory when they contradict |
| `Decision` | rationale for an authoritative choice | precedes historical Memory |
| `WorkItem` | something that must be done | operational scheduling |
| `Asset` | visual media, revisions, representations | concrete deliverables |
| `Activity` | audit of mutations | governed by ADR 0002 |
| `CampaignMemory` | durable cross-session operational context | intentionally selective |

Memory is **not** chat history, transcript, chain-of-thought, every-message
capture, raw tool output, or resolved transient errors. Memory is curated
durable context whose value persists across MCP client reinstalls.

### Persistence

Single new Prisma model `CampaignMemory`, with two new enums
(`MemoryCategory`, `MemoryStatus`, `MemorySourceType`). Append-only via
two authored PostgreSQL migrations (`20260910100000_campaign_memory_entity_type`
adds the `CAMPAIGN_MEMORY` enum value; the succeeding
`20260910100100_campaign_memory` creates the table, indexes, and constraints).
`EntityTag_original_entity_type_chk` and `EntityRelation_endpoints_chk`
are dropped and recreated with the expanded allowlist (the original seven
plus `CAMPAIGN_MEMORY`); their constraint names are preserved.

### Determinism

- ASCII-normalize and trim whitespace before hashing. Hash the JSON tuple
  `[normalize(category), normalize(title), normalize(content)]` with
  SHA-256. The hash deliberately excludes key, provenance, importance,
  confidence, pin, expiry, tags, and relations so two records that share
  the meaningful content collide even if operator metadata differs.
- A unique partial index `CampaignMemory_active_content_hash_key`
  enforces exact-duplicate protection on `ACTIVE` rows at the database
  boundary. Historical `SUPERSEDED`/`ARCHIVED` rows may legitimately share
  the same contentHash.
- The recall scorer is a pure, deterministic, transparent function in
  `memory-relevance.ts`. Exact-key receives +1000; title-phrase +120; token
  matches in key/title/content/source/tag/entity-context receive scored
  boosts capped per token class; pinned rows get +40; importance, recency,
  and access-frequency contributions are bounded to small metadata
  amounts. Score constants are named and exported.
- Pure pagination through a stable ID ascending keyset; no opaque candidate
  cutoffs. List and recall both honour `(status, expiresAt)` filtering.

### Authority

Recall results never present themselves as authoritative current truth.
`campaign_get_context` returns structured sections labelled by authority:

```
authorityOrder:
  explicit_user_instruction  # highest
  canon
  current_decision
  active_memory
  historical_record          # lowest

authorityNotice:  # explicit notice that Memory is operational context,
                  # not authoritative truth
```

Authority warnings (`SAME_KEY_REVIEW_REQUIRED`, `RELATED_CANON_REVIEW_REQUIRED`,
`SHARED_TOPIC_REVIEW_REQUIRED`) are emitted as deterministic REVIEW notices
when a returned memory and a returned canon row share a key, a direct
relationship, or at least one meaningful task token. They never claim a
fabricated semantic contradiction; Canon wins when they conflict.

### Telemetry

`get_memory` and `recall` default to `trackAccess: true` and post a
parameterized raw `UPDATE` that increments `accessCount` (saturating at
PostgreSQL `INT` max via a bigint intermediate) and bumps `lastAccessedAt`
without touching `updatedAt`, `version`, or `Activity`. The telemetry uses
a separate short-bound transaction (500ms max wait, 1.5s timeout, 100ms
lock timeout, 500ms statement timeout). Telemetry failures are swallowed;
recall never fails because tracking failed.

`get_context` is strictly read-only: no telemetry, no writes, no inferring
follow-ups, no auto-canon updates, no automatic summary generation.

### Concurrency

All mutations use optimistic concurrency:

- `updateMany({where:{id, version:expected, status:"ACTIVE"}})` for
  metadata edits with version increment.
- `updateMany({where:{id, version:expected, status:"ACTIVE"}})` followed
  by `status:"ARCHIVED"` for archive.
- CAS-update predecessor with `version:expected`, `status:"SUPERSEDED"`, and
  `key:null` before inserting the successor, transferring stable-key ownership
  without violating the global key uniqueness constraint; create the new row with `supersedesId` and
  `version: 1`.
- Unique-race retries (P2002, P2034) around the outermost transaction up
  to 3 attempts.

Provenance: MCP-created memories force `sourceType=MCP`; Admin-created
memories force `sourceType=ADMIN`; the `sourceLabel` field is descriptive
text and is never authenticated identity.

## Alternatives considered

- **Use chat history as memory.** Rejected: conversation history is private
  per client, opaque to others, and explicitly NOT durable across clients.
  ChatGPT, Codex, and IDE agents must share the same memory without
  leaking any one client's chat history.
- **Store memory inside Canon.** Rejected: Canon is operationally heavy,
  has no expiry, and is meant for official durable facts. Imposing memory
  semantics on Canon would dilute its authority.
- **Use a vector database or embeddings.** Rejected at current scale.
  PostgreSQL + deterministic literal substring matching against named,
  auditable fields is sufficient, transparent, and avoids introducing an
  embedding service, an opaque search infrastructure, or LLM retrieval.
  The plan reserves evaluation of vector search if the working set later
  exceeds the linear-scan budget.
- **Auto-store every message or chain-of-thought thought.** Rejected:
  Memory must be Q-inclusive of durable context and X-exclusive of
  noise; broad capture would defeat the purpose.
- **Background summarizer tasks / autonomous transcript storage.** Rejected:
  introduces unawaited writes, contention, AI speculation, and ungrounded
  memory entries. Memory writes are deliberate, awaited, source-stamped.
- **Embeddings-based recall.** Rejected: replaces transparent literal
  scoring with an opaque similarity score; harder to audit; hard to keep
  deterministic (model drift).
- **Make memory hard-deletable.** Rejected: competing duplicates, audit
  trails, and supersession history all rely on retained historical rows.

## Consequences

- A new domain model `CampaignMemory` with two enums and one
  database-constraint migration has been added.
- The generic tag/relation CHECK allowlist was widened from seven to eight
  entity types (canonical names retained).
- A `MCP-memory-rule` block is appended to the MCP server instructions in
  the shared handler, teaching every connected client how to use memory
  responsibly.
- A new human `/admin/memory` back-office is added, including list with
  filters, create with controlled-state forms, detail with edit/super­sede/
  archive forms, optimistic-concurrency recovery, and memory-specific
  Activity section.
- Eight MCP tools are added: `campaign_remember`,
  `campaign_update_memory`, `campaign_supersede_memory`,
  `campaign_archive_memory`, `campaign_get_memory`,
  `campaign_list_memories`, `campaign_recall`, `campaign_get_context`.
- `lib/campaign` adds the schema, hashing, relevance, query, service, and
  context modules that underpin the feature. Existing service boundaries
  remain unchanged: Admin/MCP → shared server-only `lib/campaign` services
  → Prisma/PostgreSQL.
- Future changes must:
  - keep memory distinct from Canon;
  - preserve deterministic scoring and unique partial index enforcement;
  - never introduce an autonomous summarizer / embedding pipeline without
    a separate ADR;
  - never hard-delete memory through MCP or Admin.

## Implementation references

- Schema: `prisma/schema.prisma` (added `MemoryCategory`, `MemoryStatus`,
  `MemorySourceType` enums, extended `EntityType`, added `CampaignMemory`).
- Migrations: `prisma/migrations/20260910100000_campaign_memory_entity_type`
  and `prisma/migrations/20260910100100_campaign_memory`.
- Domain services: `lib/campaign/memory-schemas.ts`, `memory-hash.ts`,
  `memory-relevance.ts`, `memory-query.ts`, `memory-access.ts`,
  `memories.ts`, `tag-link-tx.ts`, `context.ts`.
- Generic selector aliases: `lib/campaign/tag-schemas.ts`
  (`CAMPAIGN_ENTITY_TYPES`, `CampaignEntityType`, with
  `ORIGINAL_ENTITY_TYPES`, `OriginalEntityType` retained as deprecated
  aliases).
- MCP tools: `lib/mcp/campaign-tools.ts` (`campaign_remember`,
  `campaign_update_memory`, `campaign_supersede_memory`,
  `campaign_archive_memory`, `campaign_get_memory`,
  `campaign_list_memories`, `campaign_recall`, `campaign_get_context`).
- MCP instructions: `lib/mcp/handler.ts` and
  `scripts/lib/mcp-contract.mjs`.
- Admin pages: `app/admin/memory/page.tsx`, `new/page.tsx`, `[id]/page.tsx`,
  `actions.ts`, `_components/`.
- Human runbook: `docs/runbooks/mcp-usage.md`.
