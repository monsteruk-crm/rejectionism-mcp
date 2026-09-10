import "server-only";
import { createHash } from "node:crypto";
import { getPrisma } from "@/lib/prisma";

export interface ReadinessReport {
  ok: boolean;
  database: {
    connected: boolean;
    tablesPresent: boolean;
    migrationsApplied: boolean;
    fingerprint: string | null;
  };
  blob: {
    configured: boolean;
  };
  error?: string;
}

const REQUIRED_TABLES = [
  "WorkItem",
  "CanonEntry",
  "Decision",
  "Asset",
  "Website",
  "Contact",
  "ContentItem",
  "Activity",
  "AssetRevision",
  "AssetRepresentation",
  "UploadRequest",
  "UploadFile",
  "Tag",
  "EntityTag",
  "EntityRelation",
  "CampaignMemory",
];

const BASELINE_MIGRATIONS = [
  "20260905134459_init",
  "20260905144500_campaign_os",
  "20260906090000_assets_and_upload_requests",
  "20260906091000_entity_tags_and_relations",
  "20260907130000_upload_request_purpose",
  "20260910100000_campaign_memory_entity_type",
  "20260910100100_campaign_memory",
];

export function computeUrlFingerprint(rawUrl: string | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== "string") {
    return null;
  }
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const port = parsed.port ? parseInt(parsed.port, 10) : 5432;
    const database = parsed.pathname.replace(/^\//, "").toLowerCase();
    const schema = (parsed.searchParams.get("schema") || "public").toLowerCase();
    const normalizedString = `postgresql://${host}:${port}/${database}?schema=${schema}`;
    return createHash("sha256").update(normalizedString, "utf8").digest("hex");
  } catch {
    return null;
  }
}

export async function checkReadiness(): Promise<ReadinessReport> {
  const dbUrl = process.env.MCP_PRISMA_DATABASE_URL;
  const fingerprint = computeUrlFingerprint(dbUrl);
  const blobConfigured = typeof process.env.BLOB_READ_WRITE_TOKEN === "string" && process.env.BLOB_READ_WRITE_TOKEN.length > 0;

  if (!dbUrl) {
    return {
      ok: false,
      database: {
        connected: false,
        tablesPresent: false,
        migrationsApplied: false,
        fingerprint: null,
      },
      blob: { configured: blobConfigured },
      error: "CONFIGURATION_ERROR",
    };
  }

  try {
    const prisma = getPrisma();

    // 1. Connectivity check
    const ping = await Promise.race([
      prisma.$queryRaw<Array<{ result: number }>>`SELECT 1 AS result`,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Database timeout")), 3000),
      ),
    ]);

    const connected = Array.isArray(ping) && ping[0]?.result === 1;
    if (!connected) {
      return {
        ok: false,
        database: {
          connected: false,
          tablesPresent: false,
          migrationsApplied: false,
          fingerprint,
        },
        blob: { configured: blobConfigured },
        error: "DATABASE_UNAVAILABLE",
      };
    }

    // 2. Table presence check
    const tableRows = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = current_schema()
    `;

    const existingTables = new Set(tableRows.map((r) => r.table_name));
    const allTablesPresent = REQUIRED_TABLES.every((tableName) =>
      existingTables.has(tableName) || existingTables.has(tableName.toLowerCase()),
    );

    if (!allTablesPresent) {
      return {
        ok: false,
        database: {
          connected: true,
          tablesPresent: false,
          migrationsApplied: false,
          fingerprint,
        },
        blob: { configured: blobConfigured },
        error: "TABLES_MISSING",
      };
    }

    // 3. Authored migrations check
    let migrationsApplied = false;
    try {
      const migrationRows = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
        SELECT migration_name, finished_at 
        FROM "_prisma_migrations" 
        WHERE rolled_back_at IS NULL AND finished_at IS NOT NULL
      `;
      const appliedNames = new Set(migrationRows.map((r) => r.migration_name));
      migrationsApplied = BASELINE_MIGRATIONS.every((name) => appliedNames.has(name));
    } catch {
      // If _prisma_migrations table doesn't exist or query fails
      migrationsApplied = false;
    }

    if (!migrationsApplied) {
      return {
        ok: false,
        database: {
          connected: true,
          tablesPresent: true,
          migrationsApplied: false,
          fingerprint,
        },
        blob: { configured: blobConfigured },
        error: "MIGRATIONS_PENDING",
      };
    }

    return {
      ok: true,
      database: {
        connected: true,
        tablesPresent: true,
        migrationsApplied: true,
        fingerprint,
      },
      blob: { configured: blobConfigured },
    };
  } catch {
    return {
      ok: false,
      database: {
        connected: false,
        tablesPresent: false,
        migrationsApplied: false,
        fingerprint,
      },
      blob: { configured: blobConfigured },
      error: "DATABASE_UNAVAILABLE",
    };
  }
}
