import type { Task, TodayItem } from "../../api";

function isToday(date: string) {
  return date === new Date().toISOString().slice(0, 10);
}

function isOverdue(date: string) {
  return date < new Date().toISOString().slice(0, 10);
}

function getTaskTone(task: Pick<Task, "dueDate" | "status">) {
  if (task.status === "done") {
    return "complete";
  }

  if (isOverdue(task.dueDate)) {
    return "overdue";
  }

  if (isToday(task.dueDate)) {
    return "today";
  }

  return "upcoming";
}

function getAgendaScore(item: TodayItem) {
  let score = 0;

  if (item.status === "done") return -999;
  if (isOverdue(item.dueDate)) score += 100;
  if (isToday(item.dueDate)) score += 50;
  if (item.sourceType === "occurrence") score += 20;
  if (item.plannedForDate) score += 10;
  if (item.importance === "high") {
    score += 40;
  } else if (item.importance === "medium") {
    score += 20;
  }
  if (item.status === "blocked") {
    score -= 40;
  }
  if (item.status === "in-progress") {
    score += 30;
  }

  return score;
}

function getTodayReason(item: TodayItem) {
  if (item.sourceType === "occurrence") {
    return "Recurring today";
  }

  if (isOverdue(item.dueDate)) {
    return "Overdue";
  }

  if (isToday(item.dueDate)) {
    return "Due today";
  }

  if (item.plannedForDate && isToday(item.plannedForDate)) {
    return "Promoted into today";
  }

  return "Today";
}

function getAgendaBucket(item: TodayItem) {
  if (item.status === "done") {
    return "completed";
  }

  if (isOverdue(item.dueDate)) {
    return "urgent";
  }

  if (item.sourceType === "occurrence") {
    return "recurring";
  }

  if (isToday(item.dueDate)) {
    return "today";
  }

  return "planned";
}

function getTodayParts() {
  const now = new Date();
  return {
    day: now.getDate(),
    month: now.toLocaleString(undefined, { month: "short" }).toUpperCase(),
    weekday: now.toLocaleString(undefined, { weekday: "short" }).toUpperCase(),
  };
}

export { getAgendaBucket, getAgendaScore, getTaskTone, getTodayParts, getTodayReason, isOverdue, isToday };
