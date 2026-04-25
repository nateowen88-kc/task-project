import { WorkspaceRole } from "@prisma/client";

type MembershipLike = {
  workspaceId: string;
  role: WorkspaceRole;
};

type WorkspaceLike = {
  id: string;
  deactivatedAt?: Date | null;
};

type AuthLike = {
  user: {
    id: string;
    isGodMode: boolean;
  };
  workspace: {
    id: string;
  };
  memberships: MembershipLike[];
};

type TaskPermissionTarget = {
  createdById: string | null;
  assigneeId: string | null;
};

type WorkspaceMembershipLike<TWorkspace extends WorkspaceLike = WorkspaceLike> = MembershipLike & {
  workspace: TWorkspace;
};

type UserWorkspaceContext<TWorkspace extends WorkspaceLike = WorkspaceLike> = {
  isGodMode: boolean;
  defaultWorkspaceId: string | null;
  defaultWorkspace: TWorkspace | null;
  memberships: WorkspaceMembershipLike<TWorkspace>[];
};

function isActiveWorkspace(workspace: WorkspaceLike | null | undefined) {
  return !workspace?.deactivatedAt;
}

function activeMemberships<TWorkspace extends WorkspaceLike>(memberships: WorkspaceMembershipLike<TWorkspace>[]) {
  return memberships.filter((item) => isActiveWorkspace(item.workspace));
}

function getWorkspaceMembership(auth: AuthLike, workspaceId = auth.workspace.id) {
  return auth.memberships.find((item) => item.workspaceId === workspaceId) ?? null;
}

export function resolveWorkspaceForUser<TWorkspace extends WorkspaceLike>(
  user: UserWorkspaceContext<TWorkspace>,
) {
  const memberships = activeMemberships(user.memberships);

  if (user.isGodMode && isActiveWorkspace(user.defaultWorkspace)) {
    return user.defaultWorkspace;
  }

  if (
    user.defaultWorkspaceId &&
    isActiveWorkspace(user.defaultWorkspace) &&
    memberships.some((item) => item.workspaceId === user.defaultWorkspaceId)
  ) {
    return user.defaultWorkspace;
  }

  return memberships[0]?.workspace ?? null;
}

export function getWorkspaceRole(auth: AuthLike, workspaceId = auth.workspace.id) {
  if (auth.user.isGodMode) {
    return WorkspaceRole.OWNER;
  }

  return getWorkspaceMembership(auth, workspaceId)?.role ?? null;
}

export function isWorkspaceOwner(auth: AuthLike, workspaceId = auth.workspace.id) {
  return getWorkspaceRole(auth, workspaceId) === WorkspaceRole.OWNER;
}

export function isWorkspaceAdmin(auth: AuthLike, workspaceId = auth.workspace.id) {
  const role = getWorkspaceRole(auth, workspaceId);
  return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN;
}

export function hasPersonalTaskWorkspaceView(auth: AuthLike) {
  return !auth.user.isGodMode && auth.memberships.length > 1 && !isWorkspaceAdmin(auth);
}

export function personalTaskWhere(auth: AuthLike) {
  if (!hasPersonalTaskWorkspaceView(auth)) {
    return {};
  }

  return {
    OR: [{ createdById: auth.user.id }, { assigneeId: auth.user.id }],
  };
}

export function getTaskPermissions(auth: AuthLike, task: TaskPermissionTarget) {
  const isManager = isWorkspaceAdmin(auth);
  const isOwner = task.createdById === auth.user.id;
  const isAssignee = task.assigneeId === auth.user.id;
  const canActOnTask = isManager || isOwner || isAssignee;

  return {
    canEdit: canActOnTask,
    canChangeStatus: canActOnTask,
    canComment: canActOnTask,
    canArchive: canActOnTask,
    canDelete: canActOnTask,
    canReassign: isManager,
  };
}
