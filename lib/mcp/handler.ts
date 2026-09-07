import { NextRequest, NextResponse } from "next/server";
import { createMcpHandler } from "mcp-handler";
import { authenticateMcpRequest } from "@/lib/auth/boundaries";
import { registerBootstrapTools } from "@/lib/mcp/bootstrap-tools";
import { registerCampaignTools } from "@/lib/mcp/campaign-tools";

export interface CreateAuthenticatedMcpHandlerOptions {
  basePath?: string;
}

export function createAuthenticatedMcpHandler(options: CreateAuthenticatedMcpHandlerOptions = {}) {
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
      ...(options.basePath ? { basePath: options.basePath } : {}),
      disableSse: true,
    },
  );

  return async function authenticatedHandler(req: NextRequest): Promise<NextResponse | Response> {
    const auth = await authenticateMcpRequest(req);
    if (!auth.ok) {
      return auth.response;
    }
    return handler(req);
  };
}
