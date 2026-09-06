# MCP Tools Contract

Canonical Endpoint: `/api/mcp` (Streamable HTTP, `basePath: "/api"`)  
Legacy Endpoint: `/mcp`

All tool arguments use strict Zod validation. Unknown fields are rejected.

---

## Complete Tool Inventory (47 Tools)

### Diagnostics (2 Tools)
1. **`echo`**: Echo message back (`{ message: string(1..100) }`). Read-only `(true, true, false, false)`.
2. **`check_database`**: Diagnostic query verifying PostgreSQL connectivity (`{}`). Read-only `(true, true, false, true)`.

### Operational Status & Activity (2 Tools)
3. **`campaign_get_status`**: Operational overview (status counts, in-progress, blocked, top 3 next, missing assets, websites, decisions, activity). Read-only `(true, true, false, true)`.
4. **`campaign_activity_feed`**: Auditable event log (`{ entityType?, entityId?, limit? }`). Read-only `(true, true, false, true)`.

### Work Items (4 Tools)
5. **`campaign_list_work_items`**: List/filter work items by status, minPriority, dueBefore, search. Read-only `(true, true, false, true)`.
6. **`campaign_get_work_item`**: Retrieve complete work item details (`{ id }`). Read-only `(true, true, false, true)`.
7. **`campaign_create_work_item`**: Create a new work item. Moving to or creating in `DONE` status requires `evidenceUrl` or `completionNote`. `BLOCKED` requires `blockedReason`. Write `(false, false, false, true)`.
8. **`campaign_update_work_item`**: Update work item with optimistic concurrency (`{ id, expectedVersion, changes, completionNote? }`). Write `(false, false, false, true)`.

### Canon Entries (3 Tools)
9. **`campaign_get_canon`**: Query by unique key, category, or list all (`{ key?, category?, limit?, offset? }`). Read-only `(true, true, false, true)`.
10. **`campaign_create_canon`**: Create a new canon fact, slogan, or role (`{ key, value, category, notes? }`). Write `(false, false, false, true)`.
11. **`campaign_update_canon`**: Update value, category, notes with optimistic concurrency (`{ id, expectedVersion, changes }`). Key is immutable. Write `(false, false, false, true)`.

### Decisions (3 Tools)
12. **`campaign_list_decisions`**: List decisions with supersession lineage (`{ limit?, offset? }`). Read-only `(true, true, false, true)`.
13. **`campaign_get_decision`**: Retrieve decision record by ID (`{ id }`). Read-only `(true, true, false, true)`.
14. **`campaign_record_decision`**: Record decision with optional supersession and atomic canon create/update (`{ subject, decision, rationale, supersedesId?, decidedAt?, updateCanon? }`). Write `(false, false, false, true)`.

### Visual Assets & Revisions (9 Tools)
15. **`campaign_list_assets`**: Filter assets by status, kind, search substring, storageType (`BLOB` / `EXTERNAL_URL`), or tags. Read-only `(true, true, false, true)`.
16. **`campaign_get_asset`**: Full conceptual asset details, all revisions, representations, tags, and relations (`{ id }`). Read-only `(true, true, false, true)`.
17. **`campaign_create_asset`**: Register conceptual asset metadata with empty revision 1 (`{ name, kind, status?, notes? }`). Write `(false, false, false, true)`.
18. **`campaign_update_asset`**: Update asset metadata or status with optimistic concurrency (`{ id, expectedVersion, changes }`). Write `(false, false, false, true)`.
19. **`campaign_add_external_asset`**: Create asset, revision 1, and primary external URL representation in one transaction (`{ asset, representation }`). Write `(false, false, false, true)`.
20. **`campaign_create_asset_revision`**: Create next sequential revision using CAS (`{ assetId, expectedVersion, label?, notes? }`). Write `(false, false, false, true)`.
21. **`campaign_add_asset_representation`**: Append external URL representation to revision (`{ assetRevisionId, expectedVersion, representation }`). Write `(false, false, false, true)`.
22. **`campaign_set_primary_asset_representation`**: Switch primary representation within revision using CAS (`{ representationId, expectedVersion }`). Write `(false, false, false, true)`.
23. **`campaign_register_asset`**: Legacy compatibility registration / update tool. Write `(false, false, false, true)`.

