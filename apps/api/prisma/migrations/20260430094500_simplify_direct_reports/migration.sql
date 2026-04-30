-- Backfill standalone direct report fields before removing user linkage.
ALTER TABLE "DirectReport" ADD COLUMN "reportName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DirectReport" ADD COLUMN "reportEmail" TEXT;

UPDATE "DirectReport" dr
SET
  "reportName" = COALESCE(u."name", ''),
  "reportEmail" = u."email"
FROM "User" u
WHERE dr."teammateUserId" = u."id";

ALTER TABLE "DirectReport" RENAME COLUMN "title" TO "role";

DROP INDEX IF EXISTS "DirectReport_workspaceId_managerUserId_teammateUserId_key";
ALTER TABLE "DirectReport" DROP CONSTRAINT IF EXISTS "DirectReport_teammateUserId_fkey";
ALTER TABLE "DirectReport" DROP COLUMN "teammateUserId";
