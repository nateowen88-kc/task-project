import crypto from "node:crypto";
import express from "express";
import { Prisma, WorkspaceRole } from "@prisma/client";

import { prisma } from "./db.js";
import { addDays } from "./dates.js";
import type { AuthSession } from "../../../../../src/shared/api-types.js";
import {
  getTaskPermissions,
  getWorkspaceRole,
  hasPersonalTaskWorkspaceView,
  isWorkspaceAdmin,
  isWorkspaceOwner,
  personalTaskWhere,
  resolveWorkspaceForUser,
} from "./auth-rules.js";
import {
  type ApiWorkspace,
  reverseWorkspaceRoleMap,
} from "./serializers.js";

const sessionCookieName = "timesmith_session";
const sessionLifetimeDays = 30;
const isProduction = process.env.NODE_ENV === "production";
const sessionCookieDomain = process.env.SESSION_COOKIE_DOMAIN?.trim() || null;

export type UserRecord = Prisma.UserGetPayload<{
  include: {
    defaultWorkspace: true;
    memberships: {
      include: {
        workspace: true;
      };
    };
  };
}>;

export type AuthContext = {
  user: UserRecord;
  workspace: Prisma.WorkspaceGetPayload<object>;
  memberships: Prisma.WorkspaceMemberGetPayload<{
    include: {
      workspace: true;
    };
  }>[];
  allWorkspaces: boolean;
};

export type AuthenticatedRequest = express.Request & {
  auth: AuthContext;
};

function getHeaderValue(request: express.Request | { headers?: Record<string, string | string[] | undefined> }, name: string) {
  if ("header" in request && typeof request.header === "function") {
    return request.header(name) ?? null;
  }

  const value = request.headers?.[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export function canResetPasswords(auth: AuthContext) {
  return auth.user.isGodMode || isWorkspaceOwner(auth);
}

export function canAssignTasks(auth: AuthContext) {
  return auth.user.isGodMode || isWorkspaceAdmin(auth);
}

export function getAppPermissions(auth: AuthContext): AuthSession["permissions"] {
  return {
    canManageUsers: isWorkspaceAdmin(auth),
    canCreateUsers: isWorkspaceAdmin(auth),
    canCreateWorkspaces: auth.user.isGodMode,
    canPromoteToOwner: isWorkspaceOwner(auth),
    canResetPasswords: canResetPasswords(auth),
    canAssignTasks: canAssignTasks(auth),
    canEditAllTasks: isWorkspaceAdmin(auth),
    canDeleteAllTasks: isWorkspaceAdmin(auth),
    canArchiveAllTasks: isWorkspaceAdmin(auth),
  };
}

export function parseCookies(request: express.Request) {
  const header = getHeaderValue(request, "cookie");
  if (!header) {
    return new Map<string, string>();
  }

  return new Map(
    header.split(";").map((entry) => {
      const index = entry.indexOf("=");
      const key = decodeURIComponent(entry.slice(0, index).trim());
      const value = decodeURIComponent(entry.slice(index + 1).trim());
      return [key, value];
    }),
  );
}

export function hashToken(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function toApiWorkspace(
  membership: Prisma.WorkspaceMemberGetPayload<{
    include: {
      workspace: true;
    };
  }>,
): ApiWorkspace {
  return {
    id: membership.workspace.id,
    name: membership.workspace.name,
    slug: membership.workspace.slug,
    role: reverseWorkspaceRoleMap[membership.role],
  };
}

function shouldUseAllWorkspacesScope(request: express.Request, user: UserRecord) {
  return user.isGodMode && getHeaderValue(request, "x-timesmith-scope") === "all";
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "workspace"
  );
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function createTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let password = "";

  for (let index = 0; index < 12; index += 1) {
    password += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return password;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) {
    return false;
  }

  const computed = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (computed.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(computed, expected);
}

export function serializeSessionCookie(token: string, expiresAt: Date) {
  const parts = [
    `${sessionCookieName}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
  ];

  if (isProduction) {
    parts.push("Secure");
  }

  if (sessionCookieDomain) {
    parts.push(`Domain=${sessionCookieDomain}`);
  }

  return parts.join("; ");
}

export function clearSessionCookie() {
  const parts = [
    `${sessionCookieName}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];

  if (isProduction) {
    parts.push("Secure");
  }

  if (sessionCookieDomain) {
    parts.push(`Domain=${sessionCookieDomain}`);
  }

  return parts.join("; ");
}

export async function toApiSession(user: UserRecord, workspaceId: string): Promise<AuthSession> {
  if (user.isGodMode) {
    const workspaces = await prisma.workspace.findMany({
      where: {
        deactivatedAt: null,
      },
      orderBy: [{ createdAt: "asc" }],
    });

    const currentWorkspace = workspaces.find((item) => item.id === workspaceId) ?? workspaces[0];

    if (!currentWorkspace) {
      throw new Error("No workspaces available.");
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isGodMode: user.isGodMode,
      },
      workspace: {
        id: currentWorkspace.id,
        name: currentWorkspace.name,
        slug: currentWorkspace.slug,
        role: "owner",
      },
      workspaces: workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role: "owner" as const,
      })),
      permissions: {
        canManageUsers: true,
        canCreateUsers: true,
        canCreateWorkspaces: true,
        canPromoteToOwner: true,
        canResetPasswords: true,
        canAssignTasks: true,
        canEditAllTasks: true,
        canDeleteAllTasks: true,
        canArchiveAllTasks: true,
      },
    };
  }

  const membership = user.memberships.find((item) => item.workspaceId === workspaceId) ?? user.memberships[0];
  const activeMemberships = user.memberships.filter((item) => !item.workspace.deactivatedAt);
  const availableMemberships = activeMemberships.length > 0 ? activeMemberships : user.memberships;
  const selectedMembership =
    availableMemberships.find((item) => item.workspaceId === workspaceId) ?? availableMemberships[0];

  if (!selectedMembership) {
    throw new Error("User is not a member of any workspace.");
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isGodMode: user.isGodMode,
    },
    workspace: toApiWorkspace(selectedMembership),
    workspaces: availableMemberships.map((item) => toApiWorkspace(item)),
    permissions: {
      canManageUsers: selectedMembership.role === WorkspaceRole.OWNER || selectedMembership.role === WorkspaceRole.ADMIN,
      canCreateUsers: selectedMembership.role === WorkspaceRole.OWNER || selectedMembership.role === WorkspaceRole.ADMIN,
      canCreateWorkspaces: false,
      canPromoteToOwner: selectedMembership.role === WorkspaceRole.OWNER,
      canResetPasswords: selectedMembership.role === WorkspaceRole.OWNER,
      canAssignTasks: selectedMembership.role === WorkspaceRole.OWNER || selectedMembership.role === WorkspaceRole.ADMIN,
      canEditAllTasks: selectedMembership.role === WorkspaceRole.OWNER || selectedMembership.role === WorkspaceRole.ADMIN,
      canDeleteAllTasks: selectedMembership.role === WorkspaceRole.OWNER || selectedMembership.role === WorkspaceRole.ADMIN,
      canArchiveAllTasks: selectedMembership.role === WorkspaceRole.OWNER || selectedMembership.role === WorkspaceRole.ADMIN,
    },
  };
}

