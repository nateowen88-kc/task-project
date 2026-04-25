import test from "node:test";
import assert from "node:assert/strict";
import { WorkspaceRole } from "@prisma/client";

import {
  getTaskPermissions,
  hasPersonalTaskWorkspaceView,
  personalTaskWhere,
  resolveWorkspaceForUser,
} from "./auth-rules.js";

type TestWorkspace = {
  id: string;
  deactivatedAt: Date | null;
};

type TestWorkspaceUser = {
  isGodMode: boolean;
  defaultWorkspaceId: string | null;
  defaultWorkspace: TestWorkspace | null;
  memberships: Array<{
    workspaceId: string;
    role: WorkspaceRole;
    workspace: TestWorkspace;
  }>;
};

function createAuth(overrides: Partial<{
  user: { id: string; isGodMode: boolean };
  workspace: { id: string };
  memberships: Array<{ workspaceId: string; role: WorkspaceRole }>;
}> = {}) {
  return {
    user: { id: "user-1", isGodMode: false, ...overrides.user },
    workspace: { id: "workspace-1", ...overrides.workspace },
    memberships: overrides.memberships ?? [
      { workspaceId: "workspace-1", role: WorkspaceRole.USER },
    ],
  };
}

test("resolveWorkspaceForUser prefers the active default workspace", () => {
  const user: TestWorkspaceUser = {
    isGodMode: false,
    defaultWorkspaceId: "workspace-2",
    defaultWorkspace: { id: "workspace-2", deactivatedAt: null },
    memberships: [
      {
        workspaceId: "workspace-1",
        role: WorkspaceRole.USER,
        workspace: { id: "workspace-1", deactivatedAt: null },
      },
      {
        workspaceId: "workspace-2",
        role: WorkspaceRole.USER,
        workspace: { id: "workspace-2", deactivatedAt: null },
      },
    ],
  };

  assert.equal(resolveWorkspaceForUser(user)?.id, "workspace-2");
});

test("resolveWorkspaceForUser skips a deactivated default workspace", () => {
  const user: TestWorkspaceUser = {
    isGodMode: false,
    defaultWorkspaceId: "workspace-2",
    defaultWorkspace: { id: "workspace-2", deactivatedAt: new Date("2026-04-25T00:00:00.000Z") },
    memberships: [
      {
        workspaceId: "workspace-1",
        role: WorkspaceRole.USER,
        workspace: { id: "workspace-1", deactivatedAt: null },
      },
      {
        workspaceId: "workspace-2",
        role: WorkspaceRole.USER,
        workspace: { id: "workspace-2", deactivatedAt: new Date("2026-04-25T00:00:00.000Z") },
      },
    ],
  };

  assert.equal(resolveWorkspaceForUser(user)?.id, "workspace-1");
});

test("resolveWorkspaceForUser returns null when no active memberships remain", () => {
  const user: TestWorkspaceUser = {
    isGodMode: false,
    defaultWorkspaceId: "workspace-1",
    defaultWorkspace: { id: "workspace-1", deactivatedAt: new Date("2026-04-25T00:00:00.000Z") },
    memberships: [
      {
        workspaceId: "workspace-1",
        role: WorkspaceRole.USER,
        workspace: { id: "workspace-1", deactivatedAt: new Date("2026-04-25T00:00:00.000Z") },
      },
    ],
  };

  assert.equal(resolveWorkspaceForUser(user), null);
});

test("hasPersonalTaskWorkspaceView only applies to non-admin multi-workspace users", () => {
  assert.equal(
    hasPersonalTaskWorkspaceView(
      createAuth({
        memberships: [
          { workspaceId: "workspace-1", role: WorkspaceRole.USER },
          { workspaceId: "workspace-2", role: WorkspaceRole.USER },
        ],
      }),
    ),
    true,
  );

  assert.equal(
    hasPersonalTaskWorkspaceView(
      createAuth({
        memberships: [
          { workspaceId: "workspace-1", role: WorkspaceRole.ADMIN },
          { workspaceId: "workspace-2", role: WorkspaceRole.USER },
        ],
      }),
    ),
    false,
  );

  assert.equal(
    hasPersonalTaskWorkspaceView(
      createAuth({
        user: { id: "god-1", isGodMode: true },
        memberships: [
          { workspaceId: "workspace-1", role: WorkspaceRole.USER },
          { workspaceId: "workspace-2", role: WorkspaceRole.USER },
        ],
      }),
    ),
    false,
  );
});

test("personalTaskWhere scopes multi-workspace members to tasks they own or are assigned", () => {
  assert.deepEqual(
    personalTaskWhere(
      createAuth({
        user: { id: "user-7", isGodMode: false },
        memberships: [
          { workspaceId: "workspace-1", role: WorkspaceRole.USER },
          { workspaceId: "workspace-2", role: WorkspaceRole.USER },
        ],
      }),
    ),
    {
      OR: [{ createdById: "user-7" }, { assigneeId: "user-7" }],
    },
  );

  assert.deepEqual(personalTaskWhere(createAuth()), {});
});

test("getTaskPermissions grants task access to admins, owners, and assignees only", () => {
  const task = { createdById: "creator-1", assigneeId: "assignee-1" };

  assert.deepEqual(
    getTaskPermissions(
      createAuth({
        user: { id: "admin-1", isGodMode: false },
        memberships: [{ workspaceId: "workspace-1", role: WorkspaceRole.ADMIN }],
      }),
      task,
    ),
    {
      canEdit: true,
      canChangeStatus: true,
      canComment: true,
      canArchive: true,
      canDelete: true,
      canReassign: true,
    },
  );

  assert.equal(
    getTaskPermissions(
      createAuth({ user: { id: "creator-1", isGodMode: false } }),
      task,
    ).canEdit,
    true,
  );

  assert.equal(
    getTaskPermissions(
      createAuth({ user: { id: "assignee-1", isGodMode: false } }),
      task,
    ).canComment,
    true,
  );

  assert.deepEqual(
    getTaskPermissions(
      createAuth({ user: { id: "other-1", isGodMode: false } }),
      task,
    ),
    {
      canEdit: false,
      canChangeStatus: false,
      canComment: false,
      canArchive: false,
      canDelete: false,
      canReassign: false,
    },
  );
});
