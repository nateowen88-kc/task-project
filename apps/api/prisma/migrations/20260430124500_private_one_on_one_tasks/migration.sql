ALTER TABLE "Task"
ADD COLUMN "directReportId" TEXT,
ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_directReportId_fkey"
FOREIGN KEY ("directReportId") REFERENCES "DirectReport"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "Task_directReportId_status_idx" ON "Task"("directReportId", "status");
