CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'MEMBER');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "defaultWorkspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Task"
ADD COLUMN "workspaceId" TEXT,
ADD COLUMN "createdById" TEXT,
ADD COLUMN "assigneeId" TEXT;

ALTER TABLE "TaskOccurrence"
ADD COLUMN "workspaceId" TEXT;

ALTER TABLE "CapturedItem"
ADD COLUMN "workspaceId" TEXT;

INSERT INTO "Workspace" ("id", "name", "slug", "createdAt", "updatedAt")
VALUES ('legacy-workspace', 'Legacy Workspace', 'legacy-workspace', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

UPDATE "Task"
SET "workspaceId" = 'legacy-workspace'
WHERE "workspaceId" IS NULL;

UPDATE "TaskOccurrence"
SET "workspaceId" = "Task"."workspaceId"
FROM "Task"
WHERE "TaskOccurrence"."taskId" = "Task"."id"
  AND "TaskOccurrence"."workspaceId" IS NULL;

UPDATE "CapturedItem"
SET "workspaceId" = COALESCE("Task"."workspaceId", 'legacy-workspace')
FROM "Task"
WHERE "CapturedItem"."taskId" = "Task"."id"
  AND "CapturedItem"."workspaceId" IS NULL;

UPDATE "CapturedItem"
SET "workspaceId" = 'legacy-workspace'
WHERE "workspaceId" IS NULL;

ALTER TABLE "Task"
ALTER COLUMN "workspaceId" SET NOT NULL;

ALTER TABLE "TaskOccurrence"
ALTER COLUMN "workspaceId" SET NOT NULL;

ALTER TABLE "CapturedItem"
ALTER COLUMN "workspaceId" SET NOT NULL;

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");
CREATE UNIQUE INDEX "WorkspaceMember_userId_workspaceId_key" ON "WorkspaceMember"("userId", "workspaceId");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

CREATE INDEX "WorkspaceMember_workspaceId_role_idx" ON "WorkspaceMember"("workspaceId", "role");
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");
CREATE INDEX "Task_workspaceId_dueDate_status_idx" ON "Task"("workspaceId", "dueDate", "status");
CREATE INDEX "Task_workspaceId_status_sortOrder_idx" ON "Task"("workspaceId", "status", "sortOrder");
CREATE INDEX "Task_workspaceId_plannedForDate_status_idx" ON "Task"("workspaceId", "plannedForDate", "status");
CREATE INDEX "TaskOccurrence_workspaceId_scheduledFor_status_idx" ON "TaskOccurrence"("workspaceId", "scheduledFor", "status");
CREATE INDEX "CapturedItem_workspaceId_status_receivedAt_idx" ON "CapturedItem"("workspaceId", "status", "receivedAt");
CREATE INDEX "CapturedItem_workspaceId_sourceType_receivedAt_idx" ON "CapturedItem"("workspaceId", "sourceType", "receivedAt");

ALTER TABLE "User"
ADD CONSTRAINT "User_defaultWorkspaceId_fkey"
FOREIGN KEY ("defaultWorkspaceId") REFERENCES "Workspace"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "Workspace"
ADD CONSTRAINT "Workspace_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMember"
ADD CONSTRAINT "WorkspaceMember_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMember"
ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Session"
ADD CONSTRAINT "Session_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_assigneeId_fkey"
FOREIGN KEY ("assigneeId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "TaskOccurrence"
ADD CONSTRAINT "TaskOccurrence_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "CapturedItem"
ADD CONSTRAINT "CapturedItem_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
