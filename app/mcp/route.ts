import { createMcpHandler } from "mcp-handler";
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

export { handler as GET, handler as POST };
