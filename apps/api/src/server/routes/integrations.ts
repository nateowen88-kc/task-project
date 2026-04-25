import crypto from "node:crypto";
import express from "express";

import { resolveCaptureWorkspaceId } from "../lib/auth.js";
import { prisma } from "../lib/db.js";
import { toApiCapturedItem } from "../lib/serializers.js";
import { API_ROUTES } from "../../../../../src/shared/api-routes.js";
import {
  getSlackDeepLink,
  parseSlackFormPayload,
  upsertEmailCapturedItem,
  upsertSlackCapturedItem,
  verifySlackSignature,
  type EmailInboundInput,
  type SlackInteractionPayload,
} from "../services/capture-service.js";

const emailInboundToken = process.env.EMAIL_INBOUND_TOKEN;

export const slackFormMiddleware = express.urlencoded({
  extended: false,
  verify: (request, _response, buffer) => {
    (request as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
  },
});

export function createIntegrationsRouter() {
  const router = express.Router();

  router.post(API_ROUTES.integrations.slackInteractions, slackFormMiddleware, async (request, response) => {
    const rawBody = (request as express.Request & { rawBody?: Buffer }).rawBody ?? Buffer.from("");
    console.log("[slack] interactions request received");

    if (!verifySlackSignature(request, rawBody)) {
      console.log("[slack] interactions rejected: invalid signature");
      response.status(401).json({ error: "Invalid Slack signature." });
      return;
    }

    const { payload, teamDomain } = parseSlackFormPayload(rawBody);
    if (!payload) {
      console.log("[slack] interactions rejected: missing payload");
      response.status(400).json({ error: "Missing Slack payload." });
      return;
    }

    const parsed = JSON.parse(payload) as SlackInteractionPayload;
    if (parsed.type !== "message_action") {
      response.status(200).json({ ok: true, ignored: true });
      return;
    }

    const workspaceId = await resolveCaptureWorkspaceId(teamDomain ?? request.header("x-timesmith-workspace"));
    const channelId = parsed.channel?.id;
    const channelName = parsed.channel?.name ? `#${parsed.channel.name}` : channelId ?? null;
    const sender = parsed.user?.name ?? parsed.user?.username ?? parsed.user?.id ?? parsed.message?.user ?? null;
    const messageText = parsed.message?.text?.trim() ?? "";
    const messageTs = parsed.message?.ts;
    const externalId = channelId && messageTs ? `${channelId}:${messageTs}` : `${parsed.trigger_id ?? crypto.randomUUID()}`;
    const sourceUrl = getSlackDeepLink(parsed.team?.id, channelId, messageTs);

    response.status(200).send("");

    void upsertSlackCapturedItem({
      workspaceId,
      title: messageText.length > 80 ? `${messageText.slice(0, 77)}...` : messageText || "Slack message",
      body: messageText,
      externalId,
      sourceLabel: channelName,
      sourceUrl,
      sender,
    })
      .then((item) => {
        console.log(`[slack] interactions saved capture ${item.id} for externalId ${externalId}`);
      })
      .catch((error: unknown) => {
        console.error("[slack] interactions save failed", error);
      });
  });

  router.post(API_ROUTES.integrations.slackCommands, slackFormMiddleware, async (request, response) => {
    const rawBody = (request as express.Request & { rawBody?: Buffer }).rawBody ?? Buffer.from("");
    console.log("[slack] slash command request received");

    if (!verifySlackSignature(request, rawBody)) {
      console.log("[slack] slash command rejected: invalid signature");
      response.status(401).json({ error: "Invalid Slack signature." });
      return;
    }

    const parsed = parseSlackFormPayload(rawBody);
    const text = parsed.text?.trim();

    if (!text) {
      response.status(200).send("Usage: /taskflow-save <task or follow-up>");
      return;
    }

    const workspaceId = await resolveCaptureWorkspaceId(parsed.teamDomain ?? request.header("x-timesmith-workspace"));
    const item = await upsertSlackCapturedItem({
      workspaceId,
      title: text.length > 80 ? `${text.slice(0, 77)}...` : text,
      body: text,
      externalId: parsed.channelId && parsed.triggerId ? `${parsed.channelId}:${parsed.triggerId}` : crypto.randomUUID(),
      sourceLabel: parsed.channelName ? `#${parsed.channelName}` : parsed.channelId ?? null,
      sender: parsed.userName ?? parsed.userId ?? null,
      sourceUrl: null,
    });

    console.log(`[slack] slash command saved capture ${item.id} for text "${item.title}"`);
    response.status(200).send(`Saved to TimeSmith inbox: ${item.title}`);
  });

  router.post(API_ROUTES.integrations.emailInbound, async (request, response) => {
    const input = request.body as Partial<EmailInboundInput>;
    const authorization = request.header("authorization");
    const directTokenHeader = request.header("x-email-inbound-token");
    const bearerToken = authorization?.replace(/^Bearer\\s+/i, "").trim() ?? null;
    const expectedToken = emailInboundToken?.trim() ?? null;
    const bodyToken = input.token?.trim() ?? null;

    if (
      !expectedToken ||
      (bearerToken !== expectedToken && directTokenHeader?.trim() !== expectedToken && bodyToken !== expectedToken)
    ) {
      response.status(401).json({ error: "Invalid email inbound token." });
      return;
    }

    if (typeof input.subject !== "string" || input.subject.trim().length === 0) {
      response.status(400).json({ error: "Email subject is required." });
      return;
    }

    const workspaceId = await resolveCaptureWorkspaceId(input.workspaceSlug ?? request.header("x-timesmith-workspace"));
    const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();
    const body = input.text?.trim() || input.html?.trim() || "";
    const sender = input.from?.trim() || null;
    const recipient = input.to?.trim() || null;
    const externalId = input.messageId?.trim() || crypto.randomUUID();

    const item = await upsertEmailCapturedItem({
      workspaceId,
      title: input.subject.trim(),
      body,
      externalId,
      sender,
      sourceLabel: recipient ? `To: ${recipient}` : "Forwarded email",
      sourceUrl: input.sourceUrl?.trim() || null,
      receivedAt,
    });

    const hydratedItem = await prisma.capturedItem.findUniqueOrThrow({
      where: { id: item.id },
      include: { workspace: true },
    });

    response.status(201).json(toApiCapturedItem(hydratedItem));
  });

  return router;
}
