-- CreateTable
CREATE TABLE "TaskTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "importance" "TaskImportance" NOT NULL DEFAULT 'MEDIUM',
    "dueDaysOffset" INTEGER NOT NULL DEFAULT 0,
    "remindDaysOffset" INTEGER,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" "RecurrenceRule",
    "links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskPlaybook" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskPlaybook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskPlaybookItem" (
    "id" TEXT NOT NULL,
    "playbookId" TEXT NOT NULL,
    "templateTaskId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "importance" "TaskImportance" NOT NULL DEFAULT 'MEDIUM',
    "dueDaysOffset" INTEGER NOT NULL DEFAULT 0,
    "remindDaysOffset" INTEGER,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" "RecurrenceRule",
    "links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskPlaybookItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskTemplate_workspaceId_name_idx" ON "TaskTemplate"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TaskTemplate_workspaceId_name_key" ON "TaskTemplate"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "TaskPlaybook_workspaceId_name_idx" ON "TaskPlaybook"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TaskPlaybook_workspaceId_name_key" ON "TaskPlaybook"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "TaskPlaybookItem_playbookId_sortOrder_idx" ON "TaskPlaybookItem"("playbookId", "sortOrder");

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPlaybook" ADD CONSTRAINT "TaskPlaybook_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPlaybook" ADD CONSTRAINT "TaskPlaybook_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPlaybookItem" ADD CONSTRAINT "TaskPlaybookItem_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "TaskPlaybook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPlaybookItem" ADD CONSTRAINT "TaskPlaybookItem_templateTaskId_fkey" FOREIGN KEY ("templateTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
