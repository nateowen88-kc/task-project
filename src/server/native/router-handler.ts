import adminHandler from "./admin-handler.js";
import authHandler from "./auth-handler.js";
import capturedItemsHandler from "./captured-items-handler.js";
import { notFound, type NativeRequest, type NativeResponse } from "./http.js";
import integrationsHandler from "./integrations-handler.js";
import { notificationsHandler, todayHandler, workspaceMembersHandler } from "./simple-handlers.js";
import taskHandler from "./task-handler.js";

function normalizeApiRouterPath(request: NativeRequest) {
  const url = request.url ?? "/";
  const [pathname, query = ""] = url.split("?");
  const normalizedPath = pathname.startsWith("/api/router/") ? pathname.replace("/api/router", "/api") : pathname;
  request.url = `${normalizedPath}${query ? `?${query}` : ""}`;
}

export default async function routerHandler(request: NativeRequest, response: NativeResponse) {
  normalizeApiRouterPath(request);

  const pathname = new URL(request.url ?? "/", "https://timesmithhq.com").pathname;

  if (pathname.startsWith("/api/auth")) {
    await authHandler(request, response);
    return;
  }

  if (pathname.startsWith("/api/admin")) {
    await adminHandler(request, response);
    return;
  }

  if (pathname.startsWith("/api/tasks") || pathname.startsWith("/api/today-items")) {
    await taskHandler(request, response);
    return;
  }

  if (pathname.startsWith("/api/today") || pathname.startsWith("/api/agenda")) {
    await todayHandler(request, response);
    return;
  }

  if (pathname.startsWith("/api/captured-items")) {
    await capturedItemsHandler(request, response);
    return;
  }

  if (pathname.startsWith("/api/notifications")) {
    await notificationsHandler(request, response);
    return;
  }

  if (pathname.startsWith("/api/workspace-members")) {
    await workspaceMembersHandler(request, response);
    return;
  }

  if (pathname.startsWith("/api/integrations")) {
    await integrationsHandler(request, response);
    return;
  }

  notFound(response);
}
