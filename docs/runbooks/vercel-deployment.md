# Vercel Deployment and Client Integration

This runbook describes production deployment of Rejectionism CampaignOS on Vercel and connecting remote AI clients.

## Vercel Deployment

### Requirements
- Node.js runtime: **20.19+**, **22.12+**, or **24+** (configured in project settings or `.npmrc`).
- Hosted PostgreSQL database (e.g. Neon, Supabase, AWS RDS, Prisma Postgres).

### Environment Variables
Configure these variables in Vercel Project Settings > Environment Variables:

| Variable | Description | Example |
| --- | --- | --- |
| `DATABASE_URL` | Direct PostgreSQL connection string for the `pg` driver adapter. | `postgresql://user:pass@host:5432/dbname?sslmode=require` |
| `UNAUTHENTICATED_TEST_MODE` | Set strictly to `true` to enable test mode. If omitted or `false`, the app fails closed. | `true` |

> **Security Warning**: `UNAUTHENTICATED_TEST_MODE=true` leaves the `/admin` interface and MCP write operations accessible without passwords or tokens. Do not store sensitive, personal, financial, or confidential data. Proper authentication is the next mandatory milestone.

### Build and Install Configuration
- **Build Command**: `pnpm build` (automatically executes `prisma generate --config prisma7.config.ts && next build`)
- **Install Command**: `pnpm install`
- **Output Directory**: Default Next.js (`.next`)

### Database Migrations on Vercel
Do not run migrations or seed inside every automated build. Run migrations explicitly against the target database:

```bash
# Apply pending migrations to production
pnpm db:deploy

# Populate initial canonical seed data
pnpm db:seed
```

---

## Connecting AI Clients to `/api/mcp`

The canonical MCP server endpoint is:
```
https://<your-deployment-domain>/api/mcp
```
(Local endpoint: `http://localhost:3000/api/mcp`)

### 1. OpenAI Codex / Claude Desktop / Cursor / Windsurf

In your client's MCP configuration file (e.g. `claude_desktop_config.json` or `.codex/config.toml`):

#### Streamable HTTP (Native):
```json
{
  "mcpServers": {
    "rejectionism-campaign-os": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

#### Via `mcp-remote` bridge (for stdio-only clients):
```json
{
  "mcpServers": {
    "rejectionism-campaign-os": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3000/api/mcp"]
    }
  }
}
```

### 2. ChatGPT Developer Mode (Custom Connector)
Where Streamable HTTP connectors are supported without OAuth in developer mode:
1. Open ChatGPT Developer / Custom Actions settings.
2. Add connector URL: `https://<your-domain>/api/mcp`.
3. Set Authentication: `None` (unauthenticated test mode).
4. Save and verify tool discovery.

### 3. MCP Inspector (Debugging)
To inspect tools, run schema checks, and execute calls interactively:

```bash
# Start MCP Inspector pointing at the local server
npx @modelcontextprotocol/inspector http://localhost:3000/api/mcp
```

1. Open the inspector URL in your browser.
2. Verify all 12 tools are listed (`echo`, `check_database`, plus 10 `campaign_*` tools).
3. Execute `campaign_get_status` with `{}` to verify the live operational state.
