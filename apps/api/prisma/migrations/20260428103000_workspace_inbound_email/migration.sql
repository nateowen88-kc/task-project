ALTER TABLE "AppConfig"
ADD COLUMN "emailInboundDomain" TEXT;

ALTER TABLE "Workspace"
ADD COLUMN "inboundEmailKey" TEXT;

UPDATE "Workspace"
SET "inboundEmailKey" = CONCAT(REGEXP_REPLACE(LOWER("slug"), '[^a-z0-9]+', '-', 'g'), '-', RIGHT("id", 6))
WHERE "inboundEmailKey" IS NULL;

ALTER TABLE "Workspace"
ALTER COLUMN "inboundEmailKey" SET NOT NULL;

CREATE UNIQUE INDEX "Workspace_inboundEmailKey_key" ON "Workspace"("inboundEmailKey");
