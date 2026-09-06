-- Generic tags and directed relationships (upgrade plan section 2, Phase 4).
-- Additive only: no existing column, enum member, or row is modified.
-- Polymorphic endpoints intentionally have no entity foreign keys; integrity
-- is enforced by authored constraint 8 plus service-side existence checks.

-- CreateEnum
CREATE TYPE "EntityRelationType" AS ENUM ('RELATES_TO', 'USES_ASSET', 'PART_OF');

-- CreateEnum (new values are not used by any row in this migration)
ALTER TYPE "EntityType" ADD VALUE 'TAG';
ALTER TYPE "EntityType" ADD VALUE 'ENTITY_RELATION';

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityTag" (
    "tagId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityTag_pkey" PRIMARY KEY ("tagId","entityType","entityId")
);

-- CreateTable
CREATE TABLE "EntityRelation" (
    "id" TEXT NOT NULL,
    "fromEntityType" "EntityType" NOT NULL,
    "fromEntityId" TEXT NOT NULL,
    "toEntityType" "EntityType" NOT NULL,
    "toEntityId" TEXT NOT NULL,
    "relationType" "EntityRelationType" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "EntityTag_entityType_entityId_idx" ON "EntityTag"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityRelation_fromEntityType_fromEntityId_toEntityType_toEntityId_relationType_key" ON "EntityRelation"("fromEntityType", "fromEntityId", "toEntityType", "toEntityId", "relationType");

-- CreateIndex
CREATE INDEX "EntityRelation_fromEntityType_fromEntityId_createdAt_idx" ON "EntityRelation"("fromEntityType", "fromEntityId", "createdAt");

-- CreateIndex
CREATE INDEX "EntityRelation_toEntityType_toEntityId_createdAt_idx" ON "EntityRelation"("toEntityType", "toEntityId", "createdAt");

-- AddForeignKey
ALTER TABLE "EntityTag" ADD CONSTRAINT "EntityTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Authored SQL constraint 8: tag memberships and both relation endpoints are
-- restricted to the original seven entity types; a relation cannot point from
-- an entity to itself.
ALTER TABLE "EntityTag" ADD CONSTRAINT "EntityTag_original_entity_type_chk" CHECK (
    "entityType" IN ('WORK_ITEM', 'CANON_ENTRY', 'DECISION', 'ASSET', 'WEBSITE', 'CONTENT_ITEM', 'CONTACT')
);

ALTER TABLE "EntityRelation" ADD CONSTRAINT "EntityRelation_endpoints_chk" CHECK (
    "fromEntityType" IN ('WORK_ITEM', 'CANON_ENTRY', 'DECISION', 'ASSET', 'WEBSITE', 'CONTENT_ITEM', 'CONTACT')
    AND "toEntityType" IN ('WORK_ITEM', 'CANON_ENTRY', 'DECISION', 'ASSET', 'WEBSITE', 'CONTENT_ITEM', 'CONTACT')
    AND NOT ("fromEntityType" = "toEntityType" AND "fromEntityId" = "toEntityId")
);
