# MCP tools contract

Endpoint: `/mcp`, exported for GET and POST by [route.ts](../../app/mcp/route.ts). Use an MCP Streamable HTTP client; an ordinary page fetch does not exercise a tool.

## `echo`

Input: strict object `{ "message": "hello" }`; message is required and must contain 1–100 characters. Extra properties are rejected.

Success structured content: `{ "message": "hello" }`, with accompanying text `Tool echo: hello`.

Annotations: read-only, non-destructive, idempotent, closed-world.

## `check_database`

Input: strict empty object `{}`. No SQL, database URL, or table name is accepted.

Runs the fixed query `SELECT 1 AS result` through Prisma. Success includes text and structured content:

```json
{ "status": "ok", "result": 1, "latencyMs": 912 }
```

`latencyMs` is a nonnegative integer measured around client acquisition/query execution; it is variable, not an acceptance threshold.

Failure returns `isError: true` and sanitized text. Missing configuration identifies `DATABASE_URL` by name; other errors advise checking the connection and database status. Failure does not supply the success structured content or raw database error.

Annotations: read-only, non-destructive, idempotent, open-world (external database). The tool does not read/write user records or verify migrations and table permissions.

The [smoke client](../../scripts/test-client.mjs) lists tools, calls both, and exits unsuccessfully when the database call returns `isError`. Inspect the returned structured content as well as the process result; the script is a smoke check, not exhaustive schema or error-path coverage.
