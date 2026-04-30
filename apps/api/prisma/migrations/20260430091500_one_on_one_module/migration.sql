-- CreateEnum
CREATE TYPE "OneOnOneCadence" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'AD_HOC');

-- CreateEnum
CREATE TYPE "OneOnOneMeetingStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELED');

-- CreateTable
CREATE TABLE "DirectReport" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "managerUserId" TEXT NOT NULL,
    "teammateUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "cadence" "OneOnOneCadence" NOT NULL DEFAULT 'WEEKLY',
    "nextMeetingAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OneOnOneAgendaItem" (
    "id" TEXT NOT NULL,
    "directReportId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OneOnOneAgendaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OneOnOneMeeting" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "directReportId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "OneOnOneMeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "sharedNotes" TEXT NOT NULL DEFAULT '',
    "privateNotes" TEXT NOT NULL DEFAULT '',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OneOnOneMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DirectReport_workspaceId_managerUserId_teammateUserId_key" ON "DirectReport"("workspaceId", "managerUserId", "teammateUserId");

-- CreateIndex
CREATE INDEX "DirectReport_workspaceId_managerUserId_nextMeetingAt_idx" ON "DirectReport"("workspaceId", "managerUserId", "nextMeetingAt");

-- CreateIndex
CREATE INDEX "OneOnOneAgendaItem_directReportId_sortOrder_idx" ON "OneOnOneAgendaItem"("directReportId", "sortOrder");

-- CreateIndex
CREATE INDEX "OneOnOneMeeting_workspaceId_scheduledFor_idx" ON "OneOnOneMeeting"("workspaceId", "scheduledFor");

-- CreateIndex
CREATE INDEX "OneOnOneMeeting_directReportId_scheduledFor_idx" ON "OneOnOneMeeting"("directReportId", "scheduledFor");

-- AddForeignKey
ALTER TABLE "DirectReport" ADD CONSTRAINT "DirectReport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectReport" ADD CONSTRAINT "DirectReport_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectReport" ADD CONSTRAINT "DirectReport_teammateUserId_fkey" FOREIGN KEY ("teammateUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneOnOneAgendaItem" ADD CONSTRAINT "OneOnOneAgendaItem_directReportId_fkey" FOREIGN KEY ("directReportId") REFERENCES "DirectReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneOnOneMeeting" ADD CONSTRAINT "OneOnOneMeeting_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneOnOneMeeting" ADD CONSTRAINT "OneOnOneMeeting_directReportId_fkey" FOREIGN KEY ("directReportId") REFERENCES "DirectReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
