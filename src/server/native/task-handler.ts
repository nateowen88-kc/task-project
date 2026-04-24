import { prisma } from "../lib/db.js";
import {
  canAssignTasks,
  getAuthContext,
  getTaskPermissions,
  workspaceScopedIdWhere,
  workspaceWhere,
} from "../lib/auth.js";
import { addDays, formatDate, toDateOnly, toDateTime } from "../lib/dates.js";
import { reverseStatusMap, toApiTask, toApiTodayOccurrence, toApiTodayTask } from "../lib/serializers.js";
import { notifyTaskAssignment, notifyTaskComment } from "../services/notification-service.js";
import { normalizeCaptureLinks } from "../services/capture-service.js";
import {
  createTaskActivity,
  fetchTaskDetail,
  formatActorName,
  getNextSortOrder,
  importanceMap,
  isValidStatus,
  normalizeLinks,
  normalizeRecurrence,
  resolveTaskAssigneeId,
  statusMap,
  TaskActivityType,
  TaskStatus,
  validateTaskCommentInput,
  validateTaskInput,
  type TaskCommentInput,
  type TaskInput,
} from "../services/task-service.js";
import { API_ROUTES } from "../../shared/api-routes.js";
import {
  getPathname,
  matchPath,
  methodNotAllowed,
  NativeRequest,
  NativeResponse,
  notFound,
  readJsonBody,
  rejectDisallowedBrowserOrigin,
  sendEmpty,
  sendJson,
} from "./http.js";

const taskInclude = {
  workspace: true,
  links: { orderBy: { sortOrder: "asc" as const } },
  assignee: { select: { name: true } },
};

const occurrenceInclude = {
  task: {
    include: taskInclude,
  },
};

async function getAuth(request: NativeRequest, response: NativeResponse) {
  const auth = await getAuthContext(request as any);
  if (!auth) {
    sendJson(response, 401, { error: "Authentication required." });
    return null;
  }

  return auth;
}

