import { CaptureSourceType, CaptureStatus } from "@prisma/client";

import { prisma } from "../lib/db.js";
import {
  canAssignTasks,
  getAuthContext,
  getTaskPermissions,
  workspaceScopedIdWhere,
  workspaceWhere,
} from "../lib/auth.js";
import { addDays, formatDate, toDateOnly, toDateTime } from "../lib/dates.js";
import { toApiCapturedItem, toApiTask } from "../lib/serializers.js";
import { notifyTaskAssignment } from "../services/notification-service.js";
import {
  captureSourceMap,
  normalizeCaptureLinks,
  upsertEmailCapturedItem,
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

  if (method === "POST" && pathname === API_ROUTES.capturedItems.demoSlack) {
    const timestamp = new Date();
    const item = await prisma.capturedItem.create({
      data: {
        workspaceId: auth.workspace.id,
        sourceType: CaptureSourceType.SLACK,
        title: "Follow up on launch checklist update",
        body: "Can you turn the launch checklist thread into next-week tasks and flag blockers before Thursday?",
        sourceLabel: "#product-ops",
        sourceUrl: "https://slack.com/app_redirect?channel=product-ops",
        sender: "Avery Morgan",
        receivedAt: timestamp,
        suggestedDueDate: toDateOnly(formatDate(addDays(timestamp, 3))),
      },
      include: {
        workspace: true,
      },
    });

    const hydratedItem = await prisma.capturedItem.findUniqueOrThrow({
      where: { id: item.id },
      include: { workspace: true },
    });

    sendJson(response, 201, toApiCapturedItem(hydratedItem));
    return;
  }

  if (method === "POST" && pathname === API_ROUTES.capturedItems.demoEmail) {
    const timestamp = new Date();
    const item = await upsertEmailCapturedItem({
      workspaceId: auth.workspace.id,
      title: "Client follow-up on Q2 launch plan",
      body: "Can you break this thread into tasks, note owners, and make sure we reply by Friday afternoon?",
      externalId: `demo-email-${timestamp.getTime()}`,
      sender: "jordan@example.com",
      sourceLabel: "To: founder@timesmith.test",
      sourceUrl: "mailto:founder@timesmith.test",
      receivedAt: timestamp,
    });

    const hydratedItem = await prisma.capturedItem.findUniqueOrThrow({
      where: { id: item.id },
      include: { workspace: true },
    });

    sendJson(response, 201, toApiCapturedItem(hydratedItem));
    return;
  }

  const acceptMatch = matchPath(pathname, "/api/captured-items/:id/accept");
  if (method === "POST" && acceptMatch) {
    const input = (await readJsonBody<Partial<TaskInput>>(request)) ?? {};

    if (!validateTaskInput(input)) {
      sendJson(response, 400, { error: "Invalid task payload." });
      return;
    }

    const existing = await prisma.capturedItem.findFirst({
      where: workspaceScopedIdWhere(auth, acceptMatch.id),
    });

    if (!existing || existing.status !== CaptureStatus.NEW) {
      sendJson(response, 404, { error: "Captured item not found." });
      return;
    }

    const recurrenceRule = normalizeRecurrence(input.isRecurring, input.recurrenceRule);
    const status = statusMap[input.status];
    const links = Array.from(new Set([...normalizeLinks(input.links), ...normalizeCaptureLinks(existing)]));
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
