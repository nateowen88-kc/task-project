import crypto from "node:crypto";
import express from "express";
import { WorkspaceInviteRole, WorkspaceRole } from "@prisma/client";

import {
  authOf,
  canResetPasswords,
  isWorkspaceOwner,
  requireAuth,
  workspaceWhere,
  workspaceWhereForUser,
} from "../lib/auth.js";
import { prisma } from "../lib/db.js";
import { toApiAdminUser, toApiWorkspaceInvite } from "../lib/serializers.js";
import { hashPassword } from "../lib/auth.js";
import { API_ROUTES } from "../../../../../src/shared/api-routes.js";
import type {
  AdminAppConfig,
  AdminUserPayload,
  CreateWorkspaceInvitePayload,
  CreateWorkspacePayload,
  UpdateWorkspacePayload,
  UpdateWorkspaceStatusPayload,
} from "../../../../../src/shared/api-types.js";
import {
  sendAccountSetupEmail,
  sendPasswordRecoveryEmail,
  sendWorkspaceInviteEmail,
} from "../services/email-service.js";
import {
  createWorkspaceWithOwner,
  createWorkspaceMembership,
  fetchWorkspaceForAdmin,
  toApiAdminWorkspace,
  updateWorkspaceMembershipRole,
  updateWorkspaceSettings,
  validateAdminUserInput,
  validateCreateWorkspaceInput,
  validateUpdateWorkspaceInput,
  workspaceRoleMap,
} from "../services/workspace-service.js";
import {
  getAdminAppConfig,
  resolveAppBaseUrl,
  updateAdminAppConfig,
  validateUpdateAppConfigInput,
} from "../services/app-config-service.js";
import { createPasswordResetToken } from "../services/password-reset-service.js";
import { PasswordResetTokenType } from "@prisma/client";

