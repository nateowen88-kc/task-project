import type { TaskDraft, TaskPayload } from "./types";

function parseLinks(raw: string) {
  return raw
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toTaskPayload(draft: TaskDraft): TaskPayload {
  return {
    title: draft.title,
    details: draft.details,
    dueDate: draft.dueDate,
    remindAt: draft.remindAt || null,
    status: draft.status,
    importance: draft.importance,
    assigneeId: draft.assigneeId || null,
    links: parseLinks(draft.links),
    isRecurring: draft.isRecurring,
    recurrenceRule: draft.isRecurring ? draft.recurrenceRule : "none",
  };
}

export { toTaskPayload };
