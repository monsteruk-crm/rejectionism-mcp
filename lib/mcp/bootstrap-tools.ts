import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";

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
      const startedAt = performance.now();

      try {
        const rows = await getPrisma().$queryRaw<Array<{ result: number }>>`
          SELECT 1 AS result
        `;

        if (rows[0]?.result !== 1) {
          throw new Error("Unexpected database response.");
        }

        const structuredContent = {
          status: "ok" as const,
          result: 1 as const,
          latencyMs: Math.round(performance.now() - startedAt),
        };

        return {
          content: [
            {
              type: "text" as const,
              text: `Prisma database check succeeded in ${structuredContent.latencyMs}ms.`,
            },
          ],
          structuredContent,
        };
      } catch (error) {
        const message =
          error instanceof Error && error.message === "DATABASE_URL is not configured."
            ? error.message
            : "The PostgreSQL query failed. Check DATABASE_URL and the database status.";

        return {
          content: [
            {
              type: "text" as const,
              text: `Prisma database check failed: ${message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
