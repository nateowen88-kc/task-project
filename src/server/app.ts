import "dotenv/config";
import cors from "cors";
import express from "express";

import { requireWorkspaceAdmin } from "./lib/auth.js";
import { createAuthRouter } from "./routes/auth.js";
import { createNotificationsRouter } from "./routes/notifications.js";
import { createWorkspaceMembersRouter } from "./routes/workspace-members.js";
import { createTodayRouter } from "./routes/today.js";
import { createAdminRouter } from "./routes/admin.js";
import { createTasksRouter } from "./routes/tasks.js";
import { createCapturedItemsRouter } from "./routes/captured-items.js";
import { createIntegrationsRouter } from "./routes/integrations.js";

const configuredOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  "http://localhost:5173",
  "https://127.0.0.1:5173",
  "http://127.0.0.1:5173",
  "https://timesmith.test",
  "https://storyminer.test",
  ...configuredOrigins,
]);

function isAllowedOrigin(origin: string) {
  if (allowedOrigins.has(origin)) {
    return true;
  }

  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return true;
    }

    if (hostname.endsWith(".vercel.app")) {
      return true;
    }

    if (hostname === "timesmithhq.com" || hostname === "www.timesmithhq.com") {
      return true;
    }

    if (hostname.endsWith(".timesmithhq.com")) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin ${origin} is not allowed by CORS.`));
      },
      credentials: true,
    }),
  );

  app.use(express.json());
  app.use("/api/auth", createAuthRouter());
  app.use("/api/notifications", createNotificationsRouter());
  app.use("/api/workspace-members", createWorkspaceMembersRouter());
  app.use("/", createTodayRouter());
  app.use("/", createTasksRouter());
  app.use("/", createCapturedItemsRouter());
  app.use("/", createIntegrationsRouter());
  app.use("/api/admin", requireWorkspaceAdmin, createAdminRouter());
  app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
    if (!(error instanceof Error)) {
      next(error);
      return;
    }

    if (error.message.includes("not allowed by CORS")) {
      response.status(403).json({ error: error.message });
      return;
    }

    next(error);
  });

  return app;
}

const app = createApp();

export default app;
