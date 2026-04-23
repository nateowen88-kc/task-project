import { Notification, Task, markAllNotificationsRead, markNotificationRead } from "../../api";

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type UseNotificationActionsOptions = {
  tasks: Task[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  onError: (message: string | null) => void;
  onOpenTask: (task: Task) => Promise<void>;
};

export function useNotificationActions({
  tasks,
  setNotifications,
  onError,
  onOpenTask,
}: UseNotificationActionsOptions) {
  async function handleMarkNotificationRead(notificationId: string) {
    onError(null);

    try {
      const updated = await markNotificationRead(notificationId);
      setNotifications((current) =>
        current.map((notification) => (notification.id === updated.id ? updated : notification)),
      );
    } catch (error) {
      onError(toErrorMessage(error, "Could not update notification."));
    }
  }

  async function handleMarkAllNotificationsRead() {
    onError(null);

    try {
      await markAllNotificationsRead();
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? new Date().toISOString(),
        })),
      );
    } catch (error) {
      onError(toErrorMessage(error, "Could not mark notifications read."));
    }
  }

  async function handleOpenNotification(notification: Notification) {
    if (!notification.readAt) {
      await handleMarkNotificationRead(notification.id);
    }

    if (!notification.taskId) {
      return;
    }

    const task = tasks.find((item) => item.id === notification.taskId);
    if (!task) {
      onError("This notification points to a task that is no longer available in the current view.");
      return;
    }

    await onOpenTask(task);
  }

  return {
    handleMarkNotificationRead,
    handleMarkAllNotificationsRead,
    handleOpenNotification,
  };
}
