# Rejectionism CampaignOS

The operational headquarters for **REJECTIONISM**, the satirical art movement built around rejection.

> **SECURITY**: `/admin` and the MCP endpoints require authentication with a single shared credential (see [ADR 0003](docs/adr/0003-single-password-boundary-authentication.md)). Configure `CAMPAIGNOS_PASSWORD` (32–256 chars) for admin login and MCP Bearer access; missing or invalid configuration fails closed.

---

## Documentation

- [Documentation Index](docs/00-index.md)
- [Current Project Status](docs/STATUS.md)
- [Project Architecture & Context](docs/PROJECT-CONTEXT.md)
- [MCP Tools Contract (47 Tools)](docs/contracts/mcp-tools.md)
- [Assets and Uploads Contract](docs/contracts/assets-and-uploads.md)
- [Asset Storage & Blob Runbook](docs/runbooks/asset-storage.md)
- [Backup and Disaster Recovery Runbook](docs/runbooks/backup-restore.md)
- [Local Development Runbook](docs/runbooks/local-development.md)
- [Manual Acceptance Scenarios](docs/runbooks/manual-acceptance.md)
- [Vercel Deployment Runbook](docs/runbooks/vercel-deployment.md)
- [Architecture Decision Records (ADRs)](docs/adr/README.md)

---

## Architecture Overview

CampaignOS exposes two primary interfaces powered by the same shared server-only domain service layer (`lib/campaign/`) and PostgreSQL database:

1. **Admin Web Interface (`/admin`)**:
   - Operations Command Dashboard (Now, Next, Blocked, Missing Assets, Websites, Decisions, Activity feed).
   - Filterable Visual Asset Library (`/admin/assets`) with raster previews, format placeholders, and storage badges.
   - Asset Revisions & Representations management (`/admin/assets/[id]`) with primary representation switcher and external URL appends.
   - Single-use capability Upload Links management (`/admin/upload-links`) with one-time raw link display and regeneration.
   - Admin Bulk Ingestion (`/admin/assets/upload`) with grouping mode selection and direct multi-row Blob uploads.
   - Global Search (`/admin/search`) across all 7 registers and polymorphic tag associations.
   - Management screens for Work Items, Canon, Decisions, Websites, Content Pieces, and Contacts.

2. **Remote MCP Server (`/api/mcp` and legacy `/mcp`)**:
   - Stateless Model Context Protocol endpoint exposing 47 tools across all registers, diagnostics, uploads, relationships, tags, and search.

3. **Public Upload Portal (`/upload/[token]`)**:
   - Capability-authorized, unauthenticated contributor submission page with real-time Blob uploads, server-side format/dimension verification, and atomic finalization.

---

## Environment Configuration

Configure the following five environment variables:

```env
# PostgreSQL connection string for Prisma pg adapter
MCP_PRISMA_DATABASE_URL=postgresql://user:password@localhost:5432/campaignos

# Disposable PostgreSQL database URL for integration tests (must differ from operational URL)
TEST_MCP_PRISMA_DATABASE_URL=postgresql://user:password@localhost:5432/campaignos_test

# Shared credential: admin login password and MCP Bearer token (32-256 characters)
CAMPAIGNOS_PASSWORD=generate-a-long-random-credential

# Server-only private Vercel Blob read/write token
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxx

# Application origin used for auth and capability URL construction (HTTPS in production)
CAMPAIGNOS_BASE_URL=http://localhost:3000
```

---

## Local Development Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Generate Prisma client
pnpm db:generate

# 3. Apply migrations to your database
pnpm db:deploy

# 4. Backfill legacy asset representations (idempotent)
pnpm db:backfill-assets

# 5. Seed canonical Rejectionism data
pnpm db:seed

# 6. Start development server
pnpm dev
```

Visit:
- **Admin Dashboard**: `http://localhost:3000/admin`
- **Global Search**: `http://localhost:3000/admin/search`
- **Asset Library**: `http://localhost:3000/admin/assets`
- **Upload Links**: `http://localhost:3000/admin/upload-links`
- **Health Diagnostic**: `http://localhost:3000/api/health`
- **MCP Endpoint**: `http://localhost:3000/api/mcp`

---

## Connecting AI Clients (OpenAI Codex, Claude Desktop, Cursor)

MCP requests require `Authorization: Bearer <CAMPAIGNOS_PASSWORD>`.

```json
{
  "mcpServers": {
    "rejectionism-campaign-os": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer <CAMPAIGNOS_PASSWORD>"
      }
    }
  }
}
```

### Running Test and Verification Suites:

```bash
# Run unit tests
pnpm test

# Run MCP protocol suite
pnpm test:mcp --origin=http://localhost:3000

# Run functional release verification gate
pnpm verify:functional --origin=http://localhost:3000

# Run smoke client
pnpm test:client -- http://localhost:3000
```
