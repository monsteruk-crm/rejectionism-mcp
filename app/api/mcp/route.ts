import { createAuthenticatedMcpHandler } from "@/lib/mcp/handler";

const handler = createAuthenticatedMcpHandler({ basePath: "/api" });

export { handler as GET, handler as POST, handler as DELETE };
