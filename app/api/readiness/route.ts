import { NextResponse } from "next/server";
import { authenticateMcpRequest } from "@/lib/auth/boundaries";
import { checkReadiness } from "@/lib/campaign/readiness";

export async function GET(request: Request) {
  const auth = await authenticateMcpRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const report = await checkReadiness();
  return NextResponse.json(report, {
    status: report.ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
