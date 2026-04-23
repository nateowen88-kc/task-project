import { request } from "./client";
import type {
  AcceptWorkspaceInvitePayload,
  AuthSession,
  LoginPayload,
  RegisterPayload,
  WorkspaceInviteLookup,
} from "./types";
import { API_ROUTES } from "../shared/api-routes";

async function fetchSession() {
  const response = await fetch(API_ROUTES.auth.me, {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not load session.");
  }

  return (await response.json()) as AuthSession;
}

function login(payload: LoginPayload) {
  return request<AuthSession>(API_ROUTES.auth.login, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function register(payload: RegisterPayload) {
  return request<AuthSession>(API_ROUTES.auth.register, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function fetchInvite(token: string) {
  return request<WorkspaceInviteLookup>(API_ROUTES.auth.invite(token));
}

function acceptInvite(payload: AcceptWorkspaceInvitePayload) {
  return request<AuthSession>(API_ROUTES.auth.acceptInvite, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function logout() {
  await request<null>(API_ROUTES.auth.logout, {
    method: "POST",
  });
}

async function switchWorkspace(workspaceId: string) {
  const response = await fetch(API_ROUTES.auth.workspace, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workspaceId }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Unable to switch workspace." }));
    throw new Error(payload.error ?? "Unable to switch workspace.");
  }

  return (await response.json()) as AuthSession;
}

export { acceptInvite, fetchInvite, fetchSession, login, logout, register, switchWorkspace };
