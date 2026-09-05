import { createMcpHandler } from "mcp-handler";
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
      "CampaignOS is the authoritative operational record for Rejectionism. Read current data before proposing changes. Never report an operation as successful unless the tool confirms it. Preserve superseded decisions rather than deleting them. Require evidence before completing work. 'World domination' means cultural reach and participation, never coercion or illegal activity. UNAUTHENTICATED TEST SYSTEM — DO NOT STORE PRIVATE OR SENSITIVE DATA.",
  },
  {
    basePath: "/api",
    disableSse: true,
  },
);

export { handler as GET, handler as POST, handler as DELETE };