export function createAdminRouter() {
  const router = express.Router();

  function getInviteBaseUrl(request: express.Request) {
    const origin = request.header("origin");
    if (origin) {
      return origin;
    }

    const protocol = request.header("x-forwarded-proto") ?? request.protocol;
    return `${protocol}://${request.get("host")}`;
  }

  function requireGodMode(request: express.Request, response: express.Response) {
    const auth = authOf(request);
    if (!auth.user.isGodMode) {
      response.status(403).json({ error: "Only god mode admins can manage workspaces." });
      return null;
    }

    return auth;
  }

  router.get(API_ROUTES.admin.users.replace("/api/admin", ""), async (request, response) => {
    const auth = authOf(request);
    const members = await prisma.workspaceMember.findMany({
      where: workspaceWhere(auth),
      include: {
        user: true,
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });

    response.json(members.map((member) => toApiAdminUser(member)));
  });

  router.post(API_ROUTES.admin.users.replace("/api/admin", ""), async (request, response) => {
    const auth = authOf(request);
    const input = request.body as Partial<AdminUserPayload>;

    if (!validateAdminUserInput(input, true)) {
      response.status(400).json({ error: "Name, email, role, and an 8+ character password are required." });
      return;
    }

    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    const role = workspaceRoleMap[input.role];
    const password = input.password!.trim();
    const passwordHash = hashPassword(password);

    if (role === WorkspaceRole.OWNER && !isWorkspaceOwner(auth)) {
      response.status(403).json({ error: "Only owners can create another owner." });
      return;
    }

    const membership = await prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email } });

      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            name,
            passwordHash,
            defaultWorkspaceId: auth.workspace.id,
          },
        });
      } else {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            name,
            passwordHash,
            defaultWorkspaceId: user.defaultWorkspaceId ?? auth.workspace.id,
          },
        });
      }

      const existingMembership = await tx.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: user.id,
            workspaceId: auth.workspace.id,
          },
        },
      });

      if (existingMembership) {
        await updateWorkspaceMembershipRole(tx, existingMembership.id, role);
        return tx.workspaceMember.findUniqueOrThrow({
          where: { id: existingMembership.id },
          include: { user: true },
        });
      }

      return createWorkspaceMembership(tx, user.id, auth.workspace.id, role);
    });

    if (role === WorkspaceRole.OWNER) {
      await prisma.workspace.update({
        where: { id: auth.workspace.id },
        data: { ownerId: membership.userId },
      });
    }

    try {
      const { token } = await createPasswordResetToken(membership.userId, PasswordResetTokenType.ACCOUNT_SETUP);
      const baseUrl = await resolveAppBaseUrl(request.header("origin"));
      if (baseUrl) {
        await sendAccountSetupEmail({
          to: membership.user.email,
          recipientName: membership.user.name,
          workspaceName: auth.workspace.name,
          setupUrl: `${baseUrl}/?reset=${encodeURIComponent(token)}`,
        });
      }
    } catch (error) {
      console.error("[email] failed to send account setup email", error);
    }

    response.status(201).json(toApiAdminUser(membership));
  });

  router.get(API_ROUTES.admin.invites.replace("/api/admin", ""), async (request, response) => {
    const auth = authOf(request);
    const invites = await prisma.workspaceInvite.findMany({
      where: workspaceWhere(auth),
      include: {
        workspace: true,
        invitedBy: { select: { name: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    response.json(invites.map((invite) => toApiWorkspaceInvite(invite, getInviteBaseUrl(request))));
  });

  router.post(API_ROUTES.admin.invites.replace("/api/admin", ""), async (request, response) => {
    const auth = authOf(request);
    const input = request.body as Partial<CreateWorkspaceInvitePayload>;

    if (typeof input.email !== "string" || !input.email.includes("@") || (input.role !== "user" && input.role !== "admin")) {
      response.status(400).json({ error: "Invite email and role are required." });
      return;
    }

    const email = input.email.trim().toLowerCase();
    const token = crypto.randomBytes(24).toString("hex");
    const invite = await prisma.workspaceInvite.create({
      data: {
        workspaceId: auth.workspace.id,
        email,
        role: input.role === "admin" ? WorkspaceInviteRole.ADMIN : WorkspaceInviteRole.USER,
        token,
        invitedById: auth.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      include: {
        workspace: true,
        invitedBy: { select: { name: true } },
      },
    });

    try {
      await sendWorkspaceInviteEmail({
        to: invite.email,
        inviteUrl: toApiWorkspaceInvite(invite, getInviteBaseUrl(request)).inviteUrl,
        workspaceName: invite.workspace.name,
        inviterName: auth.user.name,
        role: invite.role === WorkspaceInviteRole.ADMIN ? "admin" : "user",
      });
    } catch (error) {
      console.error("[email] failed to send workspace invite", error);
    }

    response.status(201).json(toApiWorkspaceInvite(invite, getInviteBaseUrl(request)));
  });

  router.post(API_ROUTES.admin.workspaces.replace("/api/admin", ""), async (request, response) => {
    const auth = requireGodMode(request, response);
    if (!auth) {
      return;
    }

    const input = request.body as Partial<CreateWorkspacePayload>;

    if (!validateCreateWorkspaceInput(input)) {
      response.status(400).json({
        error: "Workspace name, owner name, owner email, and an 8+ character owner password are required.",
      });
      return;
    }

    try {
      const result = await prisma.$transaction((tx) => createWorkspaceWithOwner(tx, input));
      const workspace = await fetchWorkspaceForAdmin(prisma, result.workspace.id);
      try {
        const { token } = await createPasswordResetToken(result.owner.id, PasswordResetTokenType.ACCOUNT_SETUP);
        const baseUrl = await resolveAppBaseUrl(request.header("origin"));
        if (baseUrl && workspace) {
          await sendAccountSetupEmail({
            to: result.owner.email,
            recipientName: result.owner.name,
            workspaceName: workspace.name,
            setupUrl: `${baseUrl}/?reset=${encodeURIComponent(token)}`,
          });
        }
      } catch (error) {
        console.error("[email] failed to send workspace owner setup email", error);
      }
      response.status(201).json(workspace ? toApiAdminWorkspace(workspace) : null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create workspace.";
      const status = message.includes("God mode users") ? 409 : 400;
      response.status(status).json({ error: message });
    }
  });

  router.get(API_ROUTES.admin.workspaces.replace("/api/admin", ""), async (request, response) => {
    const auth = requireGodMode(request, response);
    if (!auth) {
      return;
    }

    const workspaces = await prisma.workspace.findMany({
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
      orderBy: [{ createdAt: "asc" }],
    });

    response.json(workspaces.map((workspace) => toApiAdminWorkspace(workspace)));
  });

  router.delete("/invites/:id", async (request, response) => {
    const auth = authOf(request);
    const invite = await prisma.workspaceInvite.findFirst({
      where: {
        id: request.params.id,
        ...workspaceWhere(auth),
      },
    });

    if (!invite) {
      response.status(404).json({ error: "Invite not found." });
      return;
    }

    await prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { revokedAt: new Date() },
    });

    response.status(204).send();
  });

  router.put("/users/:id", async (request, response) => {
    const auth = authOf(request);
    const input = request.body as Partial<AdminUserPayload>;

    if (!validateAdminUserInput(input, false)) {
      response.status(400).json({ error: "Name, email, and role are required." });
      return;
    }

    const existing = await prisma.workspaceMember.findFirst({
      where: workspaceWhereForUser(auth, request.params.id),
      include: {
        user: true,
      },
    });

    if (!existing) {
      response.status(404).json({ error: "User not found in this workspace." });
      return;
    }

    const email = input.email.trim().toLowerCase();
    const duplicateEmail = await prisma.user.findFirst({
      where: {
        email,
        id: { not: existing.userId },
      },
      select: { id: true },
    });

    if (duplicateEmail) {
      response.status(409).json({ error: "Another user already uses that email." });
      return;
    }

    const role = workspaceRoleMap[input.role];

    if (role === WorkspaceRole.OWNER && !isWorkspaceOwner(auth)) {
      response.status(403).json({ error: "Only owners can promote a user to owner." });
      return;
    }

    if (existing.role === WorkspaceRole.OWNER && !isWorkspaceOwner(auth)) {
      response.status(403).json({ error: "Only owners can edit another owner." });
      return;
    }
    const user = await prisma.user.update({
      where: { id: existing.userId },
      data: {
        name: input.name.trim(),
        email,
        ...(typeof input.password === "string" && input.password.trim().length >= 8
          ? { passwordHash: hashPassword(input.password.trim()) }
          : {}),
      },
    });

    await updateWorkspaceMembershipRole(prisma, existing.id, role);

    const membership = await prisma.workspaceMember.findUniqueOrThrow({
      where: { id: existing.id },
      include: {
        user: true,
      },
    });

    if (role === WorkspaceRole.OWNER) {
      await prisma.workspace.update({
        where: { id: auth.workspace.id },
        data: { ownerId: user.id },
      });
    }

    response.json(toApiAdminUser(membership));
  });

  router.post("/users/:id/reset-password", requireAuth, async (request, response) => {
    const auth = authOf(request);
    const targetUserId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;

    if (!canResetPasswords(auth)) {
      response.status(403).json({ error: "Only owners can reset passwords." });
      return;
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: auth.allWorkspaces
        ? { userId: targetUserId }
        : { workspaceId: auth.workspace.id, userId: targetUserId },
      include: {
        user: true,
      },
    });

    if (!membership) {
      response.status(404).json({ error: "User not found." });
      return;
    }

    const { token } = await createPasswordResetToken(membership.userId, PasswordResetTokenType.PASSWORD_RECOVERY);
    const baseUrl = await resolveAppBaseUrl(request.header("origin"));

    if (baseUrl) {
      try {
        await sendPasswordRecoveryEmail({
          to: membership.user.email,
          recipientName: membership.user.name,
          resetUrl: `${baseUrl}/?reset=${encodeURIComponent(token)}`,
        });
        response.json({ emailSent: true });
        return;
      } catch (error) {
        console.error("[email] failed to send password recovery email", error);
      }
    }

    response.json({ emailSent: false });
  });

  router.get(API_ROUTES.admin.appConfig.replace("/api/admin", ""), async (request, response) => {
    const auth = requireGodMode(request, response);
    if (!auth) {
      return;
    }

    response.json(await getAdminAppConfig());
  });

  router.put(API_ROUTES.admin.appConfig.replace("/api/admin", ""), async (request, response) => {
    const auth = requireGodMode(request, response);
    if (!auth) {
      return;
    }

    const input = request.body as Partial<AdminAppConfig>;

    if (!validateUpdateAppConfigInput(input)) {
      response.status(400).json({ error: "Invalid app configuration payload." });
      return;
    }

    response.json(await updateAdminAppConfig(input));
  });

  router.put("/workspaces/:id", async (request, response) => {
    const auth = requireGodMode(request, response);
    if (!auth) {
      return;
    }

    const input = request.body as Partial<UpdateWorkspacePayload>;

    if (!validateUpdateWorkspaceInput(input)) {
      response.status(400).json({ error: "Workspace name, owner, and workspace settings are required." });
      return;
    }

    try {
      const workspace = await prisma.$transaction((tx) => updateWorkspaceSettings(tx, request.params.id, input));
      response.json(toApiAdminWorkspace(workspace));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update workspace.";
      const status = message.includes("not found") ? 404 : 400;
      response.status(status).json({ error: message });
    }
  });

  router.patch("/workspaces/:id/status", async (request, response) => {
    const auth = requireGodMode(request, response);
    if (!auth) {
      return;
    }

    const input = request.body as Partial<UpdateWorkspaceStatusPayload>;

    if (typeof input.isActive !== "boolean") {
      response.status(400).json({ error: "isActive is required." });
      return;
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: request.params.id },
      select: { id: true, deactivatedAt: true },
    });

    if (!workspace) {
      response.status(404).json({ error: "Workspace not found." });
      return;
    }

    if (!input.isActive) {
      const remainingActiveCount = await prisma.workspace.count({
        where: {
          deactivatedAt: null,
          id: { not: workspace.id },
        },
      });

      if (remainingActiveCount === 0) {
        response.status(400).json({ error: "You cannot deactivate the last active workspace." });
        return;
      }
    }

    await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        deactivatedAt: input.isActive ? null : new Date(),
      },
    });

    const updatedWorkspace = await fetchWorkspaceForAdmin(prisma, workspace.id);
    response.json(updatedWorkspace ? toApiAdminWorkspace(updatedWorkspace) : null);
  });

  return router;
}
