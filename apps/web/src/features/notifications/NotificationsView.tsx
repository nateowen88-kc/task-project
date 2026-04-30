import type { Notification } from "../../api";
import { SectionHeader } from "../../components/layout/SectionHeader";
import { TodayCalendarBadge } from "../../components/ui/TodayCalendarBadge";
import { formatNotificationTime } from "../../lib/formatters";

type NotificationsViewProps = {
  notifications: Notification[];
  unreadNotificationsCount: number;
  todayBadge: { month: string; day: number; weekday: string };
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onOpenNotification: (notification: Notification) => void;
};

export function NotificationsView({
  notifications,
  unreadNotificationsCount,
  todayBadge,
  onMarkAllRead,
  onMarkRead,
  onOpenNotification,
}: NotificationsViewProps) {
  return (
    <section className="panel today-panel notifications-panel">
      <SectionHeader
        wide
        eyebrow="Notifications"
        title="Assignments, comments, and due reminders"
        leading={<TodayCalendarBadge month={todayBadge.month} day={todayBadge.day} weekday={todayBadge.weekday} />}
        actions={
          <>
            <span>{unreadNotificationsCount > 0 ? `${unreadNotificationsCount} unread` : "All caught up"}</span>
            <button className="ghost-button" type="button" onClick={onMarkAllRead} disabled={unreadNotificationsCount === 0}>
              Mark all read
            </button>
          </>
        }
      />

      <div className="notifications-list">
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <article key={notification.id} className={`notification-card ${notification.readAt ? "is-read" : "is-unread"}`}>
              <div className="notification-card-top">
                <div className="notification-heading">
                  <span className={`notification-dot ${notification.readAt ? "is-read" : "is-unread"}`} aria-hidden="true" />
                  <div>
                    <h3>{notification.title}</h3>
                    <p>{notification.body}</p>
                  </div>
                </div>
                <span className="notification-time">{formatNotificationTime(notification.createdAt)}</span>
              </div>

              <div className="notification-meta">
                {notification.workspaceName && <span>{notification.workspaceName}</span>}
                {notification.actorName && <span>From {notification.actorName}</span>}
              </div>

              <div className="notification-actions">
                {notification.taskId && (
                  <button className="primary-button compact" type="button" onClick={() => onOpenNotification(notification)}>
                    Open task
                  </button>
                )}
                {!notification.readAt && (
                  <button className="ghost-button compact" type="button" onClick={() => onMarkRead(notification.id)}>
                    Mark read
                  </button>
                )}
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <p>No notifications yet.</p>
            <span>Assignments, comments, and due reminders will land here.</span>
          </div>
        )}
      </div>
    </section>
  );
}
