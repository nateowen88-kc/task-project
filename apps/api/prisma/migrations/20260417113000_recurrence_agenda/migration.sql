-- CreateEnum
CREATE TYPE "RecurrenceRule" AS ENUM ('DAILY', 'WEEKDAYS', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "Task"
ADD COLUMN "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "plannedForDate" TIMESTAMP(3),
ADD COLUMN "recurrenceRule" "RecurrenceRule",
ADD COLUMN "remindAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TaskOccurrence" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_plannedForDate_status_idx" ON "Task"("plannedForDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TaskOccurrence_taskId_scheduledFor_key" ON "TaskOccurrence"("taskId", "scheduledFor");

-- CreateIndex
CREATE INDEX "TaskOccurrence_scheduledFor_status_idx" ON "TaskOccurrence"("scheduledFor", "status");

-- AddForeignKey
ALTER TABLE "TaskOccurrence"
ADD CONSTRAINT "TaskOccurrence_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
