import { CaptureSourceType, CaptureStatus } from "@prisma/client";

import { prisma } from "../lib/db.js";
import {
  canAssignTasks,
  getAuthContext,
  getTaskPermissions,
  workspaceScopedIdWhere,
  workspaceWhere,
} from "../lib/auth.js";
import { toDateOnly, toDateTime } from "../lib/dates.js";
import { toApiCapturedItem, toApiTask } from "../lib/serializers.js";
import { notifyTaskAssignment } from "../services/notification-service.js";
import {
  captureSourceMap,
  normalizeCaptureLinks,
  validateCaptureInput,
  type CaptureInput,
} from "../services/capture-service.js";
import {
  createTaskActivity,
  formatActorName,
  getNextSortOrder,
  importanceMap,
  normalizeLinks,
  normalizeRecurrence,
  resolveTaskAssigneeId,
  statusMap,
  TaskActivityType,
  TaskStatus,
  validateTaskInput,
  type TaskInput,
} from "../services/task-service.js";
import { API_ROUTES } from "../../../../../src/shared/api-routes.js";
import {
  getPathname,
  matchPath,
  methodNotAllowed,
  NativeRequest,
  NativeResponse,
  notFound,
  readJsonBody,
  rejectDisallowedBrowserOrigin,
  sendJson,
} from "./http.js";

async function getAuth(request: NativeRequest, response: NativeResponse) {
  const auth = await getAuthContext(request as any);
  if (!auth) {
    sendJson(response, 401, { error: "Authentication required." });
    return null;
  }

  return auth;
}

