import { request } from "./client";
import type { Notification } from "./types";
import { API_ROUTES } from "../../../../src/shared/api-routes";

function fetchNotifications() {
  return request<Notification[]>(API_ROUTES.notifications.list);
}

function markNotificationRead(id: string) {
  return request<Notification>(API_ROUTES.notifications.read(id), {
    method: "POST",
  });
}

async function markAllNotificationsRead() {
  await request<null>(API_ROUTES.notifications.readAll, {
    method: "POST",
  });
}

export { fetchNotifications, markAllNotificationsRead, markNotificationRead };
