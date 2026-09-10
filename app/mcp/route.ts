import { createAuthenticatedMcpHandler } from "@/lib/mcp/handler";

const handler = createAuthenticatedMcpHandler();

export { handler as GET, handler as POST, handler as DELETE };
