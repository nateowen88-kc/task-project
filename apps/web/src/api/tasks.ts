import { request } from "./client";
import { toTaskPayload } from "./helpers";
import type {
  RunTaskPlaybookResponse,
  Task,
  TaskDetail,
  TaskDraft,
  TaskPlaybook,
  TaskPlaybookPayload,
  TaskStatus,
  TaskTemplate,
  TaskTemplatePayload,
  TodayItem,
  TodayItemSource,
} from "./types";
import { API_ROUTES } from "../../../../src/shared/api-routes";

function fetchTasks() {
  return request<Task[]>(API_ROUTES.tasks.list);
}

function fetchTaskDetail(id: string) {
  return request<TaskDetail>(API_ROUTES.tasks.detail(id));
}

function fetchTaskTemplates() {
  return request<TaskTemplate[]>(API_ROUTES.tasks.templates);
}

function createTaskTemplate(payload: TaskTemplatePayload) {
  return request<TaskTemplate>(API_ROUTES.tasks.templates, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function deleteTaskTemplate(id: string) {
  await request<null>(API_ROUTES.tasks.template(id), {
    method: "DELETE",
  });
}

function fetchTaskPlaybooks() {
  return request<TaskPlaybook[]>(API_ROUTES.tasks.playbooks);
}

function createTaskPlaybook(payload: TaskPlaybookPayload) {
  return request<TaskPlaybook>(API_ROUTES.tasks.playbooks, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function deleteTaskPlaybook(id: string) {
  await request<null>(API_ROUTES.tasks.playbook(id), {
    method: "DELETE",
  });
}

function runTaskPlaybook(id: string) {
  return request<RunTaskPlaybookResponse>(API_ROUTES.tasks.runPlaybook(id), {
    method: "POST",
  });
}

function createTaskComment(id: string, body: string) {
  return request<TaskDetail>(API_ROUTES.tasks.comments(id), {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

function createTask(draft: TaskDraft) {
  return request<Task>(API_ROUTES.tasks.create, {
    method: "POST",
    body: JSON.stringify(toTaskPayload(draft)),
  });
}

function updateTask(id: string, draft: TaskDraft) {
  return request<Task>(API_ROUTES.tasks.update(id), {
    method: "PUT",
    body: JSON.stringify(toTaskPayload(draft)),
  });
}

function updateTaskStatus(id: string, status: TaskStatus) {
  return request<Task>(API_ROUTES.tasks.status(id), {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

function archiveTask(id: string) {
  return request<Task>(API_ROUTES.tasks.archive(id), {
    method: "PATCH",
  });
}

async function deleteTask(id: string) {
  await request<null>(API_ROUTES.tasks.delete(id), {
    method: "DELETE",
  });
}

function updateTodayItemStatus(source: TodayItemSource, id: string, status: TaskStatus) {
  return request<TodayItem>(API_ROUTES.agenda.itemStatus(source, id), {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

function skipTodayItem(source: TodayItemSource, id: string) {
  return request<TodayItem>(API_ROUTES.agenda.itemSkip(source, id), {
    method: "PATCH",
  });
}

function snoozeTodayItem(source: TodayItemSource, id: string) {
  return request<TodayItem>(API_ROUTES.agenda.itemSnooze(source, id), {
    method: "PATCH",
  });
}

export {
  archiveTask,
  createTask,
  createTaskComment,
  createTaskPlaybook,
  createTaskTemplate,
  deleteTaskPlaybook,
  deleteTaskTemplate,
  deleteTask,
  fetchTaskDetail,
  fetchTaskPlaybooks,
  fetchTasks,
  fetchTaskTemplates,
  runTaskPlaybook,
  skipTodayItem,
  snoozeTodayItem,
  updateTask,
  updateTaskStatus,
  updateTodayItemStatus,
};
