import { useMemo } from "react";
import type { CapturedItem, Notification, Task, TodayItem } from "../../api";
import { getAgendaBucket, getAgendaScore } from "../agenda/utils";

type AppView = "workflow" | "agenda" | "inbox" | "notifications" | "admin" | "focus";

type UseAppViewModelOptions = {
  tasks: Task[];
  capturedItems: CapturedItem[];
  notifications: Notification[];
  todayItems: TodayItem[];
  focusedItemKey: string | null;
  isAllWorkspacesMode: boolean;
};

export function useAppViewModel({
  tasks,
  capturedItems,
  notifications,
  todayItems,
  focusedItemKey,
  isAllWorkspacesMode,
}: UseAppViewModelOptions) {
  const focusedItem = useMemo(
    () => todayItems.find((item) => `${item.sourceType}:${item.id}` === focusedItemKey) ?? null,
    [focusedItemKey, todayItems],
  );

  const stats = useMemo(
    () => ({
      dueNow: todayItems.length,
      done: tasks.filter((task) => task.status === "done").length,
      blocked: tasks.filter((task) => task.status === "blocked").length,
      inbox: capturedItems.filter((item) => item.status === "new").length,
    }),
    [capturedItems, tasks, todayItems.length],
  );

  const doneWorkflowCount = useMemo(
    () => tasks.filter((task) => task.status === "done").length,
    [tasks],
  );

  const sortedAgendaItems = useMemo(
    () =>
      [...todayItems].sort((left, right) => {
        const scoreDifference = getAgendaScore(right) - getAgendaScore(left);

        if (scoreDifference !== 0) {
          return scoreDifference;
        }

        if (left.dueDate !== right.dueDate) {
          return left.dueDate.localeCompare(right.dueDate);
        }

        return left.title.localeCompare(right.title);
      }),
    [todayItems],
  );

  const nextFocusItem = useMemo(() => {
    if (!focusedItemKey) {
      return null;
    }

    return (
      sortedAgendaItems.find(
        (item) => item.status !== "done" && `${item.sourceType}:${item.id}` !== focusedItemKey,
      ) ?? null
    );
  }, [focusedItemKey, sortedAgendaItems]);

  const focusNowItems = useMemo(
    () =>
      sortedAgendaItems
        .filter(
          (item) =>
            item.status !== "done" &&
            (getAgendaBucket(item) === "urgent" || getAgendaBucket(item) === "today"),
        )
        .slice(0, 3),
    [sortedAgendaItems],
  );

  const agendaSections = useMemo(
    () => [
      {
        key: "urgent",
        title: "⚠️ Urgent / Overdue",
        items: sortedAgendaItems.filter(
          (item) => item.status !== "done" && getAgendaBucket(item) === "urgent",
        ),
      },
      {
        key: "today",
        title: "📅 Today",
        items: sortedAgendaItems.filter(
          (item) => item.status !== "done" && getAgendaBucket(item) === "today",
        ),
      },
      {
        key: "recurring",
        title: "🔁 Recurring",
        items: sortedAgendaItems.filter(
          (item) => item.status !== "done" && getAgendaBucket(item) === "recurring",
        ),
      },
      {
        key: "planned",
        title: "🧠 Backlog / Promoted",
        items: sortedAgendaItems.filter(
          (item) => item.status !== "done" && getAgendaBucket(item) === "planned",
        ),
      },
    ],
    [sortedAgendaItems],
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  );

  const visibleAgendaCount = useMemo(
    () => sortedAgendaItems.filter((item) => item.status !== "done").length,
    [sortedAgendaItems],
  );

  const railCounts = useMemo<Partial<Record<AppView, number>>>(
    () => ({
      workflow: tasks.filter((task) => task.status !== "done").length,
      agenda: isAllWorkspacesMode ? 0 : visibleAgendaCount,
      inbox: capturedItems.filter((item) => item.status === "new").length,
      notifications: unreadNotificationsCount,
    }),
    [capturedItems, isAllWorkspacesMode, tasks, unreadNotificationsCount, visibleAgendaCount],
  );

  return {
    focusedItem,
    stats,
    doneWorkflowCount,
    sortedAgendaItems,
    nextFocusItem,
    focusNowItems,
    agendaSections,
    unreadNotificationsCount,
    railCounts,
  };
}
