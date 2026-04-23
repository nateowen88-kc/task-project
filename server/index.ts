import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { requireWorkspaceAdmin } from "../src/server/lib/auth.js";
import { createAuthRouter } from "../src/server/routes/auth.js";
import { createNotificationsRouter } from "../src/server/routes/notifications.js";
import { createWorkspaceMembersRouter } from "../src/server/routes/workspace-members.js";
import { createTodayRouter } from "../src/server/routes/today.js";
import { createAdminRouter } from "../src/server/routes/admin.js";
import { createTasksRouter } from "../src/server/routes/tasks.js";
import { createCapturedItemsRouter } from "../src/server/routes/captured-items.js";
import { createIntegrationsRouter } from "../src/server/routes/integrations.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const isProduction = process.env.NODE_ENV === "production";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, "../dist");
const allowedOrigins = new Set([
  "http://localhost:5173",
  "https://127.0.0.1:5173",
  "http://127.0.0.1:5173",
  "https://timesmith.test",
  "https://storyminer.test"
]);

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

if (isProduction) {
  app.use(express.static(clientDistPath));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(clientDistPath, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`TimeSmith server listening on http://localhost:${port}`);
});