### Upload Links & Capability Ingestion (5 Tools)
24. **`campaign_create_upload_link`**: Create single-submission upload request returning raw URL once (`{ title, instructions?, expiresInDays?, maxItems?, targetAssetId?, targetRevisionId? }`). Write `(false, false, false, true)`.
25. **`campaign_list_upload_links`**: List upload links by effective status (`OPEN`, `SUBMITTED`, `REVOKED`, `EXPIRED`) or target (`{ status?, targetAssetId?, limit?, offset? }`). Read-only `(true, true, false, true)`.
26. **`campaign_get_upload_link`**: Retrieve upload link details and reserved/uploaded files (`{ id }`). Read-only `(true, true, false, true)`.
27. **`campaign_revoke_upload_link`**: Revoke open upload request (`{ id }`). Write `(false, true, true, true)`.
28. **`campaign_regenerate_upload_link`**: Replace open upload request with fresh token and target snapshot (`{ id, expiresInDays? }`). Write `(false, false, true, true)`.

### Websites & Domains (4 Tools)
29. **`campaign_list_websites`**: List all registered domains, purposes, status, and URLs (`{ limit?, offset? }`). Read-only `(true, true, false, true)`.
30. **`campaign_get_website`**: Retrieve website details (`{ id }`). Read-only `(true, true, false, true)`.
31. **`campaign_create_website`**: Register new website domain (`{ name, domain, purpose, status?, repositoryUrl?, deploymentUrl?, notes? }`). Write `(false, false, false, true)`.
32. **`campaign_update_website`**: Update website with optimistic concurrency (`{ id, expectedVersion, changes }`). Domain is immutable. Write `(false, false, false, true)`.

### Content Items (4 Tools)
33. **`campaign_list_content`**: List scheduled or published content (`{ status?, limit?, offset? }`). Read-only `(true, true, false, true)`.
34. **`campaign_get_content`**: Retrieve content item by ID (`{ id }`). Read-only `(true, true, false, true)`.
35. **`campaign_create_content`**: Create content item (`{ title, format, channel, status?, scheduledFor?, publishedUrl?, notes? }`). Write `(false, false, false, true)`.
36. **`campaign_update_content`**: Update content item with optimistic concurrency (`{ id, expectedVersion, changes }`). Write `(false, false, false, true)`.

### Contacts & Privacy Projections (4 Tools)
37. **`campaign_list_contacts`**: List contacts. Summary by default; `includePrivateFields: true` includes email and notes (`{ includePrivateFields?, limit?, offset? }`). Read-only `(true, true, false, true)`.
38. **`campaign_get_contact`**: Retrieve contact. Summary by default (`{ id, includePrivateFields? }`). Read-only `(true, true, false, true)`.
39. **`campaign_create_contact`**: Register contact. Returns summary projection (`{ name, organization?, role?, email?, status?, notes? }`). Write `(false, false, false, true)`.
40. **`campaign_update_contact`**: Update contact with optimistic concurrency (`{ id, expectedVersion, changes }`). Returns summary projection. Write `(false, false, false, true)`.

### Generic Tags & Directed Relationships (6 Tools)
41. **`campaign_list_tags`**: List normalized tag definitions (`{ search?, limit?, offset? }`). Read-only `(true, true, false, true)`.
42. **`campaign_tag_entity`**: Attach tag to any entity (`{ entityType, entityId, tag }`). Normalizes to slug. Idempotent. Write `(false, true, false, true)`.
43. **`campaign_untag_entity`**: Detach tag from entity (`{ entityType, entityId, tagSlug }`). Idempotent. Write `(false, true, true, true)`.
44. **`campaign_get_relationships`**: Read incoming, outgoing, or combined relationships (`{ entityType, entityId, direction?, relationType?, limit?, offset? }`). Read-only `(true, true, false, true)`.
45. **`campaign_link_entities`**: Create directed relationship between two entities (`{ from, to, relationType, notes? }`). Idempotent for identical edges; notes are immutable. Write `(false, true, false, true)`.
46. **`campaign_unlink_entities`**: Remove relationship (`{ relationId }`). Idempotent. Write `(false, true, true, true)`.

