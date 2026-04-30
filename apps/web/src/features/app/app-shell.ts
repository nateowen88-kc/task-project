import type { AuthSession, Task, TodayItem } from "../../api";
import { ALL_WORKSPACES_ID } from "./useAppData";

export type AppView = "workflow" | "team" | "one-on-ones" | "agenda" | "inbox" | "notifications" | "admin" | "focus";

export const VIEW_LABELS: Record<AppView, string> = {
  workflow: "Tasks",
  team: "Team",
  "one-on-ones": "1:1s",
  agenda: "Agenda",
  inbox: "Inbox",
  notifications: "Alerts",
  admin: "Admin",
  focus: "Focus",
};

export const VIEW_ICONS: Record<AppView, string> = {
  workflow: "⌂",
  team: "👥",
  "one-on-ones": "☰",
  agenda: "◷",
  inbox: "✉",
  notifications: "🔔",
  admin: "⚙",
  focus: "🎯",
};

export function getItemWorkspaceLabel(item: unknown) {
  const candidate = item as
    | {
        workspaceName?: string | null;
        workspace?: { name?: string | null } | null;
        workspaceId?: string | null;
      }
    | undefined;

  return (
    candidate?.workspaceName ??
    candidate?.workspace?.name ??
    (candidate?.workspaceId && candidate.workspaceId !== ALL_WORKSPACES_ID
      ? candidate.workspaceId
      : null)
  );
}

export function buildAvailableViews({
  focusedItem,
  canManageUsers,
}: {
  focusedItem: TodayItem | null;
  canManageUsers: boolean;
}) {
  return [
    "workflow",
    "team",
    "one-on-ones",
    "agenda",
    "inbox",
    "notifications",
    ...(focusedItem ? ["focus"] : []),
    ...(canManageUsers ? ["admin"] : []),
  ] as AppView[];
}

export function buildWorkspaceOptions({
  session,
  isGodMode,
}: {
  session: AuthSession;
  isGodMode: boolean;
}) {
  return [
    ...(isGodMode ? [{ id: "__all__", name: "All Workspaces" }] : []),
    ...session.workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
    })),
  ];
}

export function findTaskForTodayItem(tasks: Task[], item: TodayItem) {
  return tasks.find((task) => task.id === item.taskId) ?? null;
}
