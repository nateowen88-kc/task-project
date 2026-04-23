import type { CapturedItem, Task, TaskDraft } from "../../api";
import { getOffsetDate } from "./config";

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 16);
}

function createDraftFromCapture(item: CapturedItem): TaskDraft {
  const details = [
    item.body.trim(),
    item.sender ? `From: ${item.sender}` : null,
    item.sourceLabel ? `Source: ${item.sourceLabel}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    title: item.title,
    details,
    links: item.sourceUrl ?? "",
    dueDate: item.suggestedDueDate ?? getOffsetDate(0),
    remindAt: "",
    status: "todo",
    assigneeId: "",
    isRecurring: false,
    recurrenceRule: "daily",
    importance: "medium",
  };
}

function sortByDueDate(tasks: Task[]) {
  return [...tasks].sort((left, right) => {
    if (left.dueDate === right.dueDate) {
      return left.createdAt.localeCompare(right.createdAt);
    }

    return left.dueDate.localeCompare(right.dueDate);
  });
}

export { createDraftFromCapture, sortByDueDate, toDateTimeLocal };