### Global Search (1 Tool)
47. **`campaign_search`**: Search across all 7 registers and tag associations (`{ query, entityTypes?, tags?, limit?, offset? }`). Read-only `(true, true, false, true)`.

---

## Standard Error Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "[ERROR_CODE] Error description message"
    }
  ],
  "isError": true
}
```

Error Codes: `VALIDATION_ERROR`, `NOT_FOUND`, `VERSION_CONFLICT`, `ALREADY_EXISTS`, `DATABASE_UNAVAILABLE`, `INTERNAL_ERROR`, `UPLOAD_EXPIRED`, `UPLOAD_REVOKED`, `UPLOAD_ALREADY_SUBMITTED`, `UPLOAD_NOT_READY`, `UPLOAD_LIMIT_EXCEEDED`, `UPLOAD_FILE_REJECTED`, `STORAGE_UNAVAILABLE`, `AUTH_NOT_CONFIGURED`, `CONFIGURATION_ERROR`.

Transport authentication: Requests to `/api/mcp` and `/mcp` require `Authorization: Bearer <CAMPAIGNOS_PASSWORD>`.

- **Description**: Get high-level operational status overview (counts, in-progress, blocked, top 3 NEXT items, missing assets, website summary, recent decisions, latest activity).
- **Input**: `{}` (strict empty object)
- **Annotations**: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`

---

## 2. `campaign_list_work_items`

- **Description**: List and filter work items.
- **Input**:
  - `status` (optional): `"BACKLOG" | "NEXT" | "IN_PROGRESS" | "BLOCKED" | "DONE"`
  - `minPriority` (optional): `0 - 100`
  - `dueBefore` (optional): ISO date string
  - `search` (optional): string (searches title/description, max 200 chars)
  - `limit` (optional): `1 - 100` (default 50)
  - `offset` (optional): `0 - 10000` (default 0)
- **Annotations**: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`

---

## 3. `campaign_create_work_item`

- **Description**: Create a new work item. Moving to or creating in `DONE` status requires `evidenceUrl` or `completionNote`. `BLOCKED` requires `blockedReason`.
- **Input**:
  - `title` (required): string (1–200 chars)
  - `description` (optional): string (max 20,000 chars)
  - `status` (optional): `"BACKLOG" | "NEXT" | "IN_PROGRESS" | "BLOCKED" | "DONE"` (default `BACKLOG`)
  - `priority` (optional): `0 - 100` (default 0)
  - `dueDate` (optional): ISO date string
  - `blockedReason` (optional): string
  - `evidenceUrl` (optional): absolute HTTP/HTTPS URL
  - `completionNote` (optional): string
- **Annotations**: `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: true`

---

## 4. `campaign_update_work_item`

- **Description**: Update an existing work item with optimistic concurrency.
- **Input**:
  - `id` (required): string
  - `expectedVersion` (required): positive integer
  - `changes` (required): object containing fields to update (`title`, `description`, `status`, `priority`, `dueDate`, `blockedReason`, `evidenceUrl`, `completionNote`)
  - `completionNote` (optional): top-level convenience completion note
- **Annotations**: `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: true`

---

## 5. `campaign_get_canon`

- **Description**: Query canon entries by unique key, by category, or list all.
- **Input**:
  - `key` (optional): string (e.g. `movement.name`)
  - `category` (optional): string (e.g. `identity`, `founders`, `papal`)
  - `limit` (optional): `1 - 100` (default 50)
  - `offset` (optional): `0 - 10000` (default 0)
- **Annotations**: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`

