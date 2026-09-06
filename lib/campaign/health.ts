import "server-only";
import { getPrisma } from "@/lib/prisma";

/**
 * Shared health/connectivity service. Both the public /api/health route and
 * the check_database MCP bootstrap tool delegate here; neither queries Prisma
 * directly.
 *
 * Diagnostic semantics are retained from the original health route: a single
 * `SELECT 1` with a three-second timeout. A successful check proves
 * connectivity only — not table access, migration correctness, or write
 * permissions.
 */

const HEALTH_QUERY_TIMEOUT_MS = 3000;

export type HealthStatus = "ok" | "degraded";

export interface HealthCheckResult {
  status: HealthStatus;
}

export interface DatabasePingResult {
  ok: boolean;
  latencyMs: number;
}

async function runConnectivityQuery(): Promise<boolean> {
  const result = await Promise.race([
    getPrisma().$queryRaw<Array<{ result: number }>>`SELECT 1 AS result`,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Database query timeout")), HEALTH_QUERY_TIMEOUT_MS),
    ),
  ]);

  return Array.isArray(result) && result[0]?.result === 1;
}

export async function getHealthStatus(): Promise<HealthCheckResult> {
  try {
    const connected = await runConnectivityQuery();
    return { status: connected ? "ok" : "degraded" };
  } catch {
    return { status: "degraded" };
  }
}

export async function pingDatabase(): Promise<DatabasePingResult> {
  const startedAt = performance.now();
  try {
    const connected = await runConnectivityQuery();
    return { ok: connected, latencyMs: Math.round(performance.now() - startedAt) };
  } catch {
    return { ok: false, latencyMs: Math.round(performance.now() - startedAt) };
  }
}
