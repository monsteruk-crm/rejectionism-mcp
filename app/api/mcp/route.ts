import { NextRequest, NextResponse } from "next/server";
import { createMcpHandler } from "mcp-handler";
import { authenticateMcpRequest } from "@/lib/auth/boundaries";
import { registerCampaignTools } from "@/lib/mcp/campaign-tools";
import { registerBootstrapTools } from "@/lib/mcp/bootstrap-tools";

const handler = createMcpHandler(
  (server) => {
    registerBootstrapTools(server);
    registerCampaignTools(server);
  },
  {
    serverInfo: {
      name: "rejectionism-campaign-os",
      version: "1.0.0",
    },
    instructions:
      "CampaignOS is the authoritative operational record for Rejectionism. Read current data before proposing changes. Never report an operation as successful unless the tool confirms it. Preserve superseded decisions rather than deleting them. Require evidence before completing work. 'World domination' means cultural reach and participation, never coercion or illegal activity.",
  },
  {
    basePath: "/api",
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
