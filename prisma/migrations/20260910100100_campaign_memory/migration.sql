-- CampaignOS persistent cross-tool memory (ADR 0007, brief section 2).
-- Additive only: no existing column, row, table, or enum member is modified.
-- All authored CHECK/UNIQUE constraints are additive. The polymorphic CHECK
-- constraints on EntityTag and EntityRelation are dropped and recreated with
-- the expanded allowlist; their names are preserved so existing error handling
-- remains meaningful.

-- CreateEnum
CREATE TYPE "MemoryCategory" AS ENUM (
  'PREFERENCE',
  'CONTEXT',
  'INSTRUCTION',
  'LESSON',
  'PERSON',
  'PROJECT',
  'STYLE',
  'PROCESS',
  'TECHNICAL',
  'REFERENCE',
  'OTHER'
);

CREATE TYPE "MemoryStatus" AS ENUM (
  'ACTIVE',
  'SUPERSEDED',
  'ARCHIVED'
);

CREATE TYPE "MemorySourceType" AS ENUM (
  'HUMAN',
  'MCP',
  'ADMIN',
  'IMPORT',
  'SYSTEM'
);

-- CreateTable
CREATE TABLE "CampaignMemory" (
  "id"              TEXT NOT NULL,
  "key"             TEXT,
  "title"           TEXT NOT NULL,
  "content"         TEXT NOT NULL,
  "category"        "MemoryCategory" NOT NULL,
  "status"          "MemoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "importance"      INTEGER NOT NULL DEFAULT 50,
  "confidence"      INTEGER NOT NULL DEFAULT 100,
  "pinned"          BOOLEAN NOT NULL DEFAULT false,
  "sourceType"      "MemorySourceType" NOT NULL,
  "sourceLabel"     TEXT,
  "sourceUrl"       TEXT,
  "contentHash"     CHAR(64) NOT NULL,
  "version"         INTEGER NOT NULL DEFAULT 1,
  "accessCount"     INTEGER NOT NULL DEFAULT 0,
  "lastAccessedAt"  TIMESTAMP(3),
  "expiresAt"       TIMESTAMP(3),
  "supersedesId"    TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CampaignMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignMemory_key_key" ON "CampaignMemory"("key");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignMemory_supersedesId_key" ON "CampaignMemory"("supersedesId");

CREATE INDEX "CampaignMemory_category_idx" ON "CampaignMemory"("category");
CREATE INDEX "CampaignMemory_importance_idx" ON "CampaignMemory"("importance");
CREATE INDEX "CampaignMemory_pinned_idx" ON "CampaignMemory"("pinned");
CREATE INDEX "CampaignMemory_updatedAt_idx" ON "CampaignMemory"("updatedAt");
CREATE INDEX "CampaignMemory_expiresAt_idx" ON "CampaignMemory"("expiresAt");
CREATE INDEX "CampaignMemory_contentHash_idx" ON "CampaignMemory"("contentHash");
CREATE INDEX "CampaignMemory_status_expiresAt_idx" ON "CampaignMemory"("status", "expiresAt");
CREATE INDEX "CampaignMemory_lastAccessedAt_id_idx" ON "CampaignMemory"("lastAccessedAt", "id");

-- Authored SQL constraint: ACTIVE rows must own each contentHash exclusively.
-- Superseded and Archived records may legitimately share a contentHash with
-- each other because they represent the same content at different lifecycle
-- points. The unique index name is part of the application contract: error
-- mapping relies on this specific identifier.
CREATE UNIQUE INDEX "CampaignMemory_active_content_hash_key"
  ON "CampaignMemory"("contentHash")
  WHERE "status" = 'ACTIVE';

-- AddForeignKey
ALTER TABLE "CampaignMemory"
  ADD CONSTRAINT "CampaignMemory_supersedesId_fkey"
  FOREIGN KEY ("supersedesId") REFERENCES "CampaignMemory"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Authored CHECK: numeric, hash, and self-FK guards.
ALTER TABLE "CampaignMemory" ADD CONSTRAINT "CampaignMemory_importance_range_chk"
  CHECK ("importance" BETWEEN 0 AND 100);
ALTER TABLE "CampaignMemory" ADD CONSTRAINT "CampaignMemory_confidence_range_chk"
  CHECK ("confidence" BETWEEN 0 AND 100);
ALTER TABLE "CampaignMemory" ADD CONSTRAINT "CampaignMemory_version_min_chk"
  CHECK ("version" >= 1);
ALTER TABLE "CampaignMemory" ADD CONSTRAINT "CampaignMemory_access_count_min_chk"
  CHECK ("accessCount" >= 0);
ALTER TABLE "CampaignMemory" ADD CONSTRAINT "CampaignMemory_content_hash_format_chk"
  CHECK ("contentHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "CampaignMemory" ADD CONSTRAINT "CampaignMemory_no_self_supersede_chk"
  CHECK ("supersedesId" IS NULL OR "supersedesId" <> "id");

-- Drop and recreate updated polymorphic tag/relation CHECKs to expand the
-- generic allowlist from seven to eight entity types. Same constraint names
-- are preserved so error mapping stays meaningful. The other rules in those
-- constraints (no USES_ASSET extension, no self-link) are preserved.
ALTER TABLE "EntityTag" DROP CONSTRAINT "EntityTag_original_entity_type_chk";
ALTER TABLE "EntityTag" ADD CONSTRAINT "EntityTag_original_entity_type_chk" CHECK (
  "entityType" IN (
    'WORK_ITEM',
    'CANON_ENTRY',
    'DECISION',
    'ASSET',
    'WEBSITE',
    'CONTENT_ITEM',
    'CONTACT',
    'CAMPAIGN_MEMORY'
  )
);

ALTER TABLE "EntityRelation" DROP CONSTRAINT "EntityRelation_endpoints_chk";
ALTER TABLE "EntityRelation" ADD CONSTRAINT "EntityRelation_endpoints_chk" CHECK (
  "fromEntityType" IN (
    'WORK_ITEM',
    'CANON_ENTRY',
    'DECISION',
    'ASSET',
    'WEBSITE',
    'CONTENT_ITEM',
    'CONTACT',
    'CAMPAIGN_MEMORY'
  )
  AND "toEntityType" IN (
    'WORK_ITEM',
    'CANON_ENTRY',
    'DECISION',
    'ASSET',
    'WEBSITE',
    'CONTENT_ITEM',
    'CONTACT',
    'CAMPAIGN_MEMORY'
  )
  AND NOT ("fromEntityType" = "toEntityType" AND "fromEntityId" = "toEntityId")
);
