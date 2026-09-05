# MCP Tools Contract

Canonical Endpoint: `/api/mcp` (Streamable HTTP, `basePath: "/api"`)  
Legacy Endpoint: `/mcp`

All tool arguments use strict Zod validation. Unknown fields are rejected.

---

## 1. `campaign_get_status`
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
- **Description**: List registered visual assets.
- **Input**:
  - `status` (optional): `"MISSING" | "DRAFT" | "NEEDS_WORK" | "APPROVED" | "SUPERSEDED"`
  - `kind` (optional): string (e.g. `logo`, `banner`, `poster`, `artwork`)
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

Error Codes: `VALIDATION_ERROR`, `NOT_FOUND`, `VERSION_CONFLICT`, `TEST_MODE_DISABLED`, `ALREADY_EXISTS`, `DATABASE_UNAVAILABLE`, `INTERNAL_ERROR`.
