import { Prisma, PrismaClient, RecurrenceRule, TaskActivityType, TaskStatus } from "@prisma/client";

import { prisma } from "../lib/db.js";
import { toDateOnly, toDateTime } from "../lib/dates.js";
import { toApiTask, toApiTaskActivity, toApiTaskComment, type ApiTask } from "../lib/serializers.js";
import { getTaskPermissions, type AuthContext, taskScopedIdWhere } from "../lib/auth.js";

export type StatusValue = "blocked" | "todo" | "in-progress" | "done";
export type RecurrenceValue = "none" | "daily" | "weekdays" | "weekly" | "monthly";

export type TaskInput = {
  title: string;
  details?: string;
  dueDate: string;
  remindAt?: string | null;
  status: StatusValue;
  links?: string[];
  isRecurring?: boolean;
  recurrenceRule?: RecurrenceValue;
  importance?: "low" | "medium" | "high";
  assigneeId?: string | null;
};

export type TaskCommentInput = {
  body: string;
};

export type ApiTaskComment = {
  id: string;
  taskId: string;
  body: string;
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiTaskActivity = {
  id: string;
  taskId: string;
  type: string;
  message: string;
  actorUserId: string | null;
  actorName: string | null;
  createdAt: string;
};

export type ApiTaskDetail = {
  task: ApiTask;
  comments: ApiTaskComment[];
  activities: ApiTaskActivity[];
};

export type MembershipWriteClient = Prisma.TransactionClient | PrismaClient;

export const statusMap: Record<StatusValue, TaskStatus> = {
  blocked: TaskStatus.BLOCKED,
  todo: TaskStatus.TODO,
  "in-progress": TaskStatus.IN_PROGRESS,
  done: TaskStatus.DONE,
};

export const importanceMap = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
} as const;

const recurrenceMap: Record<Exclude<RecurrenceValue, "none">, RecurrenceRule> = {
  daily: RecurrenceRule.DAILY,
  weekdays: RecurrenceRule.WEEKDAYS,
  weekly: RecurrenceRule.WEEKLY,
  monthly: RecurrenceRule.MONTHLY,
};

export function normalizeLinks(links: string[] | undefined) {
  return (links ?? []).map((url) => url.trim()).filter(Boolean);
}

export function normalizeRecurrence(isRecurring: boolean | undefined, recurrenceRule: RecurrenceValue | undefined) {
  if (!isRecurring || !recurrenceRule || recurrenceRule === "none") {
    return null;
  }

  return recurrenceMap[recurrenceRule];
}

export async function getNextSortOrder(workspaceId: string, status: TaskStatus) {
  const { _max } = await prisma.task.aggregate({
    where: { workspaceId, status, archivedAt: null },
    _max: { sortOrder: true },
  });

  return (_max.sortOrder ?? -1) + 1;
}

export function isValidStatus(status: string): status is StatusValue {
  return status in statusMap;
}

function isValidRecurrence(value: string): value is RecurrenceValue {
  return value === "none" || value in recurrenceMap;
}

export function validateTaskInput(input: Partial<TaskInput>): input is TaskInput {
  const recurrenceRule = input.recurrenceRule ?? "none";

  return (
    typeof input.title === "string" &&
    input.title.trim().length > 0 &&
    typeof input.dueDate === "string" &&
    typeof input.status === "string" &&
    isValidStatus(input.status) &&
    typeof recurrenceRule === "string" &&
    isValidRecurrence(recurrenceRule)
  );
}

export function validateTaskCommentInput(input: Partial<TaskCommentInput>): input is TaskCommentInput {
  return typeof input.body === "string" && input.body.trim().length > 0;
}

export function formatActorName(user: { name: string } | null | undefined) {
  return user?.name?.trim() || "Someone";
}

export async function resolveTaskAssigneeId(auth: AuthContext, assigneeId: string | null | undefined) {
  if (typeof assigneeId !== "string" || assigneeId.trim().length === 0) {
    return null;
  }

  const membership = auth.memberships.find(
    (item) => item.workspaceId === auth.workspace.id && item.userId === assigneeId,
  );

  return membership ? membership.userId : undefined;
}

export async function createTaskActivity(
  tx: MembershipWriteClient,
  taskId: string,
  workspaceId: string,
  actorUserId: string | null,
  type: TaskActivityType,
  message: string,
) {
  await tx.taskActivity.create({
    data: {
      taskId,
      workspaceId,
      actorUserId,
      type,
      message,
    },
  });
}

export async function fetchTaskDetail(auth: AuthContext, taskId: string): Promise<ApiTaskDetail | null> {
  const task = await prisma.task.findFirst({
    where: taskScopedIdWhere(auth, taskId),
    include: {
      workspace: true,
      links: { orderBy: { sortOrder: "asc" } },
      assignee: { select: { name: true } },
    },
  });

  if (!task || task.archivedAt) {
    return null;
  }

  const [comments, activities] = await Promise.all([
    prisma.taskComment.findMany({
      where: {
        taskId,
        ...(auth.allWorkspaces ? {} : { workspaceId: auth.workspace.id }),
      },
      include: {
        author: { select: { name: true } },
      },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.taskActivity.findMany({
      where: {
        taskId,
        ...(auth.allWorkspaces ? {} : { workspaceId: auth.workspace.id }),
      },
      include: {
        actor: { select: { name: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);

  return {
    task: toApiTask(task, getTaskPermissions(auth, task)),
    comments: comments.map((comment) => toApiTaskComment(comment)),
    activities: activities.map((activity) => toApiTaskActivity(activity)),
  };
}

export { TaskActivityType, TaskStatus };
