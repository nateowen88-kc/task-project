import { TaskStatus, type Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "../lib/db.js";
import { formatDate, toDateOnly } from "../lib/dates.js";
import { reverseNotificationTypeMap, type NotificationTypeDb } from "../lib/serializers.js";
import { type AuthContext, workspaceWhere } from "../lib/auth.js";

export function notificationDelegate(client: Prisma.TransactionClient | PrismaClient) {
  return (client as Prisma.TransactionClient & { notification: any }).notification;
}

export async function createNotification(
  tx: Prisma.TransactionClient | PrismaClient,
  input: {
    workspaceId: string;
    userId: string;
    actorUserId?: string | null;
    taskId?: string | null;
    type: NotificationTypeDb;
    title: string;
    body: string;
    dedupeKey?: string | null;
  },
) {
  const notifications = notificationDelegate(tx);

  if (input.dedupeKey) {
    const existing = await notifications.findUnique({
      where: { dedupeKey: input.dedupeKey },
    });

    if (existing) {
      return existing;
    }
  }

  return notifications.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      actorUserId: input.actorUserId ?? null,
      taskId: input.taskId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      dedupeKey: input.dedupeKey ?? null,
    },
  });
}

export async function notifyTaskAssignment(
  tx: Prisma.TransactionClient | PrismaClient,
  input: {
    workspaceId: string;
    taskId: string;
    taskTitle: string;
    actorUserId?: string | null;
    actorName: string;
    assigneeId?: string | null;
    isReassignment?: boolean;
  },
) {
  if (!input.assigneeId || input.assigneeId === input.actorUserId) {
    return;
  }

  await createNotification(tx, {
    workspaceId: input.workspaceId,
    userId: input.assigneeId,
    actorUserId: input.actorUserId ?? null,
    taskId: input.taskId,
    type: "TASK_ASSIGNED",
    title: input.isReassignment ? "Task reassigned to you" : "Task assigned to you",
    body: input.isReassignment
      ? `${input.actorName} assigned "${input.taskTitle}" to you.`
      : `${input.actorName} created and assigned "${input.taskTitle}" to you.`,
  });
}

export async function notifyTaskComment(
  tx: Prisma.TransactionClient | PrismaClient,
  input: {
    workspaceId: string;
    taskId: string;
    taskTitle: string;
    actorUserId?: string | null;
    actorName: string;
    createdById?: string | null;
    assigneeId?: string | null;
  },
) {
  const recipients = new Set<string>(
    [input.createdById, input.assigneeId].filter((value): value is string => Boolean(value)),
  );
  if (input.actorUserId) {
    recipients.delete(input.actorUserId);
  }

  for (const userId of recipients) {
    await createNotification(tx, {
      workspaceId: input.workspaceId,
      userId,
      actorUserId: input.actorUserId ?? null,
      taskId: input.taskId,
      type: "COMMENT_ADDED",
      title: "New comment on a task",
      body: `${input.actorName} commented on "${input.taskTitle}".`,
    });
  }
}

export async function syncDueNotifications(auth: AuthContext) {
  const today = formatDate(new Date());
  const dueCutoff = toDateOnly(today);
  const tasks = await prisma.task.findMany({
    where: {
      ...workspaceWhere(auth),
      assigneeId: auth.user.id,
      archivedAt: null,
      status: { not: TaskStatus.DONE },
      dueDate: { lte: dueCutoff },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      workspaceId: true,
    },
  });

  for (const task of tasks) {
    const dueDate = formatDate(task.dueDate);
    const type: NotificationTypeDb = dueDate < today ? "TASK_OVERDUE" : "TASK_DUE";
    const dedupeKey = `${reverseNotificationTypeMap[type]}:${auth.user.id}:${task.id}:${today}`;
    await createNotification(prisma, {
      workspaceId: task.workspaceId,
      userId: auth.user.id,
      taskId: task.id,
      type,
      title: type === "TASK_OVERDUE" ? "Task overdue" : "Task due today",
      body:
        type === "TASK_OVERDUE"
          ? `"${task.title}" is overdue and still needs attention.`
          : `"${task.title}" is due today.`,
      dedupeKey,
    });
  }
}
