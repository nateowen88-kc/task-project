import crypto from "node:crypto";
import express from "express";
import { Prisma, WorkspaceInviteRole, WorkspaceRole } from "@prisma/client";

import { prisma } from "../lib/db.js";
import { API_ROUTES } from "../../../../../src/shared/api-routes.js";
import type {
  AcceptWorkspaceInvitePayload,
  LoginPayload,
  RegisterPayload,
  SwitchWorkspacePayload,
} from "../../../../../src/shared/api-types.js";
import {
  authOf,
  buildAuthContext,
  clearSessionCookie,
  createSession,
  createUniqueWorkspaceSlug,
  getAuthContext,
  hashToken,
  hashPassword,
  parseCookies,
  requireAuth,
  serializeSessionCookie,
  toApiSession,
  verifyPassword,
} from "../lib/auth.js";
import { toApiWorkspaceInvite } from "../lib/serializers.js";

function validateLoginInput(input: Partial<LoginPayload>): input is LoginPayload {
  return typeof input.email === "string" && typeof input.password === "string";
}

function validateRegisterInput(input: Partial<RegisterPayload>): input is RegisterPayload {
  return (
    typeof input.email === "string" &&
    input.email.includes("@") &&
    typeof input.name === "string" &&
    input.name.trim().length > 1 &&
    typeof input.password === "string" &&
    input.password.length >= 8
  );
}

function validateAcceptInviteInput(input: Partial<AcceptWorkspaceInvitePayload>): input is AcceptWorkspaceInvitePayload {
  return (
    typeof input.token === "string" &&
    input.token.trim().length > 0 &&
    typeof input.email === "string" &&
    input.email.includes("@") &&
    typeof input.name === "string" &&
    input.name.trim().length > 1 &&
    typeof input.password === "string" &&
    input.password.length >= 8
  );
}

function getInviteBaseUrl(request: express.Request) {
  const origin = request.header("origin");
  if (origin) {
    return origin;
  }

  const protocol = request.header("x-forwarded-proto") ?? request.protocol;
  return `${protocol}://${request.get("host")}`;
}

