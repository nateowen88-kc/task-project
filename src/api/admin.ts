import { request } from "./client";
import type {
  AdminUser,
  AdminUserPayload,
  CreateWorkspaceInvitePayload,
  WorkspaceInvite,
  WorkspaceMember,
} from "./types";
import { API_ROUTES } from "../shared/api-routes";

function fetchAdminUsers() {
  return request<AdminUser[]>(API_ROUTES.admin.users);
}

function fetchWorkspaceMembers() {
  return request<WorkspaceMember[]>(API_ROUTES.workspaceMembers.list);
}

function fetchWorkspaceInvites() {
  return request<WorkspaceInvite[]>(API_ROUTES.admin.invites);
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

function revokeWorkspaceInvite(id: string) {
  return request<null>(API_ROUTES.admin.invite(id), {
    method: "DELETE",
  });
}

async function resetAdminUserPassword(userId: string) {
  const response = await fetch(API_ROUTES.admin.resetPassword(userId), {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Unable to reset password." }));
    throw new Error(payload.error ?? "Unable to reset password.");
  }

  return (await response.json()) as { password: string };
}

export {
  createAdminUser,
  createWorkspaceInvite,
  fetchAdminUsers,
  fetchWorkspaceInvites,
  fetchWorkspaceMembers,
  revokeWorkspaceInvite,
  resetAdminUserPassword,
  updateAdminUser,
};
