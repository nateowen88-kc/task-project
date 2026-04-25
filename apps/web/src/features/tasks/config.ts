import type { RecurrenceRuleValue, TaskDraft, TaskImportance, TaskStatus, WorkspaceRole } from "../../api";

const STATUS_LABELS: Record<TaskStatus, string> = {
  blocked: "Blocked",
  todo: "To Do",
  "in-progress": "In Progress",
  done: "Done",
};

const IMPORTANCE_LABELS: Record<TaskImportance, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const RECURRENCE_LABELS: Record<RecurrenceRuleValue, string> = {
  none: "Does not repeat",
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
  monthly: "Monthly",
};

const STATUS_ORDER: TaskStatus[] = ["blocked", "todo", "in-progress", "done"];
const RECURRENCE_OPTIONS: RecurrenceRuleValue[] = ["daily", "weekdays", "weekly", "monthly"];

const STATUS_ICONS: Record<TaskStatus, string> = {
  blocked: "⛔",
  todo: "☑",
  "in-progress": "◷",
  done: "✓",
};

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  user: "User",
};

function getOffsetDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function createEmptyDraft(): TaskDraft {
  return {
    title: "",
    details: "",
    links: "",
    dueDate: getOffsetDate(0),
    remindAt: "",
    status: "todo",
    assigneeId: "",
    isRecurring: false,
    recurrenceRule: "daily",
    importance: "medium",
  };
}

export {
  createEmptyDraft,
  getOffsetDate,
  IMPORTANCE_LABELS,
  RECURRENCE_LABELS,
  RECURRENCE_OPTIONS,
  ROLE_LABELS,
  STATUS_ICONS,
  STATUS_LABELS,
  STATUS_ORDER,
};