async function createWorkspaceMembership(
  tx: Prisma.TransactionClient,
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

export function createAuthRouter() {
  const router = express.Router();

  router.get(API_ROUTES.auth.me.replace("/api/auth", ""), async (request, response) => {
    try {
      const auth = await getAuthContext(request);
      if (!auth) {
        response.status(401).json({ error: "Not signed in." });
        return;
      }

      response.json(await toApiSession(auth.user, auth.workspace.id));
    } catch (error) {
      console.error("[auth] failed to load session", error);
      response.setHeader("Set-Cookie", clearSessionCookie());
      response.status(401).json({ error: "Session expired. Please sign in again." });
    }
  });

  router.patch(API_ROUTES.auth.workspace.replace("/api/auth", ""), requireAuth, async (request, response) => {
    const auth = authOf(request);
    const workspaceId = (request.body as Partial<SwitchWorkspacePayload>).workspaceId;

    if (typeof workspaceId !== "string" || workspaceId.trim().length === 0) {
      response.status(400).json({ error: "workspaceId is required." });
      return;
    }

    const targetWorkspaceId = workspaceId.trim();

    if (auth.user.isGodMode) {
      const workspace = await prisma.workspace.findFirst({
        where: {
          id: targetWorkspaceId,
          deactivatedAt: null,
        },
      });
      if (!workspace) {
        response.status(404).json({ error: "Workspace not found." });
        return;
      }
    } else {
      const membership = auth.memberships.find(
        (item) => item.workspaceId === targetWorkspaceId && !item.workspace.deactivatedAt,
      );
      if (!membership) {
        response.status(403).json({ error: "You do not have access to that workspace." });
        return;
      }
    }

    await prisma.user.update({
      where: { id: auth.user.id },
      data: {
        defaultWorkspaceId: targetWorkspaceId,
      },
    });

    const updatedAuth = await buildAuthContext(auth.user.id);

    if (!updatedAuth) {
      response.status(404).json({ error: "Unable to load updated workspace context." });
      return;
    }

    response.json(await toApiSession(updatedAuth.user, targetWorkspaceId));
  });

  router.post(API_ROUTES.auth.register.replace("/api/auth", ""), async (request, response) => {
    const input = request.body as Partial<RegisterPayload>;

    if (!validateRegisterInput(input)) {
      response.status(400).json({ error: "Name, email, and an 8+ character password are required." });
      return;
    }

    const email = input.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      response.status(409).json({ error: "An account with that email already exists." });
      return;
    }

    const name = input.name.trim();
    const workspaceName = input.workspaceName?.trim() || `${name}'s Workspace`;
    const passwordHash = hashPassword(input.password);

    const user = await prisma.$transaction(async (tx) => {
      const userCount = await tx.user.count();
      const createdUser = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
        },
      });

      let workspace: Prisma.WorkspaceGetPayload<object>;

      if (userCount === 0) {
        const legacy = await tx.workspace.findUnique({ where: { id: "legacy-workspace" } });
        if (legacy) {
          const slug = await createUniqueWorkspaceSlug(workspaceName, tx);
          workspace = await tx.workspace.update({
            where: { id: legacy.id },
            data: {
              name: workspaceName,
              slug,
              ownerId: createdUser.id,
            },
          });
        } else {
          workspace = await tx.workspace.create({
            data: {
              name: workspaceName,
              slug: await createUniqueWorkspaceSlug(workspaceName, tx),
              ownerId: createdUser.id,
            },
          });
        }
      } else {
        workspace = await tx.workspace.create({
          data: {
            name: workspaceName,
            slug: await createUniqueWorkspaceSlug(workspaceName, tx),
            ownerId: createdUser.id,
          },
        });
      }

      await createWorkspaceMembership(tx, createdUser.id, workspace.id, WorkspaceRole.OWNER);

      await tx.user.update({
        where: { id: createdUser.id },
        data: {
          defaultWorkspaceId: workspace.id,
        },
      });

      return createdUser;
    });

    const session = await createSession(user.id);
    response.setHeader("Set-Cookie", serializeSessionCookie(session.token, session.expiresAt));
    const auth = await buildAuthContext(user.id);
    response.status(201).json(await toApiSession(auth!.user, auth!.workspace.id));
  });

  router.get("/invite/:token", async (request, response) => {
    const invite = await prisma.workspaceInvite.findUnique({
      where: { token: request.params.token },
      include: {
        workspace: true,
        invitedBy: { select: { name: true } },
      },
    });

    if (!invite || invite.revokedAt || invite.acceptedAt || invite.expiresAt <= new Date()) {
      response.status(404).json({ error: "Invite not found or no longer valid." });
      return;
    }

    response.json({
      invite: toApiWorkspaceInvite(invite, getInviteBaseUrl(request)),
    });
  });

  router.post("/accept-invite", async (request, response) => {
    const input = request.body as Partial<AcceptWorkspaceInvitePayload>;

    if (!validateAcceptInviteInput(input)) {
      response.status(400).json({ error: "Invite token, name, email, and an 8+ character password are required." });
      return;
    }

    const token = input.token.trim();
    const email = input.email.trim().toLowerCase();
    const invite = await prisma.workspaceInvite.findUnique({
      where: { token },
    });

    if (!invite || invite.revokedAt || invite.acceptedAt || invite.expiresAt <= new Date()) {
      response.status(404).json({ error: "Invite not found or no longer valid." });
      return;
    }

    if (invite.email.trim().toLowerCase() !== email) {
      response.status(400).json({ error: "Invite email does not match." });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser && !verifyPassword(input.password, existingUser.passwordHash)) {
      response.status(401).json({ error: "Existing account password does not match." });
      return;
    }

    const user = await prisma.$transaction(async (tx) => {
      const currentUser =
        existingUser ??
        (await tx.user.create({
          data: {
            email,
            name: input.name.trim(),
            passwordHash: hashPassword(input.password),
          },
        }));

      const existingMembership = await tx.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: currentUser.id,
            workspaceId: invite.workspaceId,
          },
        },
      });

      if (existingMembership) {
        throw new Error("User is already a member of this workspace.");
      }

      await createWorkspaceMembership(
        tx,
        currentUser.id,
        invite.workspaceId,
        invite.role === WorkspaceInviteRole.ADMIN ? WorkspaceRole.ADMIN : WorkspaceRole.USER,
      );

      await tx.workspaceInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      await tx.user.update({
        where: { id: currentUser.id },
        data: {
          name: existingUser ? currentUser.name : input.name.trim(),
          defaultWorkspaceId: currentUser.defaultWorkspaceId ?? invite.workspaceId,
        },
      });

      return currentUser;
    }).catch((error: unknown) => {
      if (error instanceof Error && error.message === "User is already a member of this workspace.") {
        return null;
      }
      throw error;
    });

    if (!user) {
      response.status(409).json({ error: "This account is already a member of the workspace." });
      return;
    }

    const session = await createSession(user.id);
    response.setHeader("Set-Cookie", serializeSessionCookie(session.token, session.expiresAt));
    const auth = await buildAuthContext(user.id);
    response.status(201).json(await toApiSession(auth!.user, invite.workspaceId));
  });

  router.post(API_ROUTES.auth.login.replace("/api/auth", ""), async (request, response) => {
    const input = request.body as Partial<LoginPayload>;

    if (!validateLoginInput(input)) {
      response.status(400).json({ error: "Email and password are required." });
      return;
    }

    const email = input.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      response.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const auth = await buildAuthContext(user.id);

    if (!auth) {
      response.status(403).json({
        error: "This account is not assigned to a workspace yet.",
      });
      return;
    }

    const session = await createSession(user.id);
    response.setHeader("Set-Cookie", serializeSessionCookie(session.token, session.expiresAt));
    response.json(await toApiSession(auth.user, auth.workspace.id));
  });

  router.post(API_ROUTES.auth.logout.replace("/api/auth", ""), async (request, response) => {
    const token = parseCookies(request).get("timesmith_session");
    if (token) {
      await prisma.session.deleteMany({
        where: {
          tokenHash: hashToken(token),
        },
      });
    }

    response.setHeader("Set-Cookie", clearSessionCookie());
    response.status(204).send();
  });

  return router;
}
