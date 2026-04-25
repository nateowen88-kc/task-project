import { notificationsHandler, workspaceMembersHandler } from "../../src/server/native/simple-handlers.js";
import { getPathname } from "../../src/server/native/http.js";

export default async function notificationsEntry(request: Parameters<typeof notificationsHandler>[0], response: Parameters<typeof notificationsHandler>[1]) {
  const pathname = getPathname(request);

  if (pathname === "/api/notifications/workspace-members" || pathname === "/api/workspace-members") {
    await workspaceMembersHandler(request, response);
    return;
  }

  await notificationsHandler(request, response);
}
