import crypto from "node:crypto";
import express from "express";

import { getAuthContext, resolveCaptureWorkspaceId } from "../lib/auth.js";
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
import { getAdminAppConfig } from "../services/app-config-service.js";
import {
  buildOutlookAuthorizeUrl,
  clearOutlookStateCookie,
  deleteOutlookConnectionForUser,
  exchangeOutlookAuthorizationCode,
  fetchOutlookCalendarEventsForUser,
  fetchOutlookProfile,
  getOutlookCalendarStatus,
  readOutlookStateCookie,
  resolveOutlookConnectConfig,
  serializeOutlookStateCookie,
  upsertOutlookConnectionForUser,
} from "../services/outlook-calendar-service.js";

export const slackFormMiddleware = express.urlencoded({
  extended: false,
  verify: (request, _response, buffer) => {
    (request as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
  },
});

function getApiBaseUrl(request: express.Request) {
  const protocol = request.header("x-forwarded-proto") ?? request.protocol;
  return `${protocol}://${request.get("host")}`;
}

function getOriginFromReferer(referer?: string | null) {
  if (!referer?.trim()) {
    return "";
  }

  try {
    return new URL(referer).origin;
  } catch {
    return "";
  }
}

async function getFrontendBaseUrl(request: express.Request) {
  const config = await getAdminAppConfig();
  const configured = config.appBaseUrl.trim().replace(/\/$/, "");

  if (configured) {
    return configured;
  }

  return getOriginFromReferer(request.header("referer"));
}

function withCalendarResult(baseUrl: string, result: string, detail?: string) {
  const redirectTarget = new URL(baseUrl || "https://www.timesmithhq.com");
  redirectTarget.searchParams.set("calendar", result);

  if (detail) {
    redirectTarget.searchParams.set("calendarDetail", detail);
  }

  return redirectTarget.toString();
}

function parseEventRange(value?: string) {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

export function createIntegrationsRouter() {
  const router = express.Router();

  router.get(API_ROUTES.integrations.outlookStatus, async (request, response) => {
    const auth = await getAuthContext(request);
    if (!auth) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    response.json(await getOutlookCalendarStatus(auth.user.id));
  });

  router.get(API_ROUTES.integrations.outlookConnect, async (request, response) => {
    const auth = await getAuthContext(request);
    if (!auth) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    const config = await resolveOutlookConnectConfig();
    if (!config) {
      response.status(400).json({ error: "Outlook calendar is not configured." });
      return;
    }

    const redirectUri = `${getApiBaseUrl(request)}${API_ROUTES.integrations.outlookCallback}`;
    const state = crypto.randomUUID();
    const returnTo = await getFrontendBaseUrl(request);

    response.setHeader("Set-Cookie", serializeOutlookStateCookie(state, returnTo));
    response.redirect(
      302,
      buildOutlookAuthorizeUrl({
        clientId: config.clientId,
        tenantId: config.tenantId,
        redirectUri,
        state,
      }),
    );
  });

  router.get(API_ROUTES.integrations.outlookCallback, async (request, response) => {
    const stateCookie = readOutlookStateCookie(request.header("cookie"));
    const returnTo = stateCookie?.returnTo || (await getFrontendBaseUrl(request));
    response.setHeader("Set-Cookie", clearOutlookStateCookie());

    const error = request.query.error;
    if (typeof error === "string" && error.trim()) {
      response.redirect(302, withCalendarResult(returnTo, "error", error));
      return;
    }

    const auth = await getAuthContext(request);
    if (!auth) {
      response.redirect(302, withCalendarResult(returnTo, "error", "auth-required"));
      return;
    }

    const config = await resolveOutlookConnectConfig();
    if (!config) {
      response.redirect(302, withCalendarResult(returnTo, "error", "not-configured"));
      return;
    }

    const state = typeof request.query.state === "string" ? request.query.state : "";
    const code = typeof request.query.code === "string" ? request.query.code : "";

    if (!stateCookie || !state || stateCookie.state !== state || !code) {
      response.redirect(302, withCalendarResult(returnTo, "error", "invalid-state"));
      return;
    }

    try {
      const redirectUri = `${getApiBaseUrl(request)}${API_ROUTES.integrations.outlookCallback}`;
      const tokenSet = await exchangeOutlookAuthorizationCode({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        tenantId: config.tenantId,
        code,
        redirectUri,
      });
      const accountEmail = await fetchOutlookProfile(tokenSet.access_token);

      await upsertOutlookConnectionForUser({
        userId: auth.user.id,
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token,
        expiresInSeconds: tokenSet.expires_in,
        externalAccountEmail: accountEmail,
      });

      response.redirect(302, withCalendarResult(returnTo, "connected"));
    } catch (cause) {
      console.error("[outlook] callback failed", cause);
      response.redirect(302, withCalendarResult(returnTo, "error", "callback-failed"));
    }
  });

  router.delete(API_ROUTES.integrations.outlookConnection, async (request, response) => {
    const auth = await getAuthContext(request);
    if (!auth) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    await deleteOutlookConnectionForUser(auth.user.id);
    response.status(204).end();
  });

  router.get(API_ROUTES.integrations.outlookEvents, async (request, response) => {
    const auth = await getAuthContext(request);
    if (!auth) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    const start = parseEventRange(typeof request.query.start === "string" ? request.query.start : undefined) ?? new Date();
    const end =
      parseEventRange(typeof request.query.end === "string" ? request.query.end : undefined) ??
      new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

    try {
      response.json(
        await fetchOutlookCalendarEventsForUser({
          userId: auth.user.id,
          start,
          end,
        }),
      );
    } catch (cause) {
      console.error("[outlook] events fetch failed", cause);
      response.status(400).json({
        error: cause instanceof Error ? cause.message : "Could not load Outlook calendar events.",
      });
    }
  });

  router.post(API_ROUTES.integrations.slackInteractions, slackFormMiddleware, async (request, response) => {
    const rawBody = (request as express.Request & { rawBody?: Buffer }).rawBody ?? Buffer.from("");
    console.log("[slack] interactions request received");

    if (!(await verifySlackSignature(request, rawBody))) {
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
      .catch((cause: unknown) => {
        console.error("[slack] interactions save failed", cause);
      });
  });

  router.post(API_ROUTES.integrations.slackCommands, slackFormMiddleware, async (request, response) => {
    const rawBody = (request as express.Request & { rawBody?: Buffer }).rawBody ?? Buffer.from("");
    console.log("[slack] slash command request received");

    if (!(await verifySlackSignature(request, rawBody))) {
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
    const appConfig = await getAdminAppConfig();
    const authorization = request.header("authorization");
    const directTokenHeader = request.header("x-email-inbound-token");
    const bearerToken = authorization?.replace(/^Bearer\\s+/i, "").trim() ?? null;
    const expectedToken = appConfig.emailInboundToken.trim() || null;
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

    const recipient = input.to?.trim() || null;
    const workspaceId = await resolveCaptureWorkspaceId(
      input.workspaceSlug ?? request.header("x-timesmith-workspace"),
      recipient,
    );
    const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();
    const body = input.text?.trim() || input.html?.trim() || "";
    const sender = input.from?.trim() || null;
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
