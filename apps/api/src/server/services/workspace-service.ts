import crypto from "node:crypto";
import { Prisma, PrismaClient, WorkspaceRole } from "@prisma/client";

export type WorkspaceRoleValue = "owner" | "admin" | "user";

export type AdminUserInput = {
  name: string;
  email: string;
  password?: string;
  role: WorkspaceRoleValue;
};

export type MembershipWriteClient = Prisma.TransactionClient | PrismaClient;

export const workspaceRoleMap: Record<WorkspaceRoleValue, WorkspaceRole> = {
  owner: WorkspaceRole.OWNER,
  admin: WorkspaceRole.ADMIN,
  user: WorkspaceRole.USER,
};

function isValidWorkspaceRole(value: string): value is WorkspaceRoleValue {
  return value in workspaceRoleMap;
}

export function validateAdminUserInput(input: Partial<AdminUserInput>, requirePassword: boolean): input is AdminUserInput {
  return (
    typeof input.name === "string" &&
    input.name.trim().length > 1 &&
    typeof input.email === "string" &&
    input.email.includes("@") &&
    typeof input.role === "string" &&
    isValidWorkspaceRole(input.role) &&
    (!requirePassword || (typeof input.password === "string" && input.password.length >= 8))
  );
}

export async function createWorkspaceMembership(
  tx: MembershipWriteClient,
  userId: string,
  workspaceId: string,
  role: WorkspaceRole,
) {
  const membershipId = crypto.randomUUID();

  await tx.$executeRaw`
    INSERT INTO "WorkspaceMember" ("id", "userId", "workspaceId", "role", "createdAt", "updatedAt")
    VALUES (${membershipId}, ${userId}, ${workspaceId}, CAST(${role} AS "WorkspaceRole"), NOW(), NOW())
  `;

  return tx.workspaceMember.findUniqueOrThrow({
    where: { id: membershipId },
    include: { user: true },
  });
}

export async function updateWorkspaceMembershipRole(
  tx: MembershipWriteClient,
  membershipId: string,
  role: WorkspaceRole,
) {
  await tx.$executeRaw`
    UPDATE "WorkspaceMember"
    SET "role" = CAST(${role} AS "WorkspaceRole"),
        "updatedAt" = NOW()
    WHERE "id" = ${membershipId}
  `;
}
