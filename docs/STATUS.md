# Current status

Updated: 2026-09-05.

## Capability

- **Rejectionism CampaignOS MVP**: Full shared domain service layer (`lib/campaign/`) backing both the `/admin` web interface and the `/api/mcp` remote MCP server.
- **MCP Server Endpoints**:
  - `/api/mcp` (canonical): Serves 10 `campaign_*` tools and 2 bootstrap tools (`echo`, `check_database`) over Streamable HTTP with global system instructions.
  - `/mcp` (legacy compatibility): Serves bootstrap and campaign tools.
- **Admin Interface (`/admin`)**:
  - Live Dashboard showing status counters, Now, Next, Blocked, Missing assets, Website statuses, Recent decisions, and Activity feed.
  - Full management screens for Work Items, Canon, Decisions, Assets, Websites, Content, and Contacts.
- **Database Architecture**:
  - Prisma 7 schema and authored migration (`20260905144500_campaign_os`) with 8 domain models, enums, indexes, and relations.
  - Idempotent seed script (`prisma/seed.ts`, `pnpm db:seed`) seeding 13 canon entries, 4 websites, 10 ordered work items, and 29 visual assets.
  - Integer-based optimistic concurrency (`version`) and transactional audit logging on all mutations.
- **Security & Test Mode**:
  - Governed by `UNAUTHENTICATED_TEST_MODE=true` with fail-closed behavior across services, actions, and MCP handlers.
  - Health endpoint (`GET /api/health`) verifying database connectivity.

## Verification Evidence

- **Unit Test Suite (`tests/unit/`)**: Unit tests verify strict Zod validation schemas, test-mode gate logic, and MCP tool response formatting without requiring a live database.
- **Tooling & Build**: Next 16.3.4, React 19.2.8, Tailwind CSS v4.3.3, Prisma 7.10.0 client generation, Vitest 5.0.0, and Prettier 3.9.6 configured.
- **Smoke Client (`scripts/test-client.mjs`)**: Updated to verify all 12 tools across `/api/mcp` and assert tool contracts cleanly.

## Next Work and Mandatory Milestone

- Implement authentication and authorization (e.g. OAuth / CIMD / session auth) to replace the temporary unauthenticated test mode.
- Connect production PostgreSQL database on Vercel and run `pnpm db:deploy` and `pnpm db:seed`.
