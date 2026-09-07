-- CreateEnum
CREATE TYPE "UploadRequestPurpose" AS ENUM ('CONTRIBUTOR', 'ADMIN_INTERNAL');

-- AlterTable
ALTER TABLE "UploadRequest" ADD COLUMN "purpose" "UploadRequestPurpose" NOT NULL DEFAULT 'CONTRIBUTOR';

-- CreateIndex
CREATE INDEX "UploadRequest_purpose_createdAt_id_idx" ON "UploadRequest"("purpose", "createdAt", "id");

-- CreateIndex
CREATE INDEX "UploadRequest_purpose_status_expiresAt_idx" ON "UploadRequest"("purpose", "status", "expiresAt");
