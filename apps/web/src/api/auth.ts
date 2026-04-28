import { request, resolveRequestInput } from "./client";
import type {
  AcceptWorkspaceInvitePayload,
  AuthSession,
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
  WorkspaceInviteLookup,
} from "./types";
import { API_ROUTES } from "../../../../src/shared/api-routes";

async function fetchSession() {
  const response = await fetch(resolveRequestInput(API_ROUTES.auth.me), {
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

function forgotPassword(payload: ForgotPasswordPayload) {
  return request<{ ok: true }>(API_ROUTES.auth.forgotPassword, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function resetPassword(payload: ResetPasswordPayload) {
  return request<AuthSession>(API_ROUTES.auth.resetPassword, {
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
  return request<AuthSession>(API_ROUTES.auth.workspace, {
    method: "PATCH",
    body: JSON.stringify({ workspaceId }),
  });
}

export { acceptInvite, fetchInvite, fetchSession, forgotPassword, login, logout, register, resetPassword, switchWorkspace };
