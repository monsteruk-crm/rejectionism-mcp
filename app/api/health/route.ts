import { NextResponse } from "next/server";
import { getHealthStatus } from "@/lib/campaign/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public minimal connectivity result. No environment, configuration, or token
 * details; a successful response proves connectivity only.
 */
export async function GET() {
  const { status } = await getHealthStatus();

  return NextResponse.json(
    { status },
    {
      status: status === "ok" ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