---

## 6. `campaign_record_decision`

- **Description**: Record an authoritative decision with optional supersession and optional atomic canon create/update.
- **Input**:
  - `subject` (required): string (1–200 chars)
  - `decision` (required): string (1–20,000 chars)
  - `rationale` (required): string (1–20,000 chars)
  - `supersedesId` (optional): string (ID of decision being superseded)
  - `decidedAt` (optional): ISO date string
  - `updateCanon` (optional): discriminated union:
    - `{ mode: "create", key, value, category, notes? }`
    - `{ mode: "update", key, value, expectedVersion, category?, notes? }`
- **Annotations**: `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: true`

---

## 7. `campaign_list_assets`

- **Description**: List registered visual assets, optionally filtering by workflow status, kind, or tag slugs. When tags are supplied, an asset must have every requested slug; an unknown slug returns no matches.
- **Input**:
  - `status` (optional): `"MISSING" | "DRAFT" | "NEEDS_WORK" | "APPROVED" | "SUPERSEDED"`
  - `kind` (optional): string (e.g. `logo`, `banner`, `poster`, `artwork`)
  - `tags` (optional): array of `1 - 10` normalized tag slugs; all requested slugs must match, and an unknown slug returns an empty result
  - `limit` (optional): `1 - 100` (default 50)
  - `offset` (optional): `0 - 10000` (default 0)
- **Annotations**: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`

---

## 8. `campaign_register_asset`

- **Description**: Register new asset metadata or update existing asset with optimistic concurrency.
- **Input**: Discriminated union on `action`:
  - `{ action: "create", name, kind, status?, sourceFilename?, url?, notes? }`
  - `{ action: "update", id, expectedVersion, changes: { name?, kind?, status?, sourceFilename?, url?, notes? } }`
- **Annotations**: `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: true`

---

## 9. `campaign_list_websites`

- **Description**: List all registered campaign domains, purposes, and known statuses.
- **Input**:
  - `limit` (optional): `1 - 100` (default 50)
  - `offset` (optional): `0 - 10000` (default 0)
- **Annotations**: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`

---

## 10. `campaign_activity_feed`

- **Description**: Get recent audit activity entries across all entity types.
- **Input**:
  - `entityType` (optional): `"WORK_ITEM" | "CANON_ENTRY" | "DECISION" | "ASSET" | "WEBSITE" | "CONTACT" | "CONTENT_ITEM"`
  - `limit` (optional): `1 - 100` (default 20)
- **Annotations**: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`

---

## Bootstrap Diagnostic Tools

- `echo`: Echoes message back (`{ message: string }`). Read-only, closed-world.
- `check_database`: Runs `SELECT 1 AS result` through Prisma. Read-only, open-world.

Successful tools return at least one text content item plus `structuredContent` matching the registered output schema. The release smoke client treats missing or malformed structured content and any `isError` result from `check_database`, `campaign_get_status`, `campaign_list_work_items`, or `campaign_get_canon` as a failed check.

Smoke writes are opt-in with both `--test-writes` and `--disposable-database`. They create a uniquely identified work item and must never target persistent operational data.

---

## Standard Error Response Format

When any tool operation encounters a domain failure or gate block:

```json
{
  "content": [
    {
      "type": "text",
      "text": "[ERROR_CODE] Error description message"
    }
  ],
  "isError": true
}
```

Error Codes: `VALIDATION_ERROR`, `NOT_FOUND`, `VERSION_CONFLICT`, `ALREADY_EXISTS`, `DATABASE_UNAVAILABLE`, `INTERNAL_ERROR`.

Transport authentication (ADR 0003): requests to `/api/mcp` and `/mcp` must carry `Authorization: Bearer <CAMPAIGNOS_PASSWORD>`; failures return HTTP 401 with a JSON body whose error code is `AUTH_REQUIRED`.
