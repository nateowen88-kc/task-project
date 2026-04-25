import express from "express";

import { authOf, requireAuth } from "../lib/auth.js";
import { prisma } from "../lib/db.js";
import { toApiWorkspaceMember } from "../lib/serializers.js";
import { API_ROUTES } from "../../../../../src/shared/api-routes.js";

export function createWorkspaceMembersRouter() {
  const router = express.Router();

  router.use(requireAuth);

  router.get(API_ROUTES.workspaceMembers.list.replace("/api/workspace-members", "") || "/", async (request, response) => {
    const auth = authOf(request);
    const members = await prisma.workspaceMember.findMany({
      where: auth.allWorkspaces ? undefined : { workspaceId: auth.workspace.id },
      include: {
        user: true,
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });

    response.json(members.map((member) => toApiWorkspaceMember(member)));
  });

  return router;
}
