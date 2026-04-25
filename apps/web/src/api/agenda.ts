import { request } from "./client";
import type { AgendaResponse } from "./types";
import { API_ROUTES } from "../../../../src/shared/api-routes";

function fetchTodayAgenda(date?: string) {
  const search = date ? `?date=${encodeURIComponent(date)}` : "";
  return request<AgendaResponse>(`${API_ROUTES.agenda.today}${search}`);
}

function generateTodayAgenda(date?: string) {
  return request<AgendaResponse>(API_ROUTES.agenda.generate, {
    method: "POST",
    body: JSON.stringify(date ? { date } : {}),
  });
}

export { fetchTodayAgenda, generateTodayAgenda };
