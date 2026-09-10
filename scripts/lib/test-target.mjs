import { createHash } from "node:crypto";

/**
 * Normalizes a PostgreSQL database URL into host, port, database, and schema components.
 * Strips user credentials and unrelated query parameters.
 */
export function normalizeDatabaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error("Database URL must be a non-empty string.");
  }

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
      throw new Error(`Unsupported database protocol: ${parsed.protocol}`);
    }

    const host = parsed.hostname.toLowerCase();
    const port = parsed.port ? parseInt(parsed.port, 10) : 5432;
    const database = parsed.pathname.replace(/^\//, "").toLowerCase();
    const schema = (parsed.searchParams.get("schema") || "public").toLowerCase();

    const normalizedString = `postgresql://${host}:${port}/${database}?schema=${schema}`;

    return {
      host,
      port,
      database,
      schema,
      normalizedString,
    };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Unsupported database protocol")) {
      throw err;
    }
    throw new Error(`Failed to parse database URL: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Computes a deterministic SHA-256 fingerprint for a database target.
 */
export function computeDatabaseFingerprint(rawUrl) {
  const { normalizedString } = normalizeDatabaseUrl(rawUrl);
  return createHash("sha256").update(normalizedString, "utf8").digest("hex");
}

/**
 * Verifies that the test database target is valid, disposable, and isolated from the operational database.
 * @param {Object} options
 * @param {string} options.testDatabaseUrl
 * @param {string} [options.operationalDatabaseUrl]
 * @param {boolean} [options.requireDisposableAck]
 * @param {string} [options.expectedFingerprint]
 */
export function assertDisposableTestTarget({
  testDatabaseUrl,
  operationalDatabaseUrl = undefined,
  requireDisposableAck = true,
  expectedFingerprint = undefined,
}) {
  if (!testDatabaseUrl) {
    throw new Error("TEST_MCP_PRISMA_DATABASE_URL must identify a disposable PostgreSQL database.");
  }

  const testNorm = normalizeDatabaseUrl(testDatabaseUrl);
  const testFingerprint = computeDatabaseFingerprint(testDatabaseUrl);

  if (requireDisposableAck) {
    const ack = process.env.CAMPAIGNOS_TEST_DISPOSABLE;
    if (ack !== "1" && ack !== "true") {
      throw new Error(
        "CAMPAIGNOS_TEST_DISPOSABLE=1 is required before executing write operations against a test database.",
      );
    }
  }

  if (operationalDatabaseUrl) {
    try {
      const opNorm = normalizeDatabaseUrl(operationalDatabaseUrl);
      if (testNorm.normalizedString === opNorm.normalizedString) {
        throw new Error(
          "TEST_MCP_PRISMA_DATABASE_URL matches the operational MCP_PRISMA_DATABASE_URL target. Test operations aborted to protect operational data.",
        );
      }
    } catch (err) {
      // If operational URL is invalid string, ignore comparison error if test URL is valid
      if (err instanceof Error && err.message.includes("matches the operational")) {
        throw err;
      }
    }
  }

  if (expectedFingerprint && testFingerprint !== expectedFingerprint) {
    throw new Error(
      `Test database fingerprint mismatch. Expected ${expectedFingerprint}, got ${testFingerprint}.`,
    );
  }

  return {
    normalized: testNorm,
    fingerprint: testFingerprint,
  };
}
