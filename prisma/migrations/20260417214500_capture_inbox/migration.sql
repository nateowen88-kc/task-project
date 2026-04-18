CREATE TYPE "CaptureSourceType" AS ENUM ('SLACK', 'EMAIL');

CREATE TYPE "CaptureStatus" AS ENUM ('NEW', 'ACCEPTED', 'DISCARDED');

CREATE TABLE "CapturedItem" (
    "id" TEXT NOT NULL,
    "sourceType" "CaptureSourceType" NOT NULL,
    "status" "CaptureStatus" NOT NULL DEFAULT 'NEW',
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "sourceLabel" TEXT,
    "sourceUrl" TEXT,
    "sender" TEXT,
    "suggestedDueDate" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "discardedAt" TIMESTAMP(3),
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapturedItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CapturedItem_status_receivedAt_idx" ON "CapturedItem"("status", "receivedAt");
CREATE INDEX "CapturedItem_sourceType_receivedAt_idx" ON "CapturedItem"("sourceType", "receivedAt");

ALTER TABLE "CapturedItem" ADD CONSTRAINT "CapturedItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
