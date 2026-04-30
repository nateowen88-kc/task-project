import type { RecurrenceRuleValue, TaskDraft, TaskImportance, TaskStatus, TaskTemplate, WorkspaceRole } from "../../api";

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

function createDraftFromTemplate(template: TaskTemplate): TaskDraft {
  const dueDate = getOffsetDate(template.dueDaysOffset);
  const remindAt =
    template.remindDaysOffset === null
      ? ""
      : (() => {
          const date = new Date();
          date.setDate(date.getDate() + template.dueDaysOffset - template.remindDaysOffset);
          date.setHours(9, 0, 0, 0);
          return date.toISOString().slice(0, 16);
        })();

  return {
    title: template.title,
    details: template.details,
    links: template.links.join("\n"),
    dueDate,
    remindAt,
    status: template.status,
    assigneeId: "",
    isRecurring: template.isRecurring,
    recurrenceRule: template.recurrenceRule === "none" ? "daily" : template.recurrenceRule,
    importance: template.importance,
  };
}

export {
  createDraftFromTemplate,
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