export async function buildAuthContext(userId: string, allWorkspaces = false): Promise<AuthContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      defaultWorkspace: true,
      memberships: {
        include: {
          workspace: true,
        },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!user || user.memberships.length === 0) {
    return null;
  }

  const workspace = resolveWorkspaceForUser(user);
  const memberships = user.memberships.filter((item) => !item.workspace.deactivatedAt);

  if (!workspace || memberships.length === 0) {
    return null;
  }

  return {
    user,
    workspace,
    memberships,
    allWorkspaces,
  };
}

export async function getAuthContext(request: express.Request) {
  const token = parseCookies(request).get(sessionCookieName);
  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: {
      tokenHash: hashToken(token),
    },
    include: {
      user: {
        include: {
          defaultWorkspace: true,
          memberships: {
            include: {
              workspace: true,
            },
            orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    return null;
  }

  const baseUser = session.user;

  if (!baseUser || baseUser.memberships.length === 0) {
    return null;
  }

  const workspace = resolveWorkspaceForUser(baseUser);
  const memberships = baseUser.memberships.filter((item) => !item.workspace.deactivatedAt);

  if (!workspace || memberships.length === 0) {
    return null;
  }

  return {
    user: baseUser,
    workspace,
    memberships,
    allWorkspaces: shouldUseAllWorkspacesScope(request, baseUser),
  };
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = addDays(new Date(), sessionLifetimeDays);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
    },
  });

  return {
    token,
    expiresAt,
  };
}

export async function createUniqueWorkspaceSlug(base: string, tx: Prisma.TransactionClient = prisma) {
  const root = slugify(base);
  let attempt = root;
  let counter = 1;

  while (await tx.workspace.findUnique({ where: { slug: attempt } })) {
    counter += 1;
    attempt = `${root}-${counter}`;
  }

  return attempt;
}

export async function resolveCaptureWorkspaceId(inputWorkspaceSlug?: string | null) {
  if (inputWorkspaceSlug?.trim()) {
    const explicit = await prisma.workspace.findUnique({
      where: { slug: inputWorkspaceSlug.trim() },
      select: { id: true },
    });

    if (explicit) {
      return explicit.id;
    }
  }

  const firstWorkspace = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!firstWorkspace) {
    throw new Error("No workspace available for inbound capture.");
  }

  return firstWorkspace.id;
}

export async function requireAuth(request: express.Request, response: express.Response, next: express.NextFunction) {
  const auth = await getAuthContext(request);
  if (!auth) {
    response.status(401).json({ error: "Authentication required." });
    return;
  }

  (request as AuthenticatedRequest).auth = auth;
  next();
}

export function authOf(request: express.Request) {
  return (request as AuthenticatedRequest).auth;
}

export function workspaceWhere(auth: AuthContext) {
  return auth.allWorkspaces ? {} : { workspaceId: auth.workspace.id };
}

export function workspaceWhereForUser(auth: AuthContext, userId: string) {
  return auth.allWorkspaces ? { userId } : { workspaceId: auth.workspace.id, userId };
}

export function workspaceScopedIdWhere(auth: AuthContext, id: string) {
  return auth.allWorkspaces ? { id } : { id, workspaceId: auth.workspace.id };
}

export function taskScopedIdWhere(auth: AuthContext, id: string) {
  return auth.allWorkspaces ? { id } : { id, workspaceId: auth.workspace.id, ...personalTaskWhere(auth) };
}

export function canManageUsers(auth: AuthContext) {
  return auth.user.isGodMode || isWorkspaceAdmin(auth);
}

export {
  getTaskPermissions,
  getWorkspaceRole,
  hasPersonalTaskWorkspaceView,
  isWorkspaceAdmin,
  isWorkspaceOwner,
  personalTaskWhere,
  resolveWorkspaceForUser,
};

export async function requireWorkspaceAdmin(
  request: express.Request,
  response: express.Response,
  next: express.NextFunction,
) {
  const auth = await getAuthContext(request);
  if (!auth) {
    response.status(401).json({ error: "Authentication required." });
    return;
  }

  if (!canManageUsers(auth)) {
    response.status(403).json({ error: "Admin access required." });
    return;
  }

  (request as AuthenticatedRequest).auth = auth;
  next();
}
