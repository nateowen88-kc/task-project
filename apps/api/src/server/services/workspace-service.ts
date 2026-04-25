import crypto from "node:crypto";
import { Prisma, PrismaClient, WorkspaceRole } from "@prisma/client";
import { createUniqueWorkspaceSlug, hashPassword } from "../lib/auth.js";

export type WorkspaceRoleValue = "owner" | "admin" | "user";

export type AdminUserInput = {
  name: string;
  email: string;
  password?: string;
  role: WorkspaceRoleValue;
};

export type CreateWorkspaceInput = {
  workspaceName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
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

export function validateCreateWorkspaceInput(input: Partial<CreateWorkspaceInput>): input is CreateWorkspaceInput {
  return (
    typeof input.workspaceName === "string" &&
    input.workspaceName.trim().length > 1 &&
    typeof input.ownerName === "string" &&
    input.ownerName.trim().length > 1 &&
    typeof input.ownerEmail === "string" &&
    input.ownerEmail.includes("@") &&
    typeof input.ownerPassword === "string" &&
    input.ownerPassword.trim().length >= 8
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

export async function createWorkspaceWithOwner(
  tx: MembershipWriteClient,
  input: CreateWorkspaceInput,
) {
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  const ownerName = input.ownerName.trim();
  const ownerPasswordHash = hashPassword(input.ownerPassword.trim());

  let owner = await tx.user.findUnique({
    where: { email: ownerEmail },
  });

  if (!owner) {
    owner = await tx.user.create({
      data: {
        email: ownerEmail,
        name: ownerName,
        passwordHash: ownerPasswordHash,
      },
    });
  } else {
    if (owner.isGodMode) {
      throw new Error("God mode users cannot be assigned as workspace owners.");
    }

    owner = await tx.user.update({
      where: { id: owner.id },
      data: {
        name: ownerName,
        passwordHash: ownerPasswordHash,
      },
    });
  }

  const workspace = await tx.workspace.create({
    data: {
      name: input.workspaceName.trim(),
      slug: await createUniqueWorkspaceSlug(input.workspaceName.trim(), tx as Prisma.TransactionClient),
      ownerId: owner.id,
    },
  });

  await createWorkspaceMembership(tx, owner.id, workspace.id, WorkspaceRole.OWNER);

  if (!owner.defaultWorkspaceId) {
    owner = await tx.user.update({
      where: { id: owner.id },
      data: { defaultWorkspaceId: workspace.id },
    });
  }

  return {
    workspace,
    owner,
  };
}
