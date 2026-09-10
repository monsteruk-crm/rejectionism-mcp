# Project context

Rejectionism CampaignOS provides a full campaign management platform with a remote MCP server and an administrative web interface in a single Next.js 16 App Router application.

## Entry points and ownership

| Area                | Source                                                                                                       | Responsibility                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Canonical MCP       | [app/api/mcp/route.ts](../app/api/mcp/route.ts)                                                              | GET/POST/DELETE `/api/mcp`, 55 CampaignOS tools, instructions (shared handler in `lib/mcp/handler.ts`)                                    |
| Legacy MCP          | [app/mcp/route.ts](../app/mcp/route.ts)                                                                      | Backward-compatible `/mcp` endpoint                                                                                                |
| MCP Tools           | [lib/mcp/campaign-tools.ts](../lib/mcp/campaign-tools.ts)                                                    | Registration of all 55 CampaignOS MCP tools with strict Zod schemas                                                                |
| Domain Services     | [lib/campaign/](../lib/campaign/)                                                                            | Server-only domain services for WorkItems, Canon, Decisions, Assets, Revisions, Uploads, Tags, Relations, Websites, Contacts, Content, Activity, Search, Readiness, Admin Lookups, and Upload Status |
| Admin Web Interface | [app/admin/](../app/admin/)                                                                                  | React Server Components dashboard, visual asset library, internal upload sessions, contributor links, search, and entity views      |
| Public Upload View  | [app/upload/[token]/](../app/upload/)                                                                        | Capability-authorized contributor upload interface                                                                                 |
| Admin Actions       | [app/admin/actions.ts](../app/admin/actions.ts), [app/admin/assets/actions.ts](../app/admin/assets/actions.ts), [app/admin/assets/upload/actions.ts](../app/admin/assets/upload/actions.ts), [app/admin/upload-links/actions.ts](../app/admin/upload-links/actions.ts), [app/admin/entity-actions.ts](../app/admin/entity-actions.ts), [app/admin/lookup-actions.ts](../app/admin/lookup-actions.ts) | Server Actions returning typed ActionResult with form validation, error feedback, and cache revalidation |
| Health & Readiness  | [app/api/health/route.ts](../app/api/health/route.ts), [app/api/readiness/route.ts](../app/api/readiness/route.ts)           | GET `/api/health` connectivity check; GET `/api/readiness` Bearer-authenticated table & migration probe                             |
| Database runtime    | [lib/prisma.ts](../lib/prisma.ts)                                                                            | Lazy process-level Prisma client using `PrismaPg` and `MCP_PRISMA_DATABASE_URL`                                                    |
| Database schema     | [prisma/schema.prisma](../prisma/schema.prisma)                                                              | PostgreSQL schema with 16 campaign domain models, the bootstrap User model, enums, and authored SQL constraints                    |
| Migrations          | [prisma/migrations/](../prisma/migrations/)                                                                  | Versioned PostgreSQL migrations (`init`, `campaign_os`, `assets_and_upload_requests`, `entity_tags_and_relations`)                 |
| Seed System         | [prisma/seed.ts](../prisma/seed.ts), [prisma/seed-data.ts](../prisma/seed-data.ts)                           | Idempotent deterministic seed fixtures (does not overwrite existing assets)                                                        |
| Backfill System     | [lib/campaign/asset-backfill.ts](../lib/campaign/asset-backfill.ts), [scripts/backfill-assets.ts](../scripts/backfill-assets.ts) | Idempotent legacy URL to primary representation backfill                                                                           |
| Test Client         | [scripts/test-client.mjs](../scripts/test-client.mjs)                                                        | Protocol smoke client testing `/api/mcp` and `/mcp` across all 55 tools                                                            |
| Integration Harness | [scripts/test-integration.mjs](../scripts/test-integration.mjs), [tests/integration/](../tests/integration/) | Applies migrations, backfill, and seed data to `TEST_MCP_PRISMA_DATABASE_URL`, then runs integration test suites                  |

## Data & Mutation Flow

1. **Web Admin**: Browser form submit → Server Action (`app/admin/actions.ts`) → Shared Service (`lib/campaign/`) → Prisma Interactive Transaction (`Entity updateMany({ where: { id, version } })` + `Activity.create`) → Page Revalidation (`revalidatePath`).
- **MCP Client**: MCP Request → Route Handler (`app/api/mcp/route.ts`) → Tool Adapter (`lib/mcp/campaign-tools.ts`) → Shared Service (`lib/campaign/`) → Prisma Interactive Transaction → MCP Response Helper (`toMcpToolResult`) → Structured JSON Content. CampaignMemory tools additionally post a best-effort access telemetry write (`accessCount`/`lastAccessedAt`) after the read transaction completes; `campaign_get_context` is strictly read-only.

Both channels share the exact same validation, concurrency checks, and transactional audit logging.

Admin list routes pass URL filters through the shared strict schemas and render service validation or availability failures explicitly. Admin detail routes reserve 404 responses for `NOT_FOUND`; other service errors render an operational error state.

3. **CampaignMemory** (ADR 0007): Both Admin Server Actions (`app/admin/memory/actions.ts`) and MCP memory tools share the same Pre-Advisory / Read-Only Decision orders (Canon wins over Memory). Backend services live in `lib/campaign/memory-schemas.ts`, `memory-hash.ts`, `memory-relevance.ts`, `memory-query.ts`, `memory-access.ts`, `memories.ts`, `tag-link-tx.ts`, and `context.ts`. Subscribe to the partial-unique index `CampaignMemory_active_content_hash_key` for immutable deduplication at the database boundary.

See the [MCP tools contract](contracts/mcp-tools.md), [local development runbook](runbooks/local-development.md), [MCP usage runbook](runbooks/mcp-usage.md), and [ADRs](adr/README.md).
