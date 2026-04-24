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

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
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

  return app;
}

const app = createApp();

export default app;
