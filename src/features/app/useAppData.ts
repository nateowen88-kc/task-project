import { useCallback, useEffect, useState } from "react";
import {
  AdminUser,
  AgendaResponse,
  AuthSession,
  CapturedItem,
  Notification,
  Task,
  WorkspaceInvite,
  WorkspaceMember,
  fetchAdminUsers,
  fetchCapturedItems,
  fetchNotifications,
  fetchSession,
  fetchTasks,
  fetchTodayAgenda,
  fetchWorkspaceInvites,
  fetchWorkspaceMembers,
  switchWorkspace,
} from "../../api";
import { sortByDueDate } from "../tasks/drafts";

export const ALL_WORKSPACES_ID = "__all__";

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function sessionWithAllWorkspaces(selectedSession: AuthSession): AuthSession {
  return {
    ...selectedSession,
    workspace: {
      id: ALL_WORKSPACES_ID,
      name: "All Workspaces",
      slug: "all-workspaces",
      role: "owner",
    },
  };
}

type UseAppDataOptions = {
  onError: (message: string) => void;
};

type RefreshTargets = {
  tasks?: boolean;
  workspaceMembers?: boolean;
  notifications?: boolean;
  capturedItems?: boolean;
  agenda?: boolean;
  adminUsers?: boolean;
  adminInvites?: boolean;
};

const fullRefreshTargets: Required<RefreshTargets> = {
  tasks: true,
  workspaceMembers: true,
  notifications: true,
  capturedItems: true,
  agenda: true,
  adminUsers: true,
  adminInvites: true,
};

function normalizeRefreshTargets(targets?: RefreshTargets) {
  return {
    ...fullRefreshTargets,
    ...targets,
  };
}

