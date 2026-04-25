CREATE TYPE "TaskActivityType" AS ENUM (
  'CREATED',
  'UPDATED',
  'STATUS_CHANGED',
  'ASSIGNEE_CHANGED',
  'COMMENT_ADDED',
  'ARCHIVED',
  'DELETED'
);

CREATE TABLE "TaskComment" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "authorId" TEXT,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskActivity" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "type" "TaskActivityType" NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TaskActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskComment_workspaceId_createdAt_idx" ON "TaskComment"("workspaceId", "createdAt");
CREATE INDEX "TaskComment_taskId_createdAt_idx" ON "TaskComment"("taskId", "createdAt");
CREATE INDEX "TaskActivity_workspaceId_createdAt_idx" ON "TaskActivity"("workspaceId", "createdAt");
CREATE INDEX "TaskActivity_taskId_createdAt_idx" ON "TaskActivity"("taskId", "createdAt");

ALTER TABLE "TaskComment"
ADD CONSTRAINT "TaskComment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskComment"
ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskComment"
ADD CONSTRAINT "TaskComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TaskActivity"
ADD CONSTRAINT "TaskActivity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskActivity"
ADD CONSTRAINT "TaskActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskActivity"
ADD CONSTRAINT "TaskActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
