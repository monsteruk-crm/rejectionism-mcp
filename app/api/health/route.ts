import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { isTestModeEnabled } from "@/lib/campaign/test-mode";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const timestamp = new Date().toISOString();
  const unauthenticatedTestMode = isTestModeEnabled();

  let databaseConnected = false;

  try {
    const prisma = getPrisma();
    const result = await Promise.race([
      prisma.$queryRaw<Array<{ result: number }>>`SELECT 1 AS result`,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Database query timeout")), 3000),
      ),
    ]);

    if (result && result[0]?.result === 1) {
      databaseConnected = true;
    }
  } catch {
    databaseConnected = false;
  }

  const status = databaseConnected ? "ok" : "degraded";
  const database = databaseConnected ? "connected" : "unavailable";
  const httpStatus = databaseConnected ? 200 : 503;

  return NextResponse.json(
    {
      status,
      database,
      timestamp,
      unauthenticatedTestMode,
    },
    {
      status: httpStatus,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