export function useAppData({ onError }: UseAppDataOptions) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [hasLoadedAdminUsers, setHasLoadedAdminUsers] = useState(false);
  const [adminInvites, setAdminInvites] = useState<WorkspaceInvite[]>([]);
  const [hasLoadedAdminInvites, setHasLoadedAdminInvites] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [hasLoadedWorkspaceMembers, setHasLoadedWorkspaceMembers] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hasLoadedTasks, setHasLoadedTasks] = useState(false);
  const [agenda, setAgenda] = useState<AgendaResponse | null>(null);
  const [hasLoadedAgenda, setHasLoadedAgenda] = useState(false);
  const [capturedItems, setCapturedItems] = useState<CapturedItem[]>([]);
  const [hasLoadedCapturedItems, setHasLoadedCapturedItems] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasLoadedNotifications, setHasLoadedNotifications] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorkspaceSwitching, setIsWorkspaceSwitching] = useState(false);

  const clearLoadedData = useCallback(() => {
    setTasks([]);
    setHasLoadedTasks(false);
    setWorkspaceMembers([]);
    setHasLoadedWorkspaceMembers(false);
    setNotifications([]);
    setHasLoadedNotifications(false);
    setAgenda(null);
    setHasLoadedAgenda(false);
    setCapturedItems([]);
    setHasLoadedCapturedItems(false);
    setAdminUsers([]);
    setHasLoadedAdminUsers(false);
    setAdminInvites([]);
    setHasLoadedAdminInvites(false);
  }, []);

  const refreshAppData = useCallback(
    async (nextSession?: AuthSession | null, requestedTargets?: RefreshTargets) => {
      const effectiveSession = nextSession ?? session;

      if (!effectiveSession) {
        return;
      }

      const targets = normalizeRefreshTargets(requestedTargets);
      const requests: Promise<unknown>[] = [
        ...(targets.tasks ? [fetchTasks()] : []),
        ...(targets.workspaceMembers ? [fetchWorkspaceMembers()] : []),
        ...(targets.notifications ? [fetchNotifications()] : []),
        ...(targets.capturedItems ? [fetchCapturedItems()] : []),
        ...(targets.adminInvites && effectiveSession.permissions.canManageUsers ? [fetchWorkspaceInvites()] : []),
      ];
      const resultKeys: Array<keyof RefreshTargets> = [];

      if (targets.tasks) {
        resultKeys.push("tasks");
      }

      if (targets.workspaceMembers) {
        resultKeys.push("workspaceMembers");
      }

      if (targets.notifications) {
        resultKeys.push("notifications");
      }

      if (targets.capturedItems) {
        resultKeys.push("capturedItems");
      }

      if (targets.adminInvites && effectiveSession.permissions.canManageUsers) {
        resultKeys.push("adminInvites");
      }

      if (targets.agenda && effectiveSession.workspace.id !== ALL_WORKSPACES_ID) {
        requests.push(fetchTodayAgenda());
        resultKeys.push("agenda");
      }

      if (
        targets.adminUsers &&
        effectiveSession.permissions.canManageUsers
      ) {
        requests.push(fetchAdminUsers());
        resultKeys.push("adminUsers");
      }

      const results = await Promise.all(requests);

      results.forEach((result, index) => {
        switch (resultKeys[index]) {
          case "tasks":
            setTasks(sortByDueDate(result as Task[]));
            setHasLoadedTasks(true);
            break;
          case "workspaceMembers":
            setWorkspaceMembers(result as WorkspaceMember[]);
            setHasLoadedWorkspaceMembers(true);
            break;
          case "notifications":
            setNotifications(result as Notification[]);
            setHasLoadedNotifications(true);
            break;
          case "capturedItems":
            setCapturedItems(result as CapturedItem[]);
            setHasLoadedCapturedItems(true);
            break;
          case "agenda":
            setAgenda((result as AgendaResponse) ?? null);
            setHasLoadedAgenda(true);
            break;
          case "adminUsers":
            setAdminUsers((result as AdminUser[]) ?? []);
            setHasLoadedAdminUsers(true);
            break;
          case "adminInvites":
            setAdminInvites((result as WorkspaceInvite[]) ?? []);
            setHasLoadedAdminInvites(true);
            break;
        }
      });
    },
    [session],
  );

  const applyAuthenticatedSession = useCallback(
    async (nextSession: AuthSession) => {
      const persistedAllWorkspaces =
        nextSession.user.isGodMode && window.localStorage.getItem("timesmith-all-workspaces") === "true"
          ? sessionWithAllWorkspaces(nextSession)
          : nextSession;

      clearLoadedData();
      setSession(persistedAllWorkspaces);
      await refreshAppData(persistedAllWorkspaces, {
        tasks: true,
        adminUsers: persistedAllWorkspaces.permissions.canManageUsers,
        adminInvites: false,
        workspaceMembers: false,
        notifications: false,
        capturedItems: false,
        agenda: false,
      });
      return persistedAllWorkspaces;
    },
    [clearLoadedData, refreshAppData],
  );

  const clearSessionData = useCallback(() => {
    window.localStorage.removeItem("timesmith-all-workspaces");
    setSession(null);
    clearLoadedData();
  }, [clearLoadedData]);

  const switchActiveWorkspace = useCallback(
    async (nextWorkspaceId: string) => {
      if (!session || nextWorkspaceId === session.workspace.id) {
        return;
      }

      try {
        setIsWorkspaceSwitching(true);

        if (nextWorkspaceId === ALL_WORKSPACES_ID) {
          const nextSession = sessionWithAllWorkspaces(session);
          window.localStorage.setItem("timesmith-all-workspaces", "true");
          clearLoadedData();
          setSession(nextSession);
          await refreshAppData(nextSession, {
            tasks: true,
            adminUsers: nextSession.permissions.canManageUsers,
            adminInvites: nextSession.permissions.canManageUsers,
            workspaceMembers: false,
            notifications: false,
            capturedItems: false,
            agenda: false,
          });
          return;
        }

        window.localStorage.removeItem("timesmith-all-workspaces");
        const nextSession = await switchWorkspace(nextWorkspaceId);
        clearLoadedData();
        setSession(nextSession);
        await refreshAppData(nextSession, {
          tasks: true,
          adminUsers: nextSession.permissions.canManageUsers,
          adminInvites: false,
          workspaceMembers: false,
          notifications: false,
          capturedItems: false,
          agenda: false,
        });
      } catch (error) {
        onError(toErrorMessage(error, "Unable to switch workspace."));
      } finally {
        setIsWorkspaceSwitching(false);
      }
    },
    [clearLoadedData, onError, refreshAppData, session],
  );

  useEffect(() => {
    async function load() {
      try {
        const nextSession = await fetchSession();

        if (nextSession) {
          await applyAuthenticatedSession(nextSession);
        }
      } catch (error) {
        onError(toErrorMessage(error, "Could not load TimeSmith."));
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [applyAuthenticatedSession, onError]);

  return {
    session,
    adminUsers,
    hasLoadedAdminUsers,
    adminInvites,
    hasLoadedAdminInvites,
    workspaceMembers,
    hasLoadedWorkspaceMembers,
    tasks,
    hasLoadedTasks,
    setTasks,
    agenda,
    hasLoadedAgenda,
    setAgenda,
    capturedItems,
    hasLoadedCapturedItems,
    notifications,
    hasLoadedNotifications,
    setNotifications,
    isLoading,
    isWorkspaceSwitching,
    refreshAppData,
    applyAuthenticatedSession,
    clearSessionData,
    switchActiveWorkspace,
  };
}
