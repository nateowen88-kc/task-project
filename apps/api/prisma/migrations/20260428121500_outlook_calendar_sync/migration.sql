CREATE TYPE "CalendarProvider" AS ENUM ('OUTLOOK');

ALTER TABLE "AppConfig"
ADD COLUMN "outlookClientId" TEXT,
ADD COLUMN "outlookClientSecret" TEXT,
ADD COLUMN "outlookTenantId" TEXT;

CREATE TABLE "CalendarConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "CalendarProvider" NOT NULL,
  "externalAccountEmail" TEXT,
  "accessToken" TEXT NOT NULL,
  "refreshToken" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CalendarConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CalendarConnection_userId_provider_key" ON "CalendarConnection"("userId", "provider");
CREATE INDEX "CalendarConnection_provider_expiresAt_idx" ON "CalendarConnection"("provider", "expiresAt");

ALTER TABLE "CalendarConnection"
ADD CONSTRAINT "CalendarConnection_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
