export type TaskStatus = "blocked" | "todo" | "in-progress" | "done";
export type RecurrenceRuleValue = "none" | "daily" | "weekdays" | "weekly" | "monthly";
export type TodayItemSource = "task" | "occurrence";
export type CaptureSourceType = "slack" | "email";
export type CaptureStatus = "new" | "accepted" | "discarded";

export type Task = {
  id: string;
  title: string;
  details: string;
  dueDate: string;
  remindAt: string | null;
  status: TaskStatus;
  links: string[];
  isRecurring: boolean;
  recurrenceRule: RecurrenceRuleValue;
  plannedForDate: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TodayItem = {
  id: string;
  taskId: string;
  sourceType: TodayItemSource;
  title: string;
  details: string;
  dueDate: string;
  scheduledFor: string;
  remindAt: string | null;
  status: TaskStatus;
  links: string[];
  isRecurring: boolean;
  recurrenceRule: RecurrenceRuleValue;
  plannedForDate: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgendaResponse = {
  date: string;
  promotedTaskCount: number;
  items: TodayItem[];
};

export type CapturedItem = {
  id: string;
  sourceType: CaptureSourceType;
  status: CaptureStatus;
  externalId: string | null;
  title: string;
  body: string;
  sourceLabel: string | null;
  sourceUrl: string | null;
  sender: string | null;
  suggestedDueDate: string | null;
  receivedAt: string;
  acceptedAt: string | null;
  discardedAt: string | null;
  taskId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskDraft = {
  title: string;
  details: string;
  dueDate: string;
  remindAt: string;
  status: TaskStatus;
  links: string;
  isRecurring: boolean;
  recurrenceRule: RecurrenceRuleValue;
};

type TaskPayload = {
  title: string;
  details: string;
  dueDate: string;
  remindAt: string | null;
  status: TaskStatus;
  links: string[];
  isRecurring: boolean;
  recurrenceRule: RecurrenceRuleValue;
};

function parseLinks(raw: string) {
  return raw
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toPayload(draft: TaskDraft): TaskPayload {
  return {
    title: draft.title,
    details: draft.details,
    dueDate: draft.dueDate,
    remindAt: draft.remindAt || null,
    status: draft.status,
    links: parseLinks(draft.links),
    isRecurring: draft.isRecurring,
    recurrenceRule: draft.isRecurring ? draft.recurrenceRule : "none",
  };
}

async function request<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Request failed.");
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

export async function fetchTasks() {
  return request<Task[]>("/api/tasks");
}

export async function fetchCapturedItems() {
  return request<CapturedItem[]>("/api/captured-items");
}

export async function fetchTodayAgenda(date?: string) {
  const search = date ? `?date=${encodeURIComponent(date)}` : "";
  return request<AgendaResponse>(`/api/today${search}`);
}

export async function generateTodayAgenda(date?: string) {
  return request<AgendaResponse>("/api/agenda/generate", {
    method: "POST",
    body: JSON.stringify(date ? { date } : {}),
  });
}

export async function createTask(draft: TaskDraft) {
  return request<Task>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(toPayload(draft)),
  });
}

export async function acceptCapturedItem(id: string, draft: TaskDraft) {
  return request<Task>(`/api/captured-items/${id}/accept`, {
    method: "POST",
    body: JSON.stringify(toPayload(draft)),
  });
}

export async function discardCapturedItem(id: string) {
  return request<CapturedItem>(`/api/captured-items/${id}/discard`, {
    method: "PATCH",
  });
}

export async function createDemoSlackCapture() {
  return request<CapturedItem>("/api/captured-items/demo/slack", {
    method: "POST",
  });
}

export async function createDemoEmailCapture() {
  return request<CapturedItem>("/api/captured-items/demo/email", {
    method: "POST",
  });
}

export async function updateTask(id: string, draft: TaskDraft) {
  return request<Task>(`/api/tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify(toPayload(draft)),
  });
}

export async function updateTaskStatus(id: string, status: TaskStatus) {
  return request<Task>(`/api/tasks/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function updateTodayItemStatus(source: TodayItemSource, id: string, status: TaskStatus) {
  return request<TodayItem>(`/api/today-items/${source}/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function archiveTask(id: string) {
  return request<Task>(`/api/tasks/${id}/archive`, {
    method: "PATCH",
  });
}

export async function deleteTask(id: string) {
  await request<null>(`/api/tasks/${id}`, {
    method: "DELETE",
  });
}

export async function skipTodayItem(source: TodayItemSource, id: string) {
  return request<TodayItem>(`/api/today-items/${source}/${id}/skip`, {
    method: "PATCH",
  });
}

export async function snoozeTodayItem(source: TodayItemSource, id: string) {
  return request<TodayItem>(`/api/today-items/${source}/${id}/snooze`, {
    method: "PATCH",
  });
}
