# Rejectionism CampaignOS

The operational headquarters for **REJECTIONISM**, the satirical art movement built around rejection.

> **SECURITY**: `/admin` and the MCP endpoints require authentication with a single shared credential (see [ADR 0003](docs/adr/0003-single-password-boundary-authentication.md)). Configure `CAMPAIGNOS_PASSWORD` (32–256 chars) for admin login and MCP Bearer access; missing or invalid configuration fails closed.

---

## Documentation

- [Documentation Index](docs/00-index.md)
- [Current Project Status](docs/STATUS.md)
- [Project Architecture & Context](docs/PROJECT-CONTEXT.md)
- [MCP Tools Contract](docs/contracts/mcp-tools.md)
- [Local Development Runbook](docs/runbooks/local-development.md)
- [Vercel Deployment Runbook](docs/runbooks/vercel-deployment.md)
- [Architecture Decision Records (ADRs)](docs/adr/README.md)

---

## Architecture Overview

CampaignOS exposes two primary interfaces powered by the same shared server-only domain service layer (`lib/campaign/`) and PostgreSQL database:

1. **Admin Web Interface (`/admin`)**: Interactive operations dashboard and registers for Work Items, Canon, Decisions, Visual Assets, Websites, Content Pieces, and Contacts.
2. **Remote MCP Server (`/api/mcp`)**: Stateless Model Context Protocol endpoint exposing 10 campaign management tools and bootstrap diagnostic tools for AI clients.

All mutations use optimistic concurrency control (`expectedVersion`) and record an auditable `Activity` entry in the same database transaction.

---

## Environment Configuration

Configure the following variables in `.env` (or Vercel settings):

```env
# PostgreSQL connection string for Prisma pg adapter
# (named MCP_PRISMA_DATABASE_URL because Vercel reserves DATABASE_URL)
MCP_PRISMA_DATABASE_URL=postgresql://user:password@localhost:5432/campaignos

# Shared credential: admin login password and MCP Bearer token
# 32-256 characters, allowed: letters, digits, `-`, `_`
CAMPAIGNOS_PASSWORD=generate-a-long-random-credential

# Application origin used as the trusted origin for auth checks
# (optional in development, defaults to http://localhost:3000; HTTPS required in production)
CAMPAIGNOS_BASE_URL=http://localhost:3000
```

Authentication fails closed: without a valid `CAMPAIGNOS_PASSWORD`, `/admin` redirects to `/login` with a configuration notice and all MCP requests receive HTTP 401 `AUTH_REQUIRED`.

---

## Local Development Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Generate Prisma client
pnpm db:generate

# 3. Apply migrations to your local/dev database
pnpm db:migrate

# 4. Seed canonical Rejectionism data
pnpm db:seed

# 5. Start development server
pnpm dev
```

Visit:

- **Admin Dashboard**: `http://localhost:3000/admin`
- **Health Diagnostic**: `http://localhost:3000/api/health`
- **MCP Endpoint**: `http://localhost:3000/api/mcp`

---

## Connecting AI Clients (OpenAI Codex, Claude Desktop, ChatGPT)

### OpenAI Codex / Claude Desktop / Cursor (`claude_desktop_config.json`):

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

### MCP Inspector (Interactive Tool Debugging):

```bash
npx @modelcontextprotocol/inspector http://localhost:3000/api/mcp
```

### Running the Smoke Client:

```bash
pnpm test:client -- http://localhost:3000
```

---

## Roadmap

Authentication is implemented (single shared credential with stateless signed sessions, [ADR 0003](docs/adr/0003-single-password-boundary-authentication.md)). Per-user identity providers (OAuth 2.0 / CIMD) remain future work. Upcoming milestones add asset storage, Blob-backed uploads with upload links, MCP/Admin management parity, and global search.
