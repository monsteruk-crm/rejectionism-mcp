import { NextRequest, NextResponse } from "next/server";
import { createMcpHandler } from "mcp-handler";
import { authenticateMcpRequest } from "@/lib/auth/boundaries";
import { registerBootstrapTools } from "@/lib/mcp/bootstrap-tools";
import { registerCampaignTools } from "@/lib/mcp/campaign-tools";

const handler = createMcpHandler(
  (server) => {
    registerBootstrapTools(server);
    registerCampaignTools(server);
  },
  {
    serverInfo: {
      name: "rejectionism-mcp",
      version: "1.0.0",
    },
  },
  {
    disableSse: true,
  },
);

async function authenticatedHandler(req: NextRequest): Promise<NextResponse | Response> {
  const auth = await authenticateMcpRequest(req);
  if (!auth.ok) {
    return auth.response;
  }
  return handler(req);
}

export { authenticatedHandler as GET, authenticatedHandler as POST, authenticatedHandler as DELETE };
