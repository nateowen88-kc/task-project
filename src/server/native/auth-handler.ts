import crypto from "node:crypto";
import { Prisma, WorkspaceInviteRole, WorkspaceRole } from "@prisma/client";

import { prisma } from "../lib/db.js";
import {
  buildAuthContext,
  clearSessionCookie,
  createSession,
  createUniqueWorkspaceSlug,
  getAuthContext,
  hashPassword,
  hashToken,
  parseCookies,
  serializeSessionCookie,
  toApiSession,
  verifyPassword,
} from "../lib/auth.js";
import { toApiWorkspaceInvite } from "../lib/serializers.js";
import { API_ROUTES } from "../../shared/api-routes.js";
import type {
  AcceptWorkspaceInvitePayload,
  LoginPayload,
  RegisterPayload,
  SwitchWorkspacePayload,
} from "../../shared/api-types.js";
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

function getInviteBaseUrl(request: NativeRequest) {
  const origin = getOrigin(request);
  if (origin) {
    return origin;
  }

  return `${getProtocol(request)}://${request.headers.host ?? "localhost"}`;
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

async function requireAuth(request: NativeRequest, response: NativeResponse) {
  const auth = await getAuthContext(request as any);

  if (!auth) {
    sendJson(response, 401, { error: "Authentication required." });
    return null;
  }

  return auth;
}

export default async function authHandler(request: NativeRequest, response: NativeResponse) {
  const pathname = getPathname(request);
  const method = request.method ?? "GET";

  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && rejectDisallowedBrowserOrigin(request, response)) {
    return;
  }

  if (method === "GET" && pathname === API_ROUTES.auth.me) {
    try {
      const auth = await getAuthContext(request as any);
      if (!auth) {
        sendJson(response, 401, { error: "Not signed in." });
        return;
      }

      sendJson(response, 200, await toApiSession(auth.user, auth.workspace.id));
      return;
    } catch (error) {
      console.error("[auth] failed to load session", error);
      sendJson(response, 401, { error: "Session expired. Please sign in again." }, {
        "Set-Cookie": clearSessionCookie(),
      });
      return;
    }
  }

  if (method === "PATCH" && pathname === API_ROUTES.auth.workspace) {
    const auth = await requireAuth(request, response);
    if (!auth) {
      return;
    }

    const input = (await readJsonBody<Partial<SwitchWorkspacePayload>>(request)) ?? {};
    const workspaceId = input.workspaceId;

    if (typeof workspaceId !== "string" || workspaceId.trim().length === 0) {
      sendJson(response, 400, { error: "workspaceId is required." });
      return;
    }

    const targetWorkspaceId = workspaceId.trim();

    if (auth.user.isGodMode) {
      const workspace = await prisma.workspace.findUnique({ where: { id: targetWorkspaceId } });
      if (!workspace) {
        sendJson(response, 404, { error: "Workspace not found." });
        return;
      }
    } else {
      const membership = auth.memberships.find((item) => item.workspaceId === targetWorkspaceId);
      if (!membership) {
        sendJson(response, 403, { error: "You do not have access to that workspace." });
        return;
      }
    }

    await prisma.user.update({
      where: { id: auth.user.id },
      data: { defaultWorkspaceId: targetWorkspaceId },
    });

    const updatedAuth = await buildAuthContext(auth.user.id);

    if (!updatedAuth) {
      sendJson(response, 404, { error: "Unable to load updated workspace context." });
      return;
    }

    sendJson(response, 200, await toApiSession(updatedAuth.user, targetWorkspaceId));
    return;
  }

  if (method === "POST" && pathname === API_ROUTES.auth.register) {
    const input = (await readJsonBody<Partial<RegisterPayload>>(request)) ?? {};

    if (!validateRegisterInput(input)) {
      sendJson(response, 400, { error: "Name, email, and an 8+ character password are required." });
      return;
    }

    const email = input.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      sendJson(response, 409, { error: "An account with that email already exists." });
      return;
    }

    const name = input.name.trim();
    const workspaceName = input.workspaceName?.trim() || `${name}'s Workspace`;
    const passwordHash = hashPassword(input.password);

    const user = await prisma.$transaction(async (tx) => {
      const userCount = await tx.user.count();
      const createdUser = await tx.user.create({
        data: { email, name, passwordHash },
      });

      let workspace: Prisma.WorkspaceGetPayload<object>;

      if (userCount === 0) {
        const legacy = await tx.workspace.findUnique({ where: { id: "legacy-workspace" } });
        if (legacy) {
          const slug = await createUniqueWorkspaceSlug(workspaceName, tx);
          workspace = await tx.workspace.update({
            where: { id: legacy.id },
            data: { name: workspaceName, slug, ownerId: createdUser.id },
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
        data: { defaultWorkspaceId: workspace.id },
      });

      return createdUser;
    });

    const session = await createSession(user.id);
    const auth = await buildAuthContext(user.id);
    sendJson(response, 201, await toApiSession(auth!.user, auth!.workspace.id), {
      "Set-Cookie": serializeSessionCookie(session.token, session.expiresAt),
    });
    return;
  }

  const inviteMatch = method === "GET" ? matchPath(pathname, "/api/auth/invite/:token") : null;
  if (inviteMatch) {
    const invite = await prisma.workspaceInvite.findUnique({
      where: { token: inviteMatch.token },
      include: {
        workspace: true,
        invitedBy: { select: { name: true } },
      },
    });

    if (!invite || invite.revokedAt || invite.acceptedAt || invite.expiresAt <= new Date()) {
      sendJson(response, 404, { error: "Invite not found or no longer valid." });
      return;
    }

    sendJson(response, 200, { invite: toApiWorkspaceInvite(invite, getInviteBaseUrl(request)) });
    return;
  }

  if (method === "POST" && pathname === API_ROUTES.auth.acceptInvite) {
    const input = (await readJsonBody<Partial<AcceptWorkspaceInvitePayload>>(request)) ?? {};

    if (!validateAcceptInviteInput(input)) {
      sendJson(response, 400, { error: "Invite token, name, email, and an 8+ character password are required." });
      return;
    }

    const token = input.token.trim();
    const email = input.email.trim().toLowerCase();
    const invite = await prisma.workspaceInvite.findUnique({ where: { token } });

    if (!invite || invite.revokedAt || invite.acceptedAt || invite.expiresAt <= new Date()) {
      sendJson(response, 404, { error: "Invite not found or no longer valid." });
      return;
    }

    if (invite.email.trim().toLowerCase() !== email) {
      sendJson(response, 400, { error: "Invite email does not match." });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser && !verifyPassword(input.password, existingUser.passwordHash)) {
      sendJson(response, 401, { error: "Existing account password does not match." });
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
      sendJson(response, 409, { error: "This account is already a member of the workspace." });
      return;
    }

    const session = await createSession(user.id);
    const auth = await buildAuthContext(user.id);
    sendJson(response, 201, await toApiSession(auth!.user, invite.workspaceId), {
      "Set-Cookie": serializeSessionCookie(session.token, session.expiresAt),
    });
    return;
  }

  if (method === "POST" && pathname === API_ROUTES.auth.login) {
    const input = (await readJsonBody<Partial<LoginPayload>>(request)) ?? {};

    if (!validateLoginInput(input)) {
      sendJson(response, 400, { error: "Email and password are required." });
      return;
    }

    const email = input.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      sendJson(response, 401, { error: "Invalid email or password." });
      return;
    }

    const auth = await buildAuthContext(user.id);

    if (!auth) {
      sendJson(response, 403, { error: "This account is not assigned to a workspace yet." });
      return;
    }

    const session = await createSession(user.id);
    sendJson(response, 200, await toApiSession(auth.user, auth.workspace.id), {
      "Set-Cookie": serializeSessionCookie(session.token, session.expiresAt),
    });
    return;
  }

  if (method === "POST" && pathname === API_ROUTES.auth.logout) {
    const token = parseCookies(request as any).get("timesmith_session");
    if (token) {
      await prisma.session.deleteMany({
        where: { tokenHash: hashToken(token) },
      });
    }

    sendEmpty(response, 204, { "Set-Cookie": clearSessionCookie() });
    return;
  }

  if (pathname.startsWith("/api/auth")) {
    methodNotAllowed(response);
    return;
  }

  notFound(response);
}
