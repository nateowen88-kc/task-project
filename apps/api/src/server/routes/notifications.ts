import express from "express";

import { authOf, requireAuth } from "../lib/auth.js";
import { prisma } from "../lib/db.js";
import { toApiNotification } from "../lib/serializers.js";
import { notificationDelegate } from "../services/notification-service.js";
import { API_ROUTES } from "../../../../../src/shared/api-routes.js";

export function createNotificationsRouter() {
  const router = express.Router();

  router.use(requireAuth);

  router.get(API_ROUTES.notifications.list.replace("/api/notifications", "") || "/", async (request, response) => {
    const auth = authOf(request);
    const notificationsClient = notificationDelegate(prisma);

    const notifications = await notificationsClient.findMany({
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

    response.json(
      notifications.map((notification: Parameters<typeof toApiNotification>[0]) => toApiNotification(notification)),
    );
  });

  router.post(API_ROUTES.notifications.readAll.replace("/api/notifications", ""), async (request, response) => {
    const auth = authOf(request);
    await notificationDelegate(prisma).updateMany({
      where: {
        userId: auth.user.id,
        readAt: null,
        ...(auth.allWorkspaces ? {} : { workspaceId: auth.workspace.id }),
      },
      data: {
        readAt: new Date(),
      },
    });

    response.status(204).send();
  });

  router.post("/:id/read", async (request, response) => {
    const auth = authOf(request);
    const notificationsClient = notificationDelegate(prisma);
    const notification = await notificationsClient.findFirst({
      where: {
        id: request.params.id,
        userId: auth.user.id,
        ...(auth.allWorkspaces ? {} : { workspaceId: auth.workspace.id }),
      },
    });

    if (!notification) {
      response.status(404).json({ error: "Notification not found." });
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

    response.json(toApiNotification(updated));
  });

  return router;
}
