import crypto from "node:crypto";
import express from "express";

import { resolveCaptureWorkspaceId } from "../lib/auth.js";
import { API_ROUTES } from "../../../../../src/shared/api-routes.js";
import {
  upsertEmailCapturedItem,
  type EmailInboundInput,
} from "../services/capture-service.js";

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function createIntegrationsRouter() {
  const router = express.Router();

  router.post(API_ROUTES.integrations.emailInbound, async (request, response) => {
    const input = (request.body ?? {}) as Partial<EmailInboundInput>;

    if (typeof input.subject !== "string" || !input.subject.trim()) {
      response.status(400).json({ error: "Subject is required." });
      return;
    }

    const workspaceId = await resolveCaptureWorkspaceId(input.workspaceSlug, input.to);
    const body = typeof input.text === "string" && input.text.trim()
      ? input.text.trim()
      : typeof input.html === "string" && input.html.trim()
        ? stripHtml(input.html)
        : "";
    const externalId = input.messageId?.trim() || crypto.randomUUID();
    const receivedAt =
      typeof input.receivedAt === "string" && input.receivedAt.trim()
        ? new Date(input.receivedAt)
        : new Date();
    const item = await upsertEmailCapturedItem({
      workspaceId,
      title: input.subject.trim(),
      body,
      externalId,
      sender: input.from?.trim() || null,
      sourceLabel: input.to?.trim() || "task@timesmithhq.com",
      sourceUrl: input.sourceUrl?.trim() || null,
      receivedAt: Number.isNaN(receivedAt.valueOf()) ? new Date() : receivedAt,
    });

    response.status(201).json({ id: item.id, status: "accepted" });
  });

  return router;
}
