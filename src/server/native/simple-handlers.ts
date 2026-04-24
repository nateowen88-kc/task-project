import { prisma } from "../lib/db.js";
import { getAuthContext } from "../lib/auth.js";
import { toApiNotification, toApiWorkspaceMember } from "../lib/serializers.js";
import { notificationDelegate } from "../services/notification-service.js";
import { buildAgendaSnapshot, generateDailyAgenda } from "../services/agenda-service.js";
import { formatDate, toDateOnly } from "../lib/dates.js";
import { API_ROUTES } from "../../shared/api-routes.js";
import type { GenerateAgendaPayload } from "../../shared/api-types.js";
import {
  getPathname,
  getUrl,
  methodNotAllowed,
  NativeRequest,
  NativeResponse,
  notFound,
  readJsonBody,
  rejectDisallowedBrowserOrigin,
  sendEmpty,
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

export async function notificationsHandler(request: NativeRequest, response: NativeResponse) {
  const pathname = getPathname(request);
  const method = request.method ?? "GET";

  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && rejectDisallowedBrowserOrigin(request, response)) {
    return;
  }

  const auth = await getAuth(request, response);

  if (!auth) {
    return;
  }

  if (method === "GET" && (pathname === API_ROUTES.notifications.list || pathname === "/api/notifications/index")) {
    const notifications = await notificationDelegate(prisma).findMany({
      where: {
        userId: auth.user.id,
        ...(auth.allWorkspaces ? {} : { workspaceId: auth.workspace.id }),
      },
      include: {
        workspace: true,
        actor: { select: { name: true } },
      },
      orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
      take: 100,
    });

    sendJson(
      response,
      200,
      notifications.map((item: Parameters<typeof toApiNotification>[0]) => toApiNotification(item)),
    );
    return;
  }

  if (method === "POST" && pathname === API_ROUTES.notifications.readAll) {
    await notificationDelegate(prisma).updateMany({
      where: {
        userId: auth.user.id,
        readAt: null,
        ...(auth.allWorkspaces ? {} : { workspaceId: auth.workspace.id }),
      },
      data: { readAt: new Date() },
    });

    sendEmpty(response);
    return;
  }

  const readMatch = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if (method === "POST" && readMatch) {
    const notificationId = decodeURIComponent(readMatch[1]!);
    const notificationsClient = notificationDelegate(prisma);
    const notification = await notificationsClient.findFirst({
      where: {
        id: notificationId,
        userId: auth.user.id,
        ...(auth.allWorkspaces ? {} : { workspaceId: auth.workspace.id }),
      },
    });

    if (!notification) {
      sendJson(response, 404, { error: "Notification not found." });
      return;
    }

    const updated = await notificationsClient.update({
      where: { id: notification.id },
      data: { readAt: notification.readAt ?? new Date() },
      include: {
        workspace: true,
        actor: { select: { name: true } },
      },
    });

    sendJson(response, 200, toApiNotification(updated));
    return;
  }

  methodNotAllowed(response);
}

export async function workspaceMembersHandler(request: NativeRequest, response: NativeResponse) {
  const pathname = getPathname(request);
  const method = request.method ?? "GET";

  if (
    method !== "GET" ||
    (pathname !== API_ROUTES.workspaceMembers.list &&
      pathname !== "/api/workspace-members/index" &&
      pathname !== "/api/notifications/workspace-members")
  ) {
    pathname.startsWith("/api/workspace-members") ? methodNotAllowed(response) : notFound(response);
    return;
  }

  const auth = await getAuth(request, response);
  if (!auth) {
    return;
  }

  const members = await prisma.workspaceMember.findMany({
    where: auth.allWorkspaces ? undefined : { workspaceId: auth.workspace.id },
    include: { user: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  sendJson(response, 200, members.map((member) => toApiWorkspaceMember(member)));
}

export async function todayHandler(request: NativeRequest, response: NativeResponse) {
  const pathname = getPathname(request);
  const method = request.method ?? "GET";

  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && rejectDisallowedBrowserOrigin(request, response)) {
    return;
  }

  const auth = await getAuth(request, response);

  if (!auth) {
    return;
  }

  if (
    method === "GET" &&
    (pathname === API_ROUTES.agenda.today || pathname === "/api/today/index" || pathname === "/api/agenda/today")
  ) {
    const dateValue = getUrl(request).searchParams.get("date") ?? formatDate(new Date());
    const agenda = await buildAgendaSnapshot(auth.workspace.id, toDateOnly(dateValue), {
      promoteCandidates: false,
      includeAiRanking: false,
      viewerUserId: auth.user.id,
    });

    sendJson(response, 200, agenda);
    return;
  }

  if (method === "POST" && pathname === API_ROUTES.agenda.generate) {
    const input = (await readJsonBody<GenerateAgendaPayload | undefined>(request)) ?? undefined;
    const targetDate = typeof input?.date === "string" ? input.date : formatDate(new Date());
    const agenda = await generateDailyAgenda(auth.workspace.id, toDateOnly(targetDate), auth.user.id);
    sendJson(response, 200, agenda);
    return;
  }

  methodNotAllowed(response);
}
