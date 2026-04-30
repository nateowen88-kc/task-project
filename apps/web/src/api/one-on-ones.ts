import { API_ROUTES } from "../../../../src/shared/api-routes";
import { request } from "./client";
import type {
  CompleteOneOnOneMeetingPayload,
  CreateDirectReportPayload,
  CreateOneOnOneAgendaItemPayload,
  CreateOneOnOneMeetingPayload,
  DirectReport,
  OneOnOneAgendaItem,
  OneOnOneMeeting,
  UpdateDirectReportPayload,
  UpdateOneOnOneAgendaItemPayload,
  UpdateOneOnOneMeetingPayload,
} from "./types";

function fetchDirectReports() {
  return request<DirectReport[]>(API_ROUTES.oneOnOnes.list);
}

function createDirectReport(payload: CreateDirectReportPayload) {
  return request<DirectReport>(API_ROUTES.oneOnOnes.reports, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function updateDirectReport(id: string, payload: UpdateDirectReportPayload) {
  return request<DirectReport>(API_ROUTES.oneOnOnes.report(id), {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

async function deleteDirectReport(id: string) {
  await request<null>(API_ROUTES.oneOnOnes.report(id), {
    method: "DELETE",
  });
}

function createOneOnOneAgendaItem(reportId: string, payload: CreateOneOnOneAgendaItemPayload) {
  return request<OneOnOneAgendaItem>(API_ROUTES.oneOnOnes.agendaItems(reportId), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function updateOneOnOneAgendaItem(id: string, payload: UpdateOneOnOneAgendaItemPayload) {
  return request<OneOnOneAgendaItem>(API_ROUTES.oneOnOnes.agendaItem(id), {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

async function deleteOneOnOneAgendaItem(id: string) {
  await request<null>(API_ROUTES.oneOnOnes.agendaItem(id), {
    method: "DELETE",
  });
}

function createOneOnOneMeeting(reportId: string, payload: CreateOneOnOneMeetingPayload) {
  return request<OneOnOneMeeting>(API_ROUTES.oneOnOnes.meetings(reportId), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function completeOneOnOneMeeting(reportId: string, payload: CompleteOneOnOneMeetingPayload) {
  return request<DirectReport>(API_ROUTES.oneOnOnes.completeMeeting(reportId), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function updateOneOnOneMeeting(id: string, payload: UpdateOneOnOneMeetingPayload) {
  return request<OneOnOneMeeting>(API_ROUTES.oneOnOnes.meeting(id), {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

async function deleteOneOnOneMeeting(id: string) {
  await request<null>(API_ROUTES.oneOnOnes.meeting(id), {
    method: "DELETE",
  });
}

export {
  createDirectReport,
  createOneOnOneAgendaItem,
  completeOneOnOneMeeting,
  createOneOnOneMeeting,
  deleteDirectReport,
  deleteOneOnOneAgendaItem,
  deleteOneOnOneMeeting,
  fetchDirectReports,
  updateDirectReport,
  updateOneOnOneAgendaItem,
  updateOneOnOneMeeting,
};
