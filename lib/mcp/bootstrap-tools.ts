import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { pingDatabase } from "@/lib/campaign/health";

export function registerBootstrapTools(server: McpServer) {
  server.registerTool(
    "echo",
    {
      title: "Echo",
      description: "Echo a message back to verify MCP connectivity.",
      inputSchema: z
        .object({
          message: z.string().min(1).max(100).describe("Message to echo back"),
        })
        .strict(),
      outputSchema: z
        .object({
          message: z.string().describe("Echoed message"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ message }) => ({
      content: [{ type: "text" as const, text: `Tool echo: ${message}` }],
      structuredContent: { message },
    }),
  );

  server.registerTool(
    "check_database",
    {
      title: "Check database",
      description: "Run a read-only query through Prisma to verify PostgreSQL connectivity.",
      inputSchema: z.object({}).strict(),
      outputSchema: z
        .object({
          status: z.literal("ok"),
          result: z.literal(1),
          latencyMs: z.number().int().nonnegative(),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      const result = await pingDatabase();

      if (!result.ok) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Prisma database check failed. The PostgreSQL query did not succeed; check MCP_PRISMA_DATABASE_URL and the database status.",
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Prisma database check succeeded in ${result.latencyMs}ms.`,
          },
        ],
        structuredContent: {
          status: "ok" as const,
          result: 1 as const,
          latencyMs: result.latencyMs,
        },
      };
    },
  );
}
