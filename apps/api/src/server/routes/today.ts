import express from "express";

import { authOf, requireAuth } from "../lib/auth.js";
import { formatDate, toDateOnly } from "../lib/dates.js";
import { buildAgendaSnapshot, generateDailyAgenda } from "../services/agenda-service.js";
import { API_ROUTES } from "../../../../../src/shared/api-routes.js";
import type { GenerateAgendaPayload } from "../../../../../src/shared/api-types.js";

export function createTodayRouter() {
  const router = express.Router();

  router.use(requireAuth);

  router.get(API_ROUTES.agenda.today, async (request, response) => {
    const auth = authOf(request);
    const targetDate = typeof request.query.date === "string" ? request.query.date : formatDate(new Date());
    const agenda = await buildAgendaSnapshot(auth.workspace.id, toDateOnly(targetDate), {
      promoteCandidates: false,
      includeAiRanking: false,
      viewerUserId: auth.user.id,
    });
    response.json(agenda);
  });

  router.post(API_ROUTES.agenda.generate, async (request, response) => {
    const auth = authOf(request);
    const targetDate =
      typeof (request.body as GenerateAgendaPayload | undefined)?.date === "string"
        ? (request.body as GenerateAgendaPayload).date!
        : formatDate(new Date());

    const agenda = await generateDailyAgenda(auth.workspace.id, toDateOnly(targetDate), auth.user.id);
    response.json(agenda);
  });

  return router;
}