export default async function capturedItemsHandler(request: NativeRequest, response: NativeResponse) {
  const pathname = getPathname(request);
  const method = request.method ?? "GET";

  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && rejectDisallowedBrowserOrigin(request, response)) {
    return;
  }

  const auth = await getAuth(request, response);

  if (!auth) {
    return;
  }

  if (method === "GET" && (pathname === API_ROUTES.capturedItems.list || pathname === "/api/captured-items/index")) {
    const items = await prisma.capturedItem.findMany({
      where: {
        ...workspaceWhere(auth),
        status: { not: CaptureStatus.DISCARDED },
      },
      include: {
        workspace: true,
      },
      orderBy: [{ status: "asc" }, { receivedAt: "desc" }],
    });

    sendJson(response, 200, items.map((item) => toApiCapturedItem(item)));
    return;
  }

  if (method === "POST" && pathname === API_ROUTES.capturedItems.create) {
    const input = (await readJsonBody<Partial<CaptureInput>>(request)) ?? {};

    if (!validateCaptureInput(input)) {
      sendJson(response, 400, { error: "Invalid captured item payload." });
      return;
    }

    const item = await prisma.capturedItem.create({
      data: {
        workspaceId: auth.workspace.id,
        sourceType: captureSourceMap[input.sourceType],
        title: input.title.trim(),
        body: input.body?.trim() ?? "",
        externalId: input.externalId?.trim() || null,
        sourceLabel: input.sourceLabel?.trim() || null,
        sourceUrl: input.sourceUrl?.trim() || null,
        sender: input.sender?.trim() || null,
        suggestedDueDate: input.suggestedDueDate ? toDateOnly(input.suggestedDueDate) : null,
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
      },
      include: {
        workspace: true,
      },
    });

    sendJson(response, 201, toApiCapturedItem(item));
    return;
  }

  const acceptMatch = matchPath(pathname, "/api/captured-items/:id/accept");
  if (method === "POST" && acceptMatch) {
    const acceptInput =
      (await readJsonBody<
        Partial<TaskInput> & {
          directReportId?: string | null;
          createOneOnOneTalkingPoint?: boolean;
          oneOnOneTalkingPoint?: string | null;
        }
      >(request)) ?? {};
    const reviewOptions = {
      directReportId: acceptInput.directReportId ?? null,
      createOneOnOneTalkingPoint: Boolean(acceptInput.createOneOnOneTalkingPoint),
      oneOnOneTalkingPoint: acceptInput.oneOnOneTalkingPoint ?? null,
    };

    if (!validateTaskInput(acceptInput)) {
      sendJson(response, 400, { error: "Invalid task payload." });
      return;
    }
    const taskInput: TaskInput = acceptInput;

    const existing = await prisma.capturedItem.findFirst({
      where: workspaceScopedIdWhere(auth, acceptMatch.id),
    });

    if (!existing || existing.status !== CaptureStatus.NEW) {
      sendJson(response, 404, { error: "Captured item not found." });
      return;
    }

    const recurrenceRule = normalizeRecurrence(taskInput.isRecurring, taskInput.recurrenceRule);
    const status = statusMap[taskInput.status];
    const links = Array.from(new Set([...normalizeLinks(taskInput.links), ...normalizeCaptureLinks(existing)]));
    const sortOrder = await getNextSortOrder(auth.workspace.id, status);
    const assigneeId = await resolveTaskAssigneeId(auth, taskInput.assigneeId);

    if (typeof assigneeId === "undefined") {
      sendJson(response, 400, { error: "Assignee must be a member of this workspace." });
      return;
    }

    if (!canAssignTasks(auth) && assigneeId && assigneeId !== auth.user.id) {
      sendJson(response, 403, { error: "You can only assign tasks to yourself." });
      return;
    }

    let talkingPointReportId: string | null = null;
    let talkingPointBody = "";

    if (reviewOptions.createOneOnOneTalkingPoint) {
      if (typeof reviewOptions.directReportId !== "string" || reviewOptions.directReportId.trim().length === 0) {
        sendJson(response, 400, { error: "A team member is required to add a 1:1 talking point." });
        return;
      }

      const report = await prisma.directReport.findFirst({
        where: {
          id: reviewOptions.directReportId,
          workspaceId: auth.workspace.id,
          managerUserId: auth.user.id,
        },
      });

      if (!report) {
        sendJson(response, 404, { error: "Direct report not found." });
        return;
      }

      talkingPointReportId = report.id;
      talkingPointBody = reviewOptions.oneOnOneTalkingPoint?.trim() || taskInput.title.trim();
    }

    const task = await prisma.$transaction(async (tx) => {
      const createdTask = await tx.task.create({
        data: {
          workspaceId: auth.workspace.id,
          createdById: auth.user.id,
          assigneeId: assigneeId ?? auth.user.id,
          title: taskInput.title.trim(),
          details: taskInput.details?.trim() ?? "",
          dueDate: toDateOnly(taskInput.dueDate),
          remindAt: toDateTime(taskInput.remindAt),
          status,
          importance: taskInput.importance ? (importanceMap[taskInput.importance] as any) : "MEDIUM",
          sortOrder,
          isRecurring: Boolean(recurrenceRule),
          recurrenceRule,
          completedAt: status === TaskStatus.DONE ? new Date() : null,
          links: {
            create: links.map((url, index) => ({
              url,
              sortOrder: index,
            })),
          },
          capturedItems: {
            connect: {
              id: existing.id,
            },
          },
        },
        include: {
          workspace: true,
          links: { orderBy: { sortOrder: "asc" } },
          assignee: { select: { name: true } },
        },
      });

      await tx.capturedItem.update({
        where: { id: existing.id },
        data: {
          status: CaptureStatus.ACCEPTED,
          acceptedAt: new Date(),
          discardedAt: null,
          taskId: createdTask.id,
        },
      });

      if (talkingPointReportId && talkingPointBody) {
        const sortOrder =
          (
            await tx.oneOnOneAgendaItem.aggregate({
              where: { directReportId: talkingPointReportId },
              _max: { sortOrder: true },
            })
          )._max.sortOrder ?? -1;

        await tx.oneOnOneAgendaItem.create({
          data: {
            directReportId: talkingPointReportId,
            body: talkingPointBody,
            isPrivate: true,
            sortOrder: sortOrder + 1,
          },
        });
      }

      await createTaskActivity(
        tx,
        createdTask.id,
        createdTask.workspaceId,
        auth.user.id,
        TaskActivityType.CREATED,
        `${formatActorName(auth.user)} created the task from inbox capture.`,
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

  const discardMatch = matchPath(pathname, "/api/captured-items/:id/discard");
  if (method === "PATCH" && discardMatch) {
    const existing = await prisma.capturedItem.findFirst({
      where: workspaceScopedIdWhere(auth, discardMatch.id),
    });

    if (!existing || existing.status !== CaptureStatus.NEW) {
      sendJson(response, 404, { error: "Captured item not found." });
      return;
    }

    const item = await prisma.capturedItem.update({
      where: { id: discardMatch.id },
      data: {
        status: CaptureStatus.DISCARDED,
        discardedAt: new Date(),
      },
      include: {
        workspace: true,
      },
    });

    sendJson(response, 200, toApiCapturedItem(item));
    return;
  }

  if (pathname.startsWith("/api/captured-items")) {
    methodNotAllowed(response);
    return;
  }

  notFound(response);
}
