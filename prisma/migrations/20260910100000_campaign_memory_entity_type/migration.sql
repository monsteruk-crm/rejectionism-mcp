-- Add the CAMPAIGN_MEMORY value to the EntityType enum so subsequent
-- migrations and the campaignMemory model may reference it. Split from the
-- main campaign_memory migration so that the new enum value is committed before
-- a later migration uses it (PostgreSQL ALTER TYPE ADD VALUE cannot be used
-- inside a transaction block and the new value is not visible in the same
-- transaction in which it is added).

ALTER TYPE "EntityType" ADD VALUE 'CAMPAIGN_MEMORY';
