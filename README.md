# Example Next.js MCP Server

Project documentation: [index](docs/00-index.md), [current status](docs/STATUS.md), and [agent rules](AGENTS.md).

This template uses [`mcp-handler` 2](https://www.npmjs.com/package/mcp-handler) and the MCP TypeScript SDK v2 to add a stateless MCP server to a Next.js App Router application.

## Usage

Update `app/mcp/route.ts` with your tools, prompts, and resources following the [MCP TypeScript SDK v2 documentation](https://ts.sdk.modelcontextprotocol.io/v2/).

Start the application and connect an MCP client to:

```
http://localhost:3000/mcp
```

## Protocol support

- The current 2026-07-28 MCP protocol is served natively.
- Stateless clients using 2025-era Streamable HTTP are supported by the compatibility layer.
- The deprecated HTTP+SSE transport is not supported. Redis is not required.

## Notes for running on Vercel

- Use a Prisma-compatible Node.js release: 20.19+, 22.12+, or 24+.
- Make sure you have [Fluid compute](https://vercel.com/docs/functions/fluid-compute) enabled for efficient execution
- [Deploy the Next.js MCP template](https://vercel.com/templates/next.js/model-context-protocol-mcp-with-next-js)

## Sample Client

`scripts/test-client.mjs` connects over Streamable HTTP, lists the available tools, calls `echo`, and runs the read-only `check_database` Prisma connectivity query.

```sh
pnpm test:client -- https://rejectionism-mcp.vercel.app
```

## Database configuration

Set `DATABASE_URL` privately to the PostgreSQL connection string for the intended environment. Prisma runtime and CLI both use this variable; never commit its value. See [local development](docs/runbooks/local-development.md) for environment loading, client generation, and verification, and the [MCP contract](docs/contracts/mcp-tools.md) for diagnostic behaviour.
