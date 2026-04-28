import { request, resolveRequestInput } from "./client";
import type {
  AdminAppConfig,
  AdminWorkspace,
  AdminUser,
  AdminUserPayload,
  CreateWorkspacePayload,
  CreateWorkspaceInvitePayload,
  UpdateWorkspacePayload,
  WorkspaceInvite,
  WorkspaceMember,
} from "./types";
import { API_ROUTES } from "../../../../src/shared/api-routes";

function fetchAdminUsers() {
  return request<AdminUser[]>(API_ROUTES.admin.users);
}

function fetchWorkspaceMembers() {
  return request<WorkspaceMember[]>(API_ROUTES.workspaceMembers.list);
}

function fetchWorkspaceInvites() {
  return request<WorkspaceInvite[]>(API_ROUTES.admin.invites);
}

function fetchAdminWorkspaces() {
  return request<AdminWorkspace[]>(API_ROUTES.admin.workspaces);
}

function fetchAdminAppConfig() {
  return request<AdminAppConfig>(API_ROUTES.admin.appConfig);
}

function createAdminUser(payload: AdminUserPayload) {
  return request<AdminUser>(API_ROUTES.admin.users, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function updateAdminUser(id: string, payload: AdminUserPayload) {
  return request<AdminUser>(API_ROUTES.admin.user(id), {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

function createWorkspaceInvite(payload: CreateWorkspaceInvitePayload) {
  return request<WorkspaceInvite>(API_ROUTES.admin.invites, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function createWorkspace(payload: CreateWorkspacePayload) {
  return request<AdminWorkspace>(API_ROUTES.admin.workspaces, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function updateWorkspace(id: string, payload: UpdateWorkspacePayload) {
  return request<AdminWorkspace>(API_ROUTES.admin.workspace(id), {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

function updateWorkspaceStatus(id: string, isActive: boolean) {
  return request<AdminWorkspace>(API_ROUTES.admin.workspaceStatus(id), {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
}

function updateAdminAppConfig(payload: AdminAppConfig) {
  return request<AdminAppConfig>(API_ROUTES.admin.appConfig, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

function revokeWorkspaceInvite(id: string) {
  return request<null>(API_ROUTES.admin.invite(id), {
    method: "DELETE",
  });
}

async function resetAdminUserPassword(userId: string) {
  const response = await fetch(resolveRequestInput(API_ROUTES.admin.resetPassword(userId)), {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Unable to reset password." }));
    throw new Error(payload.error ?? "Unable to reset password.");
  }

  return (await response.json()) as { emailSent: boolean };
}

export {
  createAdminUser,
  createWorkspace,
  createWorkspaceInvite,
  fetchAdminAppConfig,
  fetchAdminWorkspaces,
  fetchAdminUsers,
  fetchWorkspaceInvites,
  fetchWorkspaceMembers,
  revokeWorkspaceInvite,
  resetAdminUserPassword,
  updateAdminAppConfig,
  updateWorkspace,
  updateWorkspaceStatus,
  updateAdminUser,
};
