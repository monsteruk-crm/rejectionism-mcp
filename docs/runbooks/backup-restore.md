# Backup and Disaster Recovery Runbook

## Overview

This runbook documents procedures for backing up and restoring Rejectionism CampaignOS data, covering both the PostgreSQL database and the private Vercel Blob object store.

A database backup alone does NOT back up binary assets stored in Vercel Blob, and external URLs (`EXTERNAL_URL`) remain externally owned.

## Prerequisites & Security

- **Target Isolation**: Never restore into an active operational database without explicit operator authorization.
- **Credential Hygiene**: Load credentials via environment variables (`PGPASSWORD` or connection strings). Never hardcode credentials in scripts, command histories, or shared artifacts.
- **Tooling**: Use `pg_dump` and `pg_restore` matching the PostgreSQL major version of the database cluster.

---

## 1. Database Backup Procedure

### Step 1: Compute Target Fingerprint and Verify Identity

```bash
# Normalize and fingerprint current database URL
node -e '
  import("./scripts/lib/test-target.mjs").then(m => {
    console.log("Database Fingerprint:", m.computeDatabaseFingerprint(process.env.MCP_PRISMA_DATABASE_URL));
  });
'
```

### Step 2: Custom-Format Dump

Export a consistent PostgreSQL snapshot using custom format (`-Fc`):

```bash
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_campaignos_${BACKUP_TIMESTAMP}.dump"

pg_dump "$MCP_PRISMA_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$BACKUP_FILE"

echo "Backup saved to $BACKUP_FILE"
```

---

## 2. Blob Storage Manifest Export

Export an inventory of active Blob objects associated with visual asset representations:

```bash
# Dry-run inspection to verify active vs unreferenced storage
tsx --conditions=react-server scripts/cleanup-upload-files.ts --dry-run
```

---

## 3. Disaster Recovery / Restore Procedure

### Step 1: Provision Separate Clean Target Database

Create a clean PostgreSQL database for restoration. Never drop or overwrite the operational database directly.

```bash
RESTORE_TARGET_URL="postgresql://user:pass@host:5432/campaignos_restored"
```

### Step 2: Restore Schema & Data

```bash
pg_restore \
  --dbname="$RESTORE_TARGET_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  "$BACKUP_FILE"
```

### Step 3: Run Migration Status & Readiness Check

Verify migration alignment and model tables on the restored target:

```bash
MCP_PRISMA_DATABASE_URL="$RESTORE_TARGET_URL" pnpm db:validate
MCP_PRISMA_DATABASE_URL="$RESTORE_TARGET_URL" pnpm db:deploy
```

### Step 4: Verify Sample Data Integrity

Check row counts and test private file retrieval:

```bash
# Verify table record counts and sample references
node -e '
  import("./lib/prisma.ts").then(async ({ getPrisma }) => {
    const prisma = getPrisma();
    const assets = await prisma.asset.count();
    const workItems = await prisma.workItem.count();
    console.log(`Restored database has ${assets} assets and ${workItems} work items.`);
  });
'
```

---

## 4. Rollback and Cutover Authorization

1. Ensure the restored target passes read-only smoke checks: `node scripts/test-client.mjs --origin <app_url>`.
2. Update deployment environment variable `MCP_PRISMA_DATABASE_URL` only upon formal operator sign-off.
