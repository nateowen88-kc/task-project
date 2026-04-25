ALTER TABLE "Workspace"
ADD COLUMN "deactivatedAt" TIMESTAMP(3),
ADD COLUMN "allowMemberTaskCreation" BOOLEAN NOT NULL DEFAULT true;
