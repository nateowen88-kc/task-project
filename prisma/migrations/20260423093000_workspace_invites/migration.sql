CREATE TYPE "WorkspaceInviteRole" AS ENUM ('ADMIN', 'USER');

CREATE TABLE "WorkspaceInvite" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "WorkspaceInviteRole" NOT NULL DEFAULT 'USER',
  "token" TEXT NOT NULL,
  "invitedById" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkspaceInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceInvite_token_key" ON "WorkspaceInvite"("token");
CREATE INDEX "WorkspaceInvite_workspaceId_email_createdAt_idx" ON "WorkspaceInvite"("workspaceId", "email", "createdAt");
CREATE INDEX "WorkspaceInvite_workspaceId_expiresAt_idx" ON "WorkspaceInvite"("workspaceId", "expiresAt");

ALTER TABLE "WorkspaceInvite"
  ADD CONSTRAINT "WorkspaceInvite_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceInvite"
  ADD CONSTRAINT "WorkspaceInvite_invitedById_fkey"
  FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
