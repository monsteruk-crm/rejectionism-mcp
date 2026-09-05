# Rejectionism CampaignOS

The operational headquarters for **REJECTIONISM**, the satirical art movement built around rejection.

> **SECURITY WARNING**: `UNAUTHENTICATED_TEST_MODE=true`  
> **UNAUTHENTICATED TEST SYSTEM — DO NOT STORE PRIVATE OR SENSITIVE DATA**  
> This test version intentionally has no authentication. Never store passwords, tokens, bank details, or sensitive personal data. Proper authentication and authorization is the first post-MVP milestone.

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
DATABASE_URL=postgresql://user:password@localhost:5432/campaignos

# Temporary unauthenticated test mode (must be exactly "true" to enable operations)
UNAUTHENTICATED_TEST_MODE=true
```

When `UNAUTHENTICATED_TEST_MODE` is not `"true"`, the application fails closed: `/admin` shows a disabled notice and all MCP tool writes return a `TEST_MODE_DISABLED` error.

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
```json
{
  "mcpServers": {
    "rejectionism-campaign-os": {
      "url": "http://localhost:3000/api/mcp"
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

## Next Mandatory Milestone

The first post-MVP milestone is implementing proper authentication and authorization (e.g. OAuth 2.0 / CIMD / session auth) to replace the temporary unauthenticated test mode.
