-- Asset/upload storage schema (upgrade plan section 2).
-- Additive only: no existing column, enum member, or row is modified.
-- Tag/EntityTag/EntityRelation structures arrive in migration 20260906091000.

-- CreateEnum
CREATE TYPE "AssetStorageType" AS ENUM ('BLOB', 'EXTERNAL_URL');

-- CreateEnum
CREATE TYPE "UploadRequestStatus" AS ENUM ('OPEN', 'SUBMITTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "UploadFileStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'ATTACHED', 'DISCARDED');

-- CreateEnum (new value is not used by any row in this migration)
ALTER TYPE "EntityType" ADD VALUE 'UPLOAD_REQUEST';

-- CreateTable
CREATE TABLE "AssetRevision" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "label" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetRepresentation" (
    "id" TEXT NOT NULL,
    "assetRevisionId" TEXT NOT NULL,
    "storageType" "AssetStorageType" NOT NULL,
    "label" TEXT,
    "notes" TEXT,
    "variant" TEXT,
    "format" TEXT,
    "sourceFilename" TEXT,
    "mimeType" TEXT,
    "byteSize" BIGINT,
    "width" INTEGER,
    "height" INTEGER,
    "checksumSha256" CHAR(64),
    "blobUrl" TEXT,
    "blobPathname" TEXT,
    "externalUrl" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "uploadFileId" TEXT,
    "uploadRequestId" TEXT,
    "legacyAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetRepresentation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadRequest" (
    "id" TEXT NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "status" "UploadRequestStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxItems" INTEGER NOT NULL DEFAULT 20,
    "targetAssetId" TEXT,
    "targetRevisionId" TEXT,
    "targetAssetVersion" INTEGER,
    "submissionKey" UUID,
    "submissionHash" CHAR(64),
    "submissionReceipt" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "replacesId" TEXT,

    CONSTRAINT "UploadRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadFile" (
    "id" TEXT NOT NULL,
    "uploadRequestId" TEXT NOT NULL,
    "clientItemId" UUID NOT NULL,
    "status" "UploadFileStatus" NOT NULL DEFAULT 'PENDING',
    "sourceFilename" TEXT NOT NULL,
    "declaredMimeType" TEXT NOT NULL,
    "expectedByteSize" BIGINT NOT NULL,
    "blobPathname" TEXT NOT NULL,
    "blobUrl" TEXT,
    "mimeType" TEXT,
    "byteSize" BIGINT,
    "width" INTEGER,
    "height" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "authorizationCount" INTEGER NOT NULL DEFAULT 0,
    "authorizationExpiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetRevision_assetId_revisionNumber_key" ON "AssetRevision"("assetId", "revisionNumber");

-- CreateIndex
CREATE INDEX "AssetRepresentation_assetRevisionId_createdAt_idx" ON "AssetRepresentation"("assetRevisionId", "createdAt");

-- CreateIndex
CREATE INDEX "AssetRepresentation_storageType_idx" ON "AssetRepresentation"("storageType");

-- CreateIndex
CREATE INDEX "AssetRepresentation_uploadRequestId_idx" ON "AssetRepresentation"("uploadRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetRepresentation_blobPathname_key" ON "AssetRepresentation"("blobPathname");

-- CreateIndex
CREATE UNIQUE INDEX "AssetRepresentation_uploadFileId_key" ON "AssetRepresentation"("uploadFileId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetRepresentation_legacyAssetId_key" ON "AssetRepresentation"("legacyAssetId");

-- CreateIndex (authored SQL constraint 2: at most one primary per revision)
CREATE UNIQUE INDEX "AssetRepresentation_one_primary_per_revision" ON "AssetRepresentation"("assetRevisionId") WHERE "isPrimary" = true;

-- CreateIndex
CREATE UNIQUE INDEX "UploadRequest_tokenHash_key" ON "UploadRequest"("tokenHash");

-- CreateIndex
CREATE INDEX "UploadRequest_status_expiresAt_idx" ON "UploadRequest"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "UploadRequest_createdAt_id_idx" ON "UploadRequest"("createdAt", "id");

-- CreateIndex
CREATE INDEX "UploadRequest_targetAssetId_idx" ON "UploadRequest"("targetAssetId");

-- CreateIndex
CREATE INDEX "UploadRequest_targetRevisionId_idx" ON "UploadRequest"("targetRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "UploadRequest_replacesId_key" ON "UploadRequest"("replacesId");

-- CreateIndex
CREATE UNIQUE INDEX "UploadFile_blobPathname_key" ON "UploadFile"("blobPathname");

-- CreateIndex
CREATE UNIQUE INDEX "UploadFile_uploadRequestId_clientItemId_key" ON "UploadFile"("uploadRequestId", "clientItemId");

-- CreateIndex
CREATE INDEX "UploadFile_uploadRequestId_status_idx" ON "UploadFile"("uploadRequestId", "status");

-- AddForeignKey
ALTER TABLE "AssetRevision" ADD CONSTRAINT "AssetRevision_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRepresentation" ADD CONSTRAINT "AssetRepresentation_assetRevisionId_fkey" FOREIGN KEY ("assetRevisionId") REFERENCES "AssetRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRepresentation" ADD CONSTRAINT "AssetRepresentation_uploadFileId_fkey" FOREIGN KEY ("uploadFileId") REFERENCES "UploadFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRepresentation" ADD CONSTRAINT "AssetRepresentation_uploadRequestId_fkey" FOREIGN KEY ("uploadRequestId") REFERENCES "UploadRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRepresentation" ADD CONSTRAINT "AssetRepresentation_legacyAssetId_fkey" FOREIGN KEY ("legacyAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadRequest" ADD CONSTRAINT "UploadRequest_targetAssetId_fkey" FOREIGN KEY ("targetAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadRequest" ADD CONSTRAINT "UploadRequest_targetRevisionId_fkey" FOREIGN KEY ("targetRevisionId") REFERENCES "AssetRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadRequest" ADD CONSTRAINT "UploadRequest_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "UploadRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadFile" ADD CONSTRAINT "UploadFile_uploadRequestId_fkey" FOREIGN KEY ("uploadRequestId") REFERENCES "UploadRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Authored SQL constraint 1
ALTER TABLE "AssetRevision" ADD CONSTRAINT "AssetRevision_revisionNumber_positive_chk" CHECK ("revisionNumber" > 0);

-- Authored SQL constraint 3: BLOB and EXTERNAL_URL storage are exclusive
ALTER TABLE "AssetRepresentation" ADD CONSTRAINT "AssetRepresentation_storage_exclusivity_chk" CHECK (
    (
        "storageType" = 'BLOB'
        AND "blobUrl" IS NOT NULL
        AND "blobPathname" IS NOT NULL
        AND "uploadFileId" IS NOT NULL
        AND "mimeType" IS NOT NULL
        AND "byteSize" IS NOT NULL
        AND "externalUrl" IS NULL
        AND "legacyAssetId" IS NULL
    )
    OR (
        "storageType" = 'EXTERNAL_URL'
        AND "externalUrl" IS NOT NULL
        AND "blobUrl" IS NULL
        AND "blobPathname" IS NULL
        AND "uploadFileId" IS NULL
    )
);

-- Authored SQL constraint 4: non-null byte sizes are positive; dimensions are null or positive
ALTER TABLE "AssetRepresentation" ADD CONSTRAINT "AssetRepresentation_sizes_chk" CHECK (
    ("byteSize" IS NULL OR "byteSize" > 0)
    AND ("width" IS NULL OR "width" > 0)
    AND ("height" IS NULL OR "height" > 0)
);

-- Authored SQL constraint 4
ALTER TABLE "UploadFile" ADD CONSTRAINT "UploadFile_sizes_chk" CHECK (
    ("byteSize" IS NULL OR "byteSize" > 0)
    AND ("width" IS NULL OR "width" > 0)
    AND ("height" IS NULL OR "height" > 0)
);

-- Authored SQL constraint 4
ALTER TABLE "UploadFile" ADD CONSTRAINT "UploadFile_expectedByteSize_bounds_chk" CHECK ("expectedByteSize" >= 1 AND "expectedByteSize" <= 104857600);

-- Authored SQL constraint 4
ALTER TABLE "UploadFile" ADD CONSTRAINT "UploadFile_authorizationCount_bounds_chk" CHECK ("authorizationCount" >= 0 AND "authorizationCount" <= 3);

-- Authored SQL constraint 5
ALTER TABLE "UploadRequest" ADD CONSTRAINT "UploadRequest_maxItems_bounds_chk" CHECK ("maxItems" >= 1 AND "maxItems" <= 50);

-- Authored SQL constraint 5
ALTER TABLE "UploadRequest" ADD CONSTRAINT "UploadRequest_expires_after_created_chk" CHECK ("expiresAt" > "createdAt");

-- Authored SQL constraint 6: either all target fields are null, or targetAssetId plus a
-- positive targetAssetVersion are non-null; targetRevisionId requires targetAssetId.
ALTER TABLE "UploadRequest" ADD CONSTRAINT "UploadRequest_target_consistency_chk" CHECK (
    (
        "targetAssetId" IS NULL
        AND "targetRevisionId" IS NULL
        AND "targetAssetVersion" IS NULL
    )
    OR (
        "targetAssetId" IS NOT NULL
        AND "targetAssetVersion" IS NOT NULL
        AND "targetAssetVersion" > 0
        AND ("targetRevisionId" IS NULL OR "targetAssetId" IS NOT NULL)
    )
);

-- Authored SQL constraint 7: request state machine
ALTER TABLE "UploadRequest" ADD CONSTRAINT "UploadRequest_state_chk" CHECK (
    (
        "status" = 'OPEN'
        AND "submittedAt" IS NULL
        AND "submissionKey" IS NULL
        AND "submissionHash" IS NULL
        AND "submissionReceipt" IS NULL
        AND "revokedAt" IS NULL
    )
    OR (
        "status" = 'SUBMITTED'
        AND "submittedAt" IS NOT NULL
        AND "submissionKey" IS NOT NULL
        AND "submissionHash" IS NOT NULL
        AND "submissionReceipt" IS NOT NULL
        AND "revokedAt" IS NULL
    )
    OR (
        "status" = 'REVOKED'
        AND "revokedAt" IS NOT NULL
        AND "submittedAt" IS NULL
        AND "submissionKey" IS NULL
        AND "submissionHash" IS NULL
        AND "submissionReceipt" IS NULL
    )
);

-- Legacy-data procedure: every existing Asset gets revision 1. The deterministic ID is
-- 'legacy-revision-' plus the PostgreSQL md5 of Asset.id. No existing Asset column is
-- modified. Conflicts are skipped so pre-existing revision 1 rows are preserved.
INSERT INTO "AssetRevision" ("id", "assetId", "revisionNumber", "createdAt")
SELECT 'legacy-revision-' || md5(a."id"), a."id", 1, a."createdAt"
FROM "Asset" a
ON CONFLICT ("assetId", "revisionNumber") DO NOTHING;
