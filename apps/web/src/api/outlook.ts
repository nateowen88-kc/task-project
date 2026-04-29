import { request, resolveRequestInput } from "./client";
import type { OutlookCalendarEvent, OutlookCalendarStatus } from "./types";
import { API_ROUTES } from "../../../../src/shared/api-routes";

function fetchOutlookCalendarStatus() {
  return request<OutlookCalendarStatus>(API_ROUTES.integrations.outlookStatus);
}

function fetchOutlookCalendarEvents(start: string, end: string) {
  const search = new URLSearchParams({ start, end });
  return request<OutlookCalendarEvent[]>(`${API_ROUTES.integrations.outlookEvents}?${search.toString()}`);
}

function disconnectOutlookCalendar() {
  return request<null>(API_ROUTES.integrations.outlookConnection, {
    method: "DELETE",
  });
}

function getOutlookConnectUrl() {
  return String(resolveRequestInput(API_ROUTES.integrations.outlookConnect));
}

export {
  disconnectOutlookCalendar,
  fetchOutlookCalendarEvents,
  fetchOutlookCalendarStatus,
  getOutlookConnectUrl,
};
