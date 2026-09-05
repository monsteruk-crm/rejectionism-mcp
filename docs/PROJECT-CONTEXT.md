# Project context

Rejectionism CampaignOS provides a full campaign management platform with a remote MCP server and an administrative web interface in a single Next.js 16 App Router application.

## Entry points and ownership

| Area | Source | Responsibility |
| --- | --- | --- |
| Canonical MCP | [app/api/mcp/route.ts](../app/api/mcp/route.ts) | GET/POST/DELETE `/api/mcp`, 10 CampaignOS tools, 2 bootstrap tools, instructions |
| Legacy MCP | [app/mcp/route.ts](../app/mcp/route.ts) | Backward-compatible `/mcp` endpoint |
| MCP Tools | [lib/mcp/campaign-tools.ts](../lib/mcp/campaign-tools.ts) | Registration of all 10 CampaignOS MCP tools with strict Zod schemas |
| Domain Services | [lib/campaign/](../lib/campaign/) | Server-only domain services for WorkItems, Canon, Decisions, Assets, Websites, Contacts, Content, Activity, Status |
| Admin Web Interface | [app/admin/](../app/admin/) | React Server Components dashboard, entity views, and Server Actions |
| Admin Actions | [app/admin/actions.ts](../app/admin/actions.ts) | Server Actions for all admin form mutations with cache revalidation |
| Health Check | [app/api/health/route.ts](../app/api/health/route.ts) | GET `/api/health` connectivity and status diagnostic |
| Database runtime | [lib/prisma.ts](../lib/prisma.ts) | Lazy process-level Prisma client using `PrismaPg` and `DATABASE_URL` |
| Database schema | [prisma/schema.prisma](../prisma/schema.prisma) | PostgreSQL schema with 8 domain models, enums, and indexes |
| Migrations | [prisma/migrations/](../prisma/migrations/) | Versioned PostgreSQL migrations (`init`, `campaign_os`) |
| Seed System | [prisma/seed.ts](../prisma/seed.ts), [prisma/seed-data.ts](../prisma/seed-data.ts) | Idempotent deterministic seed fixtures from canonical HQ documentation |
| Test Client | [scripts/test-client.mjs](../scripts/test-client.mjs) | Protocol smoke client testing `/api/mcp` and `/mcp` |

## Data & Mutation Flow

1. **Web Admin**: Browser form submit → Server Action (`app/admin/actions.ts`) → Shared Service (`lib/campaign/`) → Prisma Interactive Transaction (`Entity updateMany({ where: { id, version } })` + `Activity.create`) → Page Revalidation (`revalidatePath`).
2. **MCP Client**: MCP Request → Route Handler (`app/api/mcp/route.ts`) → Tool Adapter (`lib/mcp/campaign-tools.ts`) → Shared Service (`lib/campaign/`) → Prisma Interactive Transaction → MCP Response Helper (`toMcpToolResult`) → Structured JSON Content.

Both channels share the exact same validation, concurrency checks, and transactional audit logging.

See the [MCP tools contract](contracts/mcp-tools.md), [local development runbook](runbooks/local-development.md), and [ADRs](adr/README.md).
