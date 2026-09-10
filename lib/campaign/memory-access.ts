import "server-only";
import { Prisma } from "@/app/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

/**
 * Best-effort access telemetry for CampaignMemory (ADR 0007, execution plan
 * section 7). Public get-memory and recall default to trackAccess true and
 * post a parameterized raw UPDATE that increments accessCount and updates
 * lastAccessedAt without touching updatedAt or version. Telemetry failures are
 * swallowed; recall never fails because tracking failed.
 *
 * Postgres Int max is 2147483647. We saturate at that bound using a bigint
 * intermediate so the SUM() can never overflow silently. Each call uses
 * bounded server-side lock/statement timeouts.
 */

const PG_INT_MAX = "2147483647";

const STATEMENT_TIMEOUT_MS = 500;
const LOCK_TIMEOUT_MS = 100;
const TRANSACTION_MAX_WAIT_MS = 500;
const TRANSACTION_TIMEOUT_MS = 1500;

export async function trackMemoryAccess(
  memoryIds: string[],
  requestNow: Date,
): Promise<void> {
  if (memoryIds.length === 0) return;

  try {
    const prisma = getPrisma();
    await prisma.$transaction(
      async (tx) => {
        // Prisma transactions don't expose statement_timeout directly per tx;
        // we set transaction-local defaults via SET LOCAL so they apply only
        // inside this transaction and revert on commit/rollback.
        await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT_MS}ms'`);
        await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '${STATEMENT_TIMEOUT_MS}ms'`);
        const idList = Prisma.join(memoryIds.map((id) => Prisma.raw(`'${id.replace(/'/g, "''")}'::text`)));
        await tx.$executeRawUnsafe(
          `UPDATE "CampaignMemory"
             SET "accessCount" = LEAST(${PG_INT_MAX}::bigint, "accessCount" + 1)::integer,
                 "lastAccessedAt" = GREATEST("lastAccessedAt", '${requestNow.toISOString()}'::timestamp)
           WHERE "id" IN (${idList})`,
        );
      },
      {
        isolationLevel: "ReadCommitted",
        maxWait: TRANSACTION_MAX_WAIT_MS,
        timeout: TRANSACTION_TIMEOUT_MS,
      },
    );
  } catch (error) {
    // Telemetry must never bubble up to recall results. Caller catches here.
    // Log nothing; callers can subscribe if/when they need it.
    void error;
  }
}
