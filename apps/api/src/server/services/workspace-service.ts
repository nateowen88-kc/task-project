import crypto from "node:crypto";
import { Prisma, PrismaClient, WorkspaceRole } from "@prisma/client";
import { createUniqueWorkspaceSlug, hashPassword } from "../lib/auth.js";
import type { AdminWorkspace } from "../../../../../src/shared/api-types.js";

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

export type UpdateWorkspaceInput = {
  name: string;
  ownerUserId: string;
  allowMemberTaskCreation: boolean;
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

export function validateUpdateWorkspaceInput(input: Partial<UpdateWorkspaceInput>): input is UpdateWorkspaceInput {
  return (
    typeof input.name === "string" &&
    input.name.trim().length > 1 &&
    typeof input.ownerUserId === "string" &&
    input.ownerUserId.trim().length > 0 &&
    typeof input.allowMemberTaskCreation === "boolean"
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

type WorkspaceRecord = Prisma.WorkspaceGetPayload<{
  include: {
    owner: {
      select: {
        id: true;
        name: true;
        email: true;
      };
    };
    memberships: {
      include: {
        user: {
          select: {
            id: true;
            name: true;
            email: true;
          };
        };
      };
      orderBy: [{ role: "asc" }, { createdAt: "asc" }];
    };
  };
}>;

export function toApiAdminWorkspace(workspace: WorkspaceRecord): AdminWorkspace {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    ownerUserId: workspace.owner?.id ?? "",
    ownerName: workspace.owner?.name ?? "Unknown",
    ownerEmail: workspace.owner?.email ?? "",
    memberCount: workspace.memberships.length,
    deactivatedAt: workspace.deactivatedAt?.toISOString() ?? null,
    allowMemberTaskCreation: workspace.allowMemberTaskCreation,
    members: workspace.memberships.map((membership) => ({
      userId: membership.userId,
      name: membership.user.name,
      email: membership.user.email,
      role:
        membership.role === WorkspaceRole.OWNER
          ? "owner"
          : membership.role === WorkspaceRole.ADMIN
            ? "admin"
            : "user",
    })),
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
  };
}

export async function fetchWorkspaceForAdmin(tx: MembershipWriteClient, workspaceId: string) {
  return tx.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      },
    },
  });
}

export async function updateWorkspaceSettings(
  tx: MembershipWriteClient,
  workspaceId: string,
  input: UpdateWorkspaceInput,
) {
  const workspace = await fetchWorkspaceForAdmin(tx, workspaceId);

  if (!workspace) {
    throw new Error("Workspace not found.");
  }

  const nextOwnerMembership = workspace.memberships.find((item) => item.userId === input.ownerUserId);

  if (!nextOwnerMembership) {
    throw new Error("The selected owner must already be a member of the workspace.");
  }

  await tx.workspace.update({
    where: { id: workspace.id },
    data: {
      name: input.name.trim(),
      ownerId: input.ownerUserId,
      allowMemberTaskCreation: input.allowMemberTaskCreation,
    },
  });

  if (nextOwnerMembership.role !== WorkspaceRole.OWNER) {
    await updateWorkspaceMembershipRole(tx, nextOwnerMembership.id, WorkspaceRole.OWNER);
  }

  const previousOwnerMembership = workspace.memberships.find(
    (item) => item.role === WorkspaceRole.OWNER && item.userId !== input.ownerUserId,
  );

  if (previousOwnerMembership) {
    await updateWorkspaceMembershipRole(tx, previousOwnerMembership.id, WorkspaceRole.ADMIN);
  }

  const updatedWorkspace = await fetchWorkspaceForAdmin(tx, workspace.id);

  if (!updatedWorkspace) {
    throw new Error("Workspace not found.");
  }

  return updatedWorkspace;
}
