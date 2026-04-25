import crypto from "node:crypto";
import { WorkspaceInviteRole, WorkspaceRole } from "@prisma/client";

import { prisma } from "../lib/db.js";
import {
  canResetPasswords,
  getAuthContext,
  hashPassword,
  isWorkspaceOwner,
  workspaceWhere,
  workspaceWhereForUser,
  createTemporaryPassword,
} from "../lib/auth.js";
import { toApiAdminUser, toApiWorkspaceInvite } from "../lib/serializers.js";
import { sendWorkspaceInviteEmail } from "../services/email-service.js";
import {
  createWorkspaceMembership,
  updateWorkspaceMembershipRole,
  validateAdminUserInput,
  workspaceRoleMap,
} from "../services/workspace-service.js";
import { API_ROUTES } from "../../../../../src/shared/api-routes.js";
import type { AdminUserPayload, CreateWorkspaceInvitePayload } from "../../../../../src/shared/api-types.js";
import {
  getOrigin,
  getPathname,
  getProtocol,
  matchPath,
  methodNotAllowed,
  NativeRequest,
  NativeResponse,
  notFound,
  readJsonBody,
  rejectDisallowedBrowserOrigin,
  sendEmpty,
  sendJson,
} from "./http.js";

async function getAuth(request: NativeRequest, response: NativeResponse) {
  const auth = await getAuthContext(request as any);
  if (!auth) {
    sendJson(response, 401, { error: "Authentication required." });
    return null;
  }

  return auth;
}

function getInviteBaseUrl(request: NativeRequest) {
  const origin = getOrigin(request);
  if (origin) {
    return origin;
  }

  return `${getProtocol(request)}://${request.headers.host ?? "localhost"}`;
}

export default async function adminHandler(request: NativeRequest, response: NativeResponse) {
  const pathname = getPathname(request);
  const method = request.method ?? "GET";

  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && rejectDisallowedBrowserOrigin(request, response)) {
    return;
  }

  const auth = await getAuth(request, response);

  if (!auth) {
    return;
  }

  if (!(auth.user.isGodMode || auth.memberships.some((item) => item.workspaceId === auth.workspace.id))) {
    sendJson(response, 403, { error: "Admin access required." });
    return;
  }

  if (method === "GET" && pathname === API_ROUTES.admin.users) {
    const members = await prisma.workspaceMember.findMany({
      where: workspaceWhere(auth),
      include: { user: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });

    sendJson(response, 200, members.map((member) => toApiAdminUser(member)));
    return;
  }

  if (method === "POST" && pathname === API_ROUTES.admin.users) {
    const input = (await readJsonBody<Partial<AdminUserPayload>>(request)) ?? {};

    if (!validateAdminUserInput(input, true)) {
      sendJson(response, 400, { error: "Name, email, role, and an 8+ character password are required." });
      return;
    }

    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    const role = workspaceRoleMap[input.role];
    const passwordHash = hashPassword(input.password!.trim());

    if (role === WorkspaceRole.OWNER && !isWorkspaceOwner(auth)) {
      sendJson(response, 403, { error: "Only owners can create another owner." });
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

    sendJson(response, 201, toApiAdminUser(membership));
    return;
  }

  if (method === "GET" && pathname === API_ROUTES.admin.invites) {
    const invites = await prisma.workspaceInvite.findMany({
      where: workspaceWhere(auth),
      include: {
        workspace: true,
        invitedBy: { select: { name: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    sendJson(
      response,
      200,
      invites.map((invite) => toApiWorkspaceInvite(invite, getInviteBaseUrl(request))),
    );
    return;
  }

  if (method === "POST" && pathname === API_ROUTES.admin.invites) {
    const input = (await readJsonBody<Partial<CreateWorkspaceInvitePayload>>(request)) ?? {};

    if (typeof input.email !== "string" || !input.email.includes("@") || (input.role !== "user" && input.role !== "admin")) {
      sendJson(response, 400, { error: "Invite email and role are required." });
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

    sendJson(response, 201, toApiWorkspaceInvite(invite, getInviteBaseUrl(request)));
    return;
  }

  const inviteDeleteMatch = matchPath(pathname, "/api/admin/invites/:id");
  if (method === "DELETE" && inviteDeleteMatch) {
    const invite = await prisma.workspaceInvite.findFirst({
      where: {
        id: inviteDeleteMatch.id,
        ...workspaceWhere(auth),
      },
    });

    if (!invite) {
      sendJson(response, 404, { error: "Invite not found." });
      return;
    }

    await prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { revokedAt: new Date() },
    });

    sendEmpty(response);
    return;
  }

  const userMatch = matchPath(pathname, "/api/admin/users/:id");
  if (method === "PUT" && userMatch) {
    const input = (await readJsonBody<Partial<AdminUserPayload>>(request)) ?? {};

    if (!validateAdminUserInput(input, false)) {
      sendJson(response, 400, { error: "Name, email, and role are required." });
      return;
    }

    const existing = await prisma.workspaceMember.findFirst({
      where: workspaceWhereForUser(auth, userMatch.id),
      include: { user: true },
    });

    if (!existing) {
      sendJson(response, 404, { error: "User not found in this workspace." });
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
      sendJson(response, 409, { error: "Another user already uses that email." });
      return;
    }

    const role = workspaceRoleMap[input.role];

    if (role === WorkspaceRole.OWNER && !isWorkspaceOwner(auth)) {
      sendJson(response, 403, { error: "Only owners can promote a user to owner." });
      return;
    }

    if (existing.role === WorkspaceRole.OWNER && !isWorkspaceOwner(auth)) {
      sendJson(response, 403, { error: "Only owners can edit another owner." });
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
      include: { user: true },
    });

    if (role === WorkspaceRole.OWNER) {
      await prisma.workspace.update({
        where: { id: auth.workspace.id },
        data: { ownerId: user.id },
      });
    }

    sendJson(response, 200, toApiAdminUser(membership));
    return;
  }

  const resetMatch = matchPath(pathname, "/api/admin/users/:id/reset-password");
  if (method === "POST" && resetMatch) {
    if (!canResetPasswords(auth)) {
      sendJson(response, 403, { error: "Only owners can reset passwords." });
      return;
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: auth.allWorkspaces
        ? { userId: resetMatch.id }
        : { workspaceId: auth.workspace.id, userId: resetMatch.id },
      include: { user: true },
    });

    if (!membership) {
      sendJson(response, 404, { error: "User not found." });
      return;
    }

    const password = createTemporaryPassword();
    const passwordHash = hashPassword(password);

    await prisma.user.update({
      where: { id: membership.userId },
      data: { passwordHash },
    });

    sendJson(response, 200, { password });
    return;
  }

  if (pathname.startsWith("/api/admin")) {
    methodNotAllowed(response);
    return;
  }

  notFound(response);
}
