ALTER TABLE "AppConfig"
ADD COLUMN "directReportNameOptions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "AppConfig"
ADD COLUMN "directReportRoleOptions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
