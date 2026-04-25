import express from "express";

import {
  authOf,
  canAssignTasks,
  getTaskPermissions,
  isWorkspaceAdmin,
  personalTaskWhere,
  requireAuth,
  taskScopedIdWhere,
  workspaceScopedIdWhere,
  workspaceWhere,
} from "../lib/auth.js";
import { prisma } from "../lib/db.js";
import { addDays, formatDate, toDateOnly, toDateTime } from "../lib/dates.js";
import { reverseStatusMap, toApiTask, toApiTodayOccurrence, toApiTodayTask } from "../lib/serializers.js";
import { API_ROUTES } from "../../../../../src/shared/api-routes.js";
import { notifyTaskAssignment, notifyTaskComment } from "../services/notification-service.js";
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
import { normalizeCaptureLinks } from "../services/capture-service.js";

export function createTasksRouter() {
  const router = express.Router();

  router.use(requireAuth);

  router.get(API_ROUTES.tasks.list, async (request, response) => {
    const auth = authOf(request);
    const tasks = await prisma.task.findMany({
      where: {
        ...workspaceWhere(auth),
        ...personalTaskWhere(auth),
        archivedAt: null,
      },
      include: {
        workspace: true,
        links: { orderBy: { sortOrder: "asc" } },
        assignee: { select: { name: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    });

    response.json(tasks.map((task) => toApiTask(task, getTaskPermissions(auth, task))));
  });

  router.get("/api/tasks/:id/detail", async (request, response) => {
    const auth = authOf(request);
    const detail = await fetchTaskDetail(auth, request.params.id);

    if (!detail) {
      response.status(404).json({ error: "Task not found." });
      return;
    }

    response.json(detail);
  });

  router.post("/api/tasks/:id/comments", async (request, response) => {
    const auth = authOf(request);
    const input = request.body as Partial<TaskCommentInput>;

    if (!validateTaskCommentInput(input)) {
      response.status(400).json({ error: "Comment body is required." });
      return;
    }

    const task = await prisma.task.findFirst({
      where: taskScopedIdWhere(auth, request.params.id),
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
      response.status(404).json({ error: "Task not found." });
      return;
    }

    if (!getTaskPermissions(auth, task).canComment) {
      response.status(403).json({ error: "You do not have permission to comment on this task." });
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

    const detail = await fetchTaskDetail(auth, request.params.id);
    response.status(201).json(detail);
  });

  router.post(API_ROUTES.tasks.create, async (request, response) => {
    const auth = authOf(request);
    const input = request.body as Partial<TaskInput>;

    if (!validateTaskInput(input)) {
      response.status(400).json({ error: "Invalid task payload." });
      return;
    }

    const recurrenceRule = normalizeRecurrence(input.isRecurring, input.recurrenceRule);
    const status = statusMap[input.status];
    const links = normalizeLinks(input.links);
    const sortOrder = await getNextSortOrder(auth.workspace.id, status);
    const assigneeId = await resolveTaskAssigneeId(auth, input.assigneeId);

    if (typeof assigneeId === "undefined") {
      response.status(400).json({ error: "Assignee must be a member of this workspace." });
      return;
    }

    if (!canAssignTasks(auth) && assigneeId && assigneeId !== auth.user.id) {
      response.status(403).json({ error: "You can only assign tasks to yourself." });
      return;
    }

    if (!auth.workspace.allowMemberTaskCreation && !isWorkspaceAdmin(auth)) {
      response.status(403).json({ error: "Only workspace admins can create tasks in this workspace." });
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
        include: {
          workspace: true,
          links: { orderBy: { sortOrder: "asc" } },
          assignee: { select: { name: true } },
        },
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

    response.status(201).json(toApiTask(task, getTaskPermissions(auth, task)));
  });

  router.put("/api/tasks/:id", async (request, response) => {
    const auth = authOf(request);
    const input = request.body as Partial<TaskInput>;

    if (!validateTaskInput(input)) {
      response.status(400).json({ error: "Invalid task payload." });
      return;
    }

    const existing = await prisma.task.findFirst({
      where: taskScopedIdWhere(auth, request.params.id),
    });

    if (!existing || existing.archivedAt) {
      response.status(404).json({ error: "Task not found." });
      return;
    }

    const permissions = getTaskPermissions(auth, existing);
    if (!permissions.canEdit) {
      response.status(403).json({ error: "You do not have permission to edit this task." });
      return;
    }

    const recurrenceRule = normalizeRecurrence(input.isRecurring, input.recurrenceRule);
    const status = statusMap[input.status];
    const links = normalizeLinks(input.links);
    const sortOrder = existing.status === status ? existing.sortOrder : await getNextSortOrder(auth.workspace.id, status);
    const assigneeId = await resolveTaskAssigneeId(auth, input.assigneeId);

    if (typeof assigneeId === "undefined") {
      response.status(400).json({ error: "Assignee must be a member of this workspace." });
      return;
    }

    if (!permissions.canReassign && assigneeId !== null && assigneeId !== auth.user.id) {
      response.status(403).json({ error: "You do not have permission to reassign this task." });
      return;
    }

    const nextAssigneeId = assigneeId ?? null;
    const actorName = formatActorName(auth.user);
    const task = await prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id: request.params.id },
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
        include: {
          workspace: true,
          links: { orderBy: { sortOrder: "asc" } },
          assignee: { select: { name: true } },
        },
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

    response.json(toApiTask(task, getTaskPermissions(auth, task)));
  });

  router.patch("/api/tasks/:id/status", async (request, response) => {
    const auth = authOf(request);
    const statusValue = (request.body as { status?: string }).status;

    if (!statusValue || !isValidStatus(statusValue)) {
      response.status(400).json({ error: "Invalid status payload." });
      return;
    }

    const existing = await prisma.task.findFirst({
      where: taskScopedIdWhere(auth, request.params.id),
      include: {
        workspace: true,
        links: { orderBy: { sortOrder: "asc" } },
        assignee: { select: { name: true } },
      },
    });

    if (!existing || existing.archivedAt) {
      response.status(404).json({ error: "Task not found." });
      return;
    }

    if (!getTaskPermissions(auth, existing).canChangeStatus) {
      response.status(403).json({ error: "You do not have permission to update this task." });
      return;
    }

    const status = statusMap[statusValue];
    const sortOrder = existing.status === status ? existing.sortOrder : await getNextSortOrder(auth.workspace.id, status);

    const task = await prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id: request.params.id },
        data: {
          status,
          sortOrder,
          plannedForDate: status === TaskStatus.DONE ? null : existing.plannedForDate,
          completedAt: status === TaskStatus.DONE ? existing.completedAt ?? new Date() : null,
        },
        include: {
          workspace: true,
          links: { orderBy: { sortOrder: "asc" } },
          assignee: { select: { name: true } },
        },
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

    response.json(toApiTask(task, getTaskPermissions(auth, task)));
  });

  router.patch("/api/tasks/:id/archive", async (request, response) => {
    const auth = authOf(request);
    const existing = await prisma.task.findFirst({
      where: taskScopedIdWhere(auth, request.params.id),
      include: {
        workspace: true,
        links: { orderBy: { sortOrder: "asc" } },
        assignee: { select: { name: true } },
      },
    });

    if (!existing || existing.archivedAt) {
      response.status(404).json({ error: "Task not found." });
      return;
    }

    if (!getTaskPermissions(auth, existing).canArchive) {
      response.status(403).json({ error: "You do not have permission to archive this task." });
      return;
    }

    const task = await prisma.$transaction(async (tx) => {
      const archivedTask = await tx.task.update({
        where: { id: request.params.id },
        data: {
          archivedAt: new Date(),
          plannedForDate: null,
        },
        include: {
          workspace: true,
          links: { orderBy: { sortOrder: "asc" } },
          assignee: { select: { name: true } },
        },
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

    response.json(toApiTask(task, getTaskPermissions(auth, task)));
  });

  router.delete("/api/tasks/:id", async (request, response) => {
    const auth = authOf(request);
    const existing = await prisma.task.findFirst({
      where: taskScopedIdWhere(auth, request.params.id),
      select: { id: true, archivedAt: true, createdById: true, assigneeId: true },
    });

    if (!existing || existing.archivedAt) {
      response.status(404).json({ error: "Task not found." });
      return;
    }

    if (!getTaskPermissions(auth, existing).canDelete) {
      response.status(403).json({ error: "You do not have permission to delete this task." });
      return;
    }

    await prisma.task.delete({
      where: { id: request.params.id },
    });

    response.status(204).send();
  });

  router.patch("/api/today-items/:source/:id/status", async (request, response) => {
    const auth = authOf(request);
    const statusValue = (request.body as { status?: string }).status;
    const source = request.params.source;

    if (!statusValue || !isValidStatus(statusValue)) {
      response.status(400).json({ error: "Invalid status payload." });
      return;
    }

    const status = statusMap[statusValue];

    if (source === "task") {
      const existing = await prisma.task.findFirst({
        where: taskScopedIdWhere(auth, request.params.id),
        include: {
          workspace: true,
          links: { orderBy: { sortOrder: "asc" } },
          assignee: { select: { name: true } },
        },
      });

      if (!existing || existing.archivedAt) {
        response.status(404).json({ error: "Task not found." });
        return;
      }

      if (!getTaskPermissions(auth, existing).canChangeStatus) {
        response.status(403).json({ error: "You do not have permission to update this task." });
        return;
      }

      const task = await prisma.$transaction(async (tx) => {
        const updatedTask = await tx.task.update({
          where: { id: request.params.id },
          data: {
            status,
            completedAt: status === TaskStatus.DONE ? existing.completedAt ?? new Date() : null,
            plannedForDate: status === TaskStatus.DONE ? null : existing.plannedForDate,
          },
          include: {
            workspace: true,
            links: { orderBy: { sortOrder: "asc" } },
            assignee: { select: { name: true } },
          },
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

      response.json(toApiTodayTask(task, getTaskPermissions(auth, task)));
      return;
    }

    if (source === "occurrence") {
      const existing = await prisma.taskOccurrence.findFirst({
        where: workspaceScopedIdWhere(auth, request.params.id),
        include: {
          task: {
            include: {
              workspace: true,
              links: { orderBy: { sortOrder: "asc" } },
              assignee: { select: { name: true } },
            },
          },
        },
      });

      if (!existing || existing.task.archivedAt) {
        response.status(404).json({ error: "Occurrence not found." });
        return;
      }

      if (!getTaskPermissions(auth, existing.task).canChangeStatus) {
        response.status(403).json({ error: "You do not have permission to update this task." });
        return;
      }

      const occurrence = await prisma.taskOccurrence.update({
        where: { id: request.params.id },
        data: {
          status,
          completedAt: status === TaskStatus.DONE ? existing.completedAt ?? new Date() : null,
        },
        include: {
          task: {
            include: {
              workspace: true,
              links: { orderBy: { sortOrder: "asc" } },
              assignee: { select: { name: true } },
            },
          },
        },
      });

      response.json(toApiTodayOccurrence(occurrence, getTaskPermissions(auth, occurrence.task)));
      return;
    }

    response.status(400).json({ error: "Invalid today item source." });
  });

  router.patch("/api/today-items/:source/:id/skip", async (request, response) => {
    const auth = authOf(request);
    const source = request.params.source;

    if (source === "task") {
      const existing = await prisma.task.findFirst({
        where: workspaceScopedIdWhere(auth, request.params.id),
        include: {
          workspace: true,
          links: { orderBy: { sortOrder: "asc" } },
          assignee: { select: { name: true } },
        },
      });

      if (!existing || existing.archivedAt) {
        response.status(404).json({ error: "Task not found." });
        return;
      }

      if (!getTaskPermissions(auth, existing).canChangeStatus) {
        response.status(403).json({ error: "You do not have permission to skip this task." });
        return;
      }

      const task = await prisma.task.update({
        where: { id: request.params.id },
        data: {
          plannedForDate: null,
        },
        include: {
          workspace: true,
          links: { orderBy: { sortOrder: "asc" } },
          assignee: { select: { name: true } },
        },
      });

      response.json(toApiTodayTask(task, getTaskPermissions(auth, task)));
      return;
    }

    if (source === "occurrence") {
      const existing = await prisma.taskOccurrence.findFirst({
        where: workspaceScopedIdWhere(auth, request.params.id),
        include: {
          task: {
            include: {
              workspace: true,
              links: { orderBy: { sortOrder: "asc" } },
              assignee: { select: { name: true } },
            },
          },
        },
      });

      if (!existing || existing.task.archivedAt) {
        response.status(404).json({ error: "Occurrence not found." });
        return;
      }

      if (!getTaskPermissions(auth, existing.task).canChangeStatus) {
        response.status(403).json({ error: "You do not have permission to skip this task." });
        return;
      }

      const occurrence = await prisma.taskOccurrence.update({
        where: { id: request.params.id },
        data: {
          skippedAt: new Date(),
        },
        include: {
          task: {
            include: {
              workspace: true,
              links: { orderBy: { sortOrder: "asc" } },
              assignee: { select: { name: true } },
            },
          },
        },
      });

      response.json(toApiTodayOccurrence(occurrence, getTaskPermissions(auth, occurrence.task)));
      return;
    }

    response.status(400).json({ error: "Invalid today item source." });
  });

  router.patch("/api/today-items/:source/:id/snooze", async (request, response) => {
    const auth = authOf(request);
    const source = request.params.source;
    const tomorrow = toDateOnly(formatDate(addDays(new Date(), 1)));

    if (source === "task") {
      const existing = await prisma.task.findFirst({
        where: workspaceScopedIdWhere(auth, request.params.id),
        include: {
          workspace: true,
          links: { orderBy: { sortOrder: "asc" } },
          assignee: { select: { name: true } },
        },
      });

      if (!existing || existing.archivedAt) {
        response.status(404).json({ error: "Task not found." });
        return;
      }

      if (!getTaskPermissions(auth, existing).canChangeStatus) {
        response.status(403).json({ error: "You do not have permission to snooze this task." });
        return;
      }

      const task = await prisma.task.update({
        where: { id: request.params.id },
        data: {
          plannedForDate: tomorrow,
        },
        include: {
          workspace: true,
          links: { orderBy: { sortOrder: "asc" } },
          assignee: { select: { name: true } },
        },
      });

      response.json(toApiTodayTask(task, getTaskPermissions(auth, task)));
      return;
    }

    if (source === "occurrence") {
      const existing = await prisma.taskOccurrence.findFirst({
        where: workspaceScopedIdWhere(auth, request.params.id),
        include: {
          task: {
            include: {
              workspace: true,
              links: { orderBy: { sortOrder: "asc" } },
              assignee: { select: { name: true } },
            },
          },
        },
      });

      if (!existing || existing.task.archivedAt) {
        response.status(404).json({ error: "Occurrence not found." });
        return;
      }

      if (!getTaskPermissions(auth, existing.task).canChangeStatus) {
        response.status(403).json({ error: "You do not have permission to snooze this task." });
        return;
      }

      const occurrence = await prisma.taskOccurrence.update({
        where: { id: request.params.id },
        data: {
          skippedAt: new Date(),
        },
        include: {
          task: {
            include: {
              workspace: true,
              links: { orderBy: { sortOrder: "asc" } },
              assignee: { select: { name: true } },
            },
          },
        },
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

      response.json(toApiTodayOccurrence(occurrence, getTaskPermissions(auth, occurrence.task)));
      return;
    }

    response.status(400).json({ error: "Invalid today item source." });
  });

  return router;
}