export default async function taskHandler(request: NativeRequest, response: NativeResponse) {
  const pathname = getPathname(request);
  const method = request.method ?? "GET";

  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && rejectDisallowedBrowserOrigin(request, response)) {
    return;
  }

  const auth = await getAuth(request, response);

  if (!auth) {
    return;
  }

  if (method === "GET" && (pathname === API_ROUTES.tasks.list || pathname === "/api/tasks/index")) {
    const tasks = await prisma.task.findMany({
      where: {
        ...workspaceWhere(auth),
        archivedAt: null,
      },
      include: taskInclude,
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    });

    sendJson(response, 200, tasks.map((task) => toApiTask(task, getTaskPermissions(auth, task))));
    return;
  }

  const detailMatch = matchPath(pathname, "/api/tasks/:id/detail");
  if (method === "GET" && detailMatch) {
    const detail = await fetchTaskDetail(auth, detailMatch.id);

    if (!detail) {
      sendJson(response, 404, { error: "Task not found." });
      return;
    }

    sendJson(response, 200, detail);
    return;
  }

  const commentsMatch = matchPath(pathname, "/api/tasks/:id/comments");
  if (method === "POST" && commentsMatch) {
    const input = (await readJsonBody<Partial<TaskCommentInput>>(request)) ?? {};

    if (!validateTaskCommentInput(input)) {
      sendJson(response, 400, { error: "Comment body is required." });
      return;
    }

    const task = await prisma.task.findFirst({
      where: workspaceScopedIdWhere(auth, commentsMatch.id),
      select: {
        id: true,
        workspaceId: true,
        archivedAt: true,
        title: true,
        createdById: true,
        assigneeId: true,
      },
    });

    if (!task || task.archivedAt) {
      sendJson(response, 404, { error: "Task not found." });
      return;
    }

    if (!getTaskPermissions(auth, task).canComment) {
      sendJson(response, 403, { error: "You do not have permission to comment on this task." });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.taskComment.create({
        data: {
          taskId: task.id,
          workspaceId: task.workspaceId,
          authorId: auth.user.id,
          body: input.body.trim(),
        },
      });

      await createTaskActivity(
        tx,
        task.id,
        task.workspaceId,
        auth.user.id,
        TaskActivityType.COMMENT_ADDED,
        `${formatActorName(auth.user)} added a comment.`,
      );

      await notifyTaskComment(tx, {
        workspaceId: task.workspaceId,
        taskId: task.id,
        taskTitle: task.title,
        actorUserId: auth.user.id,
        actorName: formatActorName(auth.user),
        createdById: task.createdById,
        assigneeId: task.assigneeId,
      });
    });

    const detail = await fetchTaskDetail(auth, commentsMatch.id);
    sendJson(response, 201, detail);
    return;
  }

  if (method === "POST" && pathname === API_ROUTES.tasks.create) {
    const input = (await readJsonBody<Partial<TaskInput>>(request)) ?? {};

    if (!validateTaskInput(input)) {
      sendJson(response, 400, { error: "Invalid task payload." });
      return;
    }

    const recurrenceRule = normalizeRecurrence(input.isRecurring, input.recurrenceRule);
    const status = statusMap[input.status];
    const links = normalizeLinks(input.links);
    const sortOrder = await getNextSortOrder(auth.workspace.id, status);
    const assigneeId = await resolveTaskAssigneeId(auth, input.assigneeId);

    if (typeof assigneeId === "undefined") {
      sendJson(response, 400, { error: "Assignee must be a member of this workspace." });
      return;
    }

    if (!canAssignTasks(auth) && assigneeId && assigneeId !== auth.user.id) {
      sendJson(response, 403, { error: "You can only assign tasks to yourself." });
      return;
    }

    const task = await prisma.$transaction(async (tx) => {
      const createdTask = await tx.task.create({
        data: {
          workspaceId: auth.workspace.id,
          createdById: auth.user.id,
          assigneeId: assigneeId ?? auth.user.id,
          title: input.title.trim(),
          details: input.details?.trim() ?? "",
          dueDate: toDateOnly(input.dueDate),
          remindAt: toDateTime(input.remindAt),
          status,
          importance: input.importance ? (importanceMap[input.importance] as any) : "MEDIUM",
          sortOrder,
          isRecurring: Boolean(recurrenceRule),
          recurrenceRule,
          archivedAt: null,
          completedAt: status === TaskStatus.DONE ? new Date() : null,
          links: {
            create: links.map((url, index) => ({
              url,
              sortOrder: index,
            })),
          },
        },
        include: taskInclude,
      });

      await createTaskActivity(
        tx,
        createdTask.id,
        createdTask.workspaceId,
        auth.user.id,
        TaskActivityType.CREATED,
        `${formatActorName(auth.user)} created the task.`,
      );

      await notifyTaskAssignment(tx, {
        workspaceId: createdTask.workspaceId,
        taskId: createdTask.id,
        taskTitle: createdTask.title,
        actorUserId: auth.user.id,
        actorName: formatActorName(auth.user),
        assigneeId: createdTask.assigneeId,
      });

      return createdTask;
    });

    sendJson(response, 201, toApiTask(task, getTaskPermissions(auth, task)));
    return;
  }

  const taskIdMatch = matchPath(pathname, "/api/tasks/:id");
  if (method === "PUT" && taskIdMatch) {
    const input = (await readJsonBody<Partial<TaskInput>>(request)) ?? {};

    if (!validateTaskInput(input)) {
      sendJson(response, 400, { error: "Invalid task payload." });
      return;
    }

    const existing = await prisma.task.findFirst({
      where: workspaceScopedIdWhere(auth, taskIdMatch.id),
    });

    if (!existing || existing.archivedAt) {
      sendJson(response, 404, { error: "Task not found." });
      return;
    }

    const permissions = getTaskPermissions(auth, existing);
    if (!permissions.canEdit) {
      sendJson(response, 403, { error: "You do not have permission to edit this task." });
      return;
    }

    const recurrenceRule = normalizeRecurrence(input.isRecurring, input.recurrenceRule);
    const status = statusMap[input.status];
    const links = normalizeLinks(input.links);
    const sortOrder =
      existing.status === status ? existing.sortOrder : await getNextSortOrder(auth.workspace.id, status);
    const assigneeId = await resolveTaskAssigneeId(auth, input.assigneeId);

    if (typeof assigneeId === "undefined") {
      sendJson(response, 400, { error: "Assignee must be a member of this workspace." });
      return;
    }

    if (!permissions.canReassign && assigneeId !== null && assigneeId !== auth.user.id) {
      sendJson(response, 403, { error: "You do not have permission to reassign this task." });
      return;
    }

    const nextAssigneeId = assigneeId ?? null;
    const actorName = formatActorName(auth.user);
    const task = await prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id: taskIdMatch.id },
        data: {
          title: input.title.trim(),
          details: input.details?.trim() ?? "",
          dueDate: toDateOnly(input.dueDate),
          remindAt: toDateTime(input.remindAt),
          status,
          importance: input.importance ? (importanceMap[input.importance] as any) : existing.importance,
          assigneeId: nextAssigneeId,
          sortOrder,
          isRecurring: Boolean(recurrenceRule),
          recurrenceRule,
          plannedForDate: status === TaskStatus.DONE ? null : existing.plannedForDate,
          completedAt: status === TaskStatus.DONE ? existing.completedAt ?? new Date() : null,
          links: {
            deleteMany: {},
            create: links.map((url, index) => ({
              url,
              sortOrder: index,
            })),
          },
        },
        include: taskInclude,
      });

      await createTaskActivity(
        tx,
        updatedTask.id,
        updatedTask.workspaceId,
        auth.user.id,
        TaskActivityType.UPDATED,
        `${actorName} updated the task details.`,
      );

      if (existing.status !== status) {
        await createTaskActivity(
          tx,
          updatedTask.id,
          updatedTask.workspaceId,
          auth.user.id,
          TaskActivityType.STATUS_CHANGED,
          `${actorName} changed status from ${reverseStatusMap[existing.status]} to ${input.status}.`,
        );
      }

      if ((existing.assigneeId ?? null) !== nextAssigneeId) {
        const assigneeLabel = updatedTask.assignee?.name ?? "Unassigned";
        await createTaskActivity(
          tx,
          updatedTask.id,
          updatedTask.workspaceId,
          auth.user.id,
          TaskActivityType.ASSIGNEE_CHANGED,
          nextAssigneeId
            ? `${actorName} assigned this task to ${assigneeLabel}.`
            : `${actorName} unassigned this task.`,
        );

        await notifyTaskAssignment(tx, {
          workspaceId: updatedTask.workspaceId,
          taskId: updatedTask.id,
          taskTitle: updatedTask.title,
          actorUserId: auth.user.id,
          actorName,
          assigneeId: nextAssigneeId,
          isReassignment: true,
        });
      }

      return updatedTask;
    });

    sendJson(response, 200, toApiTask(task, getTaskPermissions(auth, task)));
    return;
  }

  const taskStatusMatch = matchPath(pathname, "/api/tasks/:id/status");
  if (method === "PATCH" && taskStatusMatch) {
    const input = (await readJsonBody<{ status?: string }>(request)) ?? {};
    const statusValue = input.status;

    if (!statusValue || !isValidStatus(statusValue)) {
      sendJson(response, 400, { error: "Invalid status payload." });
      return;
    }

    const existing = await prisma.task.findFirst({
      where: workspaceScopedIdWhere(auth, taskStatusMatch.id),
      include: taskInclude,
    });

    if (!existing || existing.archivedAt) {
      sendJson(response, 404, { error: "Task not found." });
      return;
    }

    if (!getTaskPermissions(auth, existing).canChangeStatus) {
      sendJson(response, 403, { error: "You do not have permission to update this task." });
      return;
    }

    const status = statusMap[statusValue];
    const sortOrder =
      existing.status === status ? existing.sortOrder : await getNextSortOrder(auth.workspace.id, status);

    const task = await prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id: taskStatusMatch.id },
        data: {
          status,
          sortOrder,
          plannedForDate: status === TaskStatus.DONE ? null : existing.plannedForDate,
          completedAt: status === TaskStatus.DONE ? existing.completedAt ?? new Date() : null,
        },
        include: taskInclude,
      });

      await createTaskActivity(
        tx,
        updatedTask.id,
        updatedTask.workspaceId,
        auth.user.id,
        TaskActivityType.STATUS_CHANGED,
        `${formatActorName(auth.user)} changed status from ${reverseStatusMap[existing.status]} to ${statusValue}.`,
      );

      return updatedTask;
    });

    sendJson(response, 200, toApiTask(task, getTaskPermissions(auth, task)));
    return;
  }

  const taskArchiveMatch = matchPath(pathname, "/api/tasks/:id/archive");
  if (method === "PATCH" && taskArchiveMatch) {
    const existing = await prisma.task.findFirst({
      where: workspaceScopedIdWhere(auth, taskArchiveMatch.id),
      include: taskInclude,
    });

    if (!existing || existing.archivedAt) {
      sendJson(response, 404, { error: "Task not found." });
      return;
    }

    if (!getTaskPermissions(auth, existing).canArchive) {
      sendJson(response, 403, { error: "You do not have permission to archive this task." });
      return;
    }

    const task = await prisma.$transaction(async (tx) => {
      const archivedTask = await tx.task.update({
        where: { id: taskArchiveMatch.id },
        data: {
          archivedAt: new Date(),
          plannedForDate: null,
        },
        include: taskInclude,
      });

      await createTaskActivity(
        tx,
        archivedTask.id,
        archivedTask.workspaceId,
        auth.user.id,
        TaskActivityType.ARCHIVED,
        `${formatActorName(auth.user)} archived the task.`,
      );

      return archivedTask;
    });

    sendJson(response, 200, toApiTask(task, getTaskPermissions(auth, task)));
    return;
  }

  if (method === "DELETE" && taskIdMatch) {
    const existing = await prisma.task.findFirst({
      where: workspaceScopedIdWhere(auth, taskIdMatch.id),
      select: { id: true, archivedAt: true, createdById: true, assigneeId: true },
    });

    if (!existing || existing.archivedAt) {
      sendJson(response, 404, { error: "Task not found." });
      return;
    }

    if (!getTaskPermissions(auth, existing).canDelete) {
      sendJson(response, 403, { error: "You do not have permission to delete this task." });
      return;
    }

    await prisma.task.delete({
      where: { id: taskIdMatch.id },
    });

    sendEmpty(response);
    return;
  }

  const todayItemStatusMatch =
    matchPath(pathname, "/api/today-items/:source/:id/status") ??
    matchPath(pathname, "/api/tasks/today-items/:source/:id/status");
  if (method === "PATCH" && todayItemStatusMatch) {
    const input = (await readJsonBody<{ status?: string }>(request)) ?? {};
    const statusValue = input.status;

    if (!statusValue || !isValidStatus(statusValue)) {
      sendJson(response, 400, { error: "Invalid status payload." });
      return;
    }

    const status = statusMap[statusValue];
    const source = todayItemStatusMatch.source;

    if (source === "task") {
      const existing = await prisma.task.findFirst({
        where: workspaceScopedIdWhere(auth, todayItemStatusMatch.id),
        include: taskInclude,
      });

      if (!existing || existing.archivedAt) {
        sendJson(response, 404, { error: "Task not found." });
        return;
      }

      if (!getTaskPermissions(auth, existing).canChangeStatus) {
        sendJson(response, 403, { error: "You do not have permission to update this task." });
        return;
      }

      const task = await prisma.$transaction(async (tx) => {
        const updatedTask = await tx.task.update({
          where: { id: todayItemStatusMatch.id },
          data: {
            status,
            completedAt: status === TaskStatus.DONE ? existing.completedAt ?? new Date() : null,
            plannedForDate: status === TaskStatus.DONE ? null : existing.plannedForDate,
          },
          include: taskInclude,
        });

        await createTaskActivity(
          tx,
          updatedTask.id,
          updatedTask.workspaceId,
          auth.user.id,
          TaskActivityType.STATUS_CHANGED,
          `${formatActorName(auth.user)} changed status from ${reverseStatusMap[existing.status]} to ${statusValue}.`,
        );

        return updatedTask;
      });

      sendJson(response, 200, toApiTodayTask(task, getTaskPermissions(auth, task)));
      return;
    }

    if (source === "occurrence") {
      const existing = await prisma.taskOccurrence.findFirst({
        where: workspaceScopedIdWhere(auth, todayItemStatusMatch.id),
        include: occurrenceInclude,
      });

      if (!existing || existing.task.archivedAt) {
        sendJson(response, 404, { error: "Occurrence not found." });
        return;
      }

      if (!getTaskPermissions(auth, existing.task).canChangeStatus) {
        sendJson(response, 403, { error: "You do not have permission to update this task." });
        return;
      }

      const occurrence = await prisma.taskOccurrence.update({
        where: { id: todayItemStatusMatch.id },
        data: {
          status,
          completedAt: status === TaskStatus.DONE ? existing.completedAt ?? new Date() : null,
        },
        include: occurrenceInclude,
      });

      sendJson(response, 200, toApiTodayOccurrence(occurrence, getTaskPermissions(auth, occurrence.task)));
      return;
    }

    sendJson(response, 400, { error: "Invalid today item source." });
    return;
  }

  const todayItemSkipMatch =
    matchPath(pathname, "/api/today-items/:source/:id/skip") ??
    matchPath(pathname, "/api/tasks/today-items/:source/:id/skip");
  if (method === "PATCH" && todayItemSkipMatch) {
    const source = todayItemSkipMatch.source;

    if (source === "task") {
      const existing = await prisma.task.findFirst({
        where: workspaceScopedIdWhere(auth, todayItemSkipMatch.id),
        include: taskInclude,
      });

      if (!existing || existing.archivedAt) {
        sendJson(response, 404, { error: "Task not found." });
        return;
      }

      if (!getTaskPermissions(auth, existing).canChangeStatus) {
        sendJson(response, 403, { error: "You do not have permission to skip this task." });
        return;
      }

      const task = await prisma.task.update({
        where: { id: todayItemSkipMatch.id },
        data: { plannedForDate: null },
        include: taskInclude,
      });

      sendJson(response, 200, toApiTodayTask(task, getTaskPermissions(auth, task)));
      return;
    }

    if (source === "occurrence") {
      const existing = await prisma.taskOccurrence.findFirst({
        where: workspaceScopedIdWhere(auth, todayItemSkipMatch.id),
        include: occurrenceInclude,
      });

      if (!existing || existing.task.archivedAt) {
        sendJson(response, 404, { error: "Occurrence not found." });
        return;
      }

      if (!getTaskPermissions(auth, existing.task).canChangeStatus) {
        sendJson(response, 403, { error: "You do not have permission to skip this task." });
        return;
      }

      const occurrence = await prisma.taskOccurrence.update({
        where: { id: todayItemSkipMatch.id },
        data: { skippedAt: new Date() },
        include: occurrenceInclude,
      });

      sendJson(response, 200, toApiTodayOccurrence(occurrence, getTaskPermissions(auth, occurrence.task)));
      return;
    }

    sendJson(response, 400, { error: "Invalid today item source." });
    return;
  }

  const todayItemSnoozeMatch =
    matchPath(pathname, "/api/today-items/:source/:id/snooze") ??
    matchPath(pathname, "/api/tasks/today-items/:source/:id/snooze");
  if (method === "PATCH" && todayItemSnoozeMatch) {
    const source = todayItemSnoozeMatch.source;
    const tomorrow = toDateOnly(formatDate(addDays(new Date(), 1)));

    if (source === "task") {
      const existing = await prisma.task.findFirst({
        where: workspaceScopedIdWhere(auth, todayItemSnoozeMatch.id),
        include: taskInclude,
      });

      if (!existing || existing.archivedAt) {
        sendJson(response, 404, { error: "Task not found." });
        return;
      }

      if (!getTaskPermissions(auth, existing).canChangeStatus) {
        sendJson(response, 403, { error: "You do not have permission to snooze this task." });
        return;
      }

      const task = await prisma.task.update({
        where: { id: todayItemSnoozeMatch.id },
        data: { plannedForDate: tomorrow },
        include: taskInclude,
      });

      sendJson(response, 200, toApiTodayTask(task, getTaskPermissions(auth, task)));
      return;
    }

    if (source === "occurrence") {
      const existing = await prisma.taskOccurrence.findFirst({
        where: workspaceScopedIdWhere(auth, todayItemSnoozeMatch.id),
        include: occurrenceInclude,
      });

      if (!existing || existing.task.archivedAt) {
        sendJson(response, 404, { error: "Occurrence not found." });
        return;
      }

      if (!getTaskPermissions(auth, existing.task).canChangeStatus) {
        sendJson(response, 403, { error: "You do not have permission to snooze this task." });
        return;
      }

      const occurrence = await prisma.taskOccurrence.update({
        where: { id: todayItemSnoozeMatch.id },
        data: { skippedAt: new Date() },
        include: occurrenceInclude,
      });

      await prisma.taskOccurrence.upsert({
        where: {
          taskId_scheduledFor: {
            taskId: existing.taskId,
            scheduledFor: tomorrow,
          },
        },
        update: {
          dueDate: tomorrow,
          skippedAt: null,
        },
        create: {
          workspaceId: auth.workspace.id,
          taskId: existing.taskId,
          scheduledFor: tomorrow,
          dueDate: tomorrow,
          status: existing.status === TaskStatus.DONE ? TaskStatus.TODO : existing.status,
        },
      });

      sendJson(response, 200, toApiTodayOccurrence(occurrence, getTaskPermissions(auth, occurrence.task)));
      return;
    }

    sendJson(response, 400, { error: "Invalid today item source." });
    return;
  }

  if (pathname.startsWith("/api/tasks") || pathname.startsWith("/api/today-items")) {
    methodNotAllowed(response);
    return;
  }

  notFound(response);
}
