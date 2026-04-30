import crypto from "node:crypto";

import { getAuthContext, resolveCaptureWorkspaceId } from "../lib/auth.js";
import {
  getSlackDeepLink,
  parseSlackFormPayload,
  upsertSlackCapturedItem,
  verifySlackSignature,
  type SlackInteractionPayload,
} from "../services/capture-service.js";
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
import { getAdminAppConfig } from "../services/app-config-service.js";
import { API_ROUTES } from "../../../../../src/shared/api-routes.js";
import {
  getHeader,
  getOrigin,
  getPathname,
  getProtocol,
  getUrl,
  methodNotAllowed,
  NativeRequest,
  NativeResponse,
  notFound,
  readJsonBody,
  sendEmpty,
  sendJson,
  sendText,
} from "./http.js";

async function readBuffer(request: NativeRequest) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function getApiBaseUrl(request: NativeRequest) {
  return `${getProtocol(request)}://${getHeader(request, "host") ?? "localhost"}`;
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

async function getFrontendBaseUrl(request: NativeRequest) {
  const config = await getAdminAppConfig();
  const configured = config.appBaseUrl.trim().replace(/\/$/, "");

  if (configured) {
    return configured;
  }

  return getOriginFromReferer(getHeader(request, "referer"));
}

function withCalendarResult(baseUrl: string, result: string, detail?: string) {
  const redirectTarget = new URL(baseUrl || "https://www.timesmithhq.com");
  redirectTarget.searchParams.set("calendar", result);

  if (detail) {
    redirectTarget.searchParams.set("calendarDetail", detail);
  }

  return redirectTarget.toString();
}

function redirect(response: NativeResponse, location: string, headers?: Record<string, string>) {
  response.statusCode = 302;
  response.setHeader("Location", location);

  for (const [key, value] of Object.entries(headers ?? {})) {
    response.setHeader(key, value);
  }

  response.end();
}

function parseEventRange(value?: string | null) {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

export default async function integrationsHandler(request: NativeRequest, response: NativeResponse) {
  const pathname = getPathname(request);
  const method = request.method ?? "GET";

  if (method === "GET" && pathname === API_ROUTES.integrations.outlookStatus) {
    const auth = await getAuthContext(request as any);
    if (!auth) {
      sendJson(response, 401, { error: "Authentication required." });
      return;
    }

    sendJson(response, 200, await getOutlookCalendarStatus(auth.user.id));
    return;
  }

  if (method === "GET" && pathname === API_ROUTES.integrations.outlookConnect) {
    const auth = await getAuthContext(request as any);
    if (!auth) {
      sendJson(response, 401, { error: "Authentication required." });
      return;
    }

    const config = await resolveOutlookConnectConfig();
    if (!config) {
      sendJson(response, 400, { error: "Outlook calendar is not configured." });
      return;
    }

    const redirectUri = `${getApiBaseUrl(request)}${API_ROUTES.integrations.outlookCallback}`;
    const state = crypto.randomUUID();
    const returnTo = await getFrontendBaseUrl(request);

    redirect(
      response,
      buildOutlookAuthorizeUrl({
        clientId: config.clientId,
        tenantId: config.tenantId,
        redirectUri,
        state,
      }),
      { "Set-Cookie": serializeOutlookStateCookie(state, returnTo) },
    );
    return;
  }

  if (method === "GET" && pathname === API_ROUTES.integrations.outlookCallback) {
    const stateCookie = readOutlookStateCookie(getHeader(request, "cookie"));
    const returnTo = stateCookie?.returnTo || (await getFrontendBaseUrl(request));
    const url = getUrl(request);
    const auth = await getAuthContext(request as any);
    const error = url.searchParams.get("error");

    if (error) {
      redirect(response, withCalendarResult(returnTo, "error", error), {
        "Set-Cookie": clearOutlookStateCookie(),
      });
      return;
    }

    if (!auth) {
      redirect(response, withCalendarResult(returnTo, "error", "auth-required"), {
        "Set-Cookie": clearOutlookStateCookie(),
      });
      return;
    }

    const config = await resolveOutlookConnectConfig();
    if (!config) {
      redirect(response, withCalendarResult(returnTo, "error", "not-configured"), {
        "Set-Cookie": clearOutlookStateCookie(),
      });
      return;
    }

    const state = url.searchParams.get("state") ?? "";
    const code = url.searchParams.get("code") ?? "";

    if (!stateCookie || !state || stateCookie.state !== state || !code) {
      redirect(response, withCalendarResult(returnTo, "error", "invalid-state"), {
        "Set-Cookie": clearOutlookStateCookie(),
      });
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

      redirect(response, withCalendarResult(returnTo, "connected"), {
        "Set-Cookie": clearOutlookStateCookie(),
      });
    } catch (cause) {
      console.error("[outlook] callback failed", cause);
      redirect(response, withCalendarResult(returnTo, "error", "callback-failed"), {
        "Set-Cookie": clearOutlookStateCookie(),
      });
    }

    return;
  }

  if (method === "DELETE" && pathname === API_ROUTES.integrations.outlookConnection) {
    const auth = await getAuthContext(request as any);
    if (!auth) {
      sendJson(response, 401, { error: "Authentication required." });
      return;
    }

    await deleteOutlookConnectionForUser(auth.user.id);
    sendEmpty(response, 204);
    return;
  }

  if (method === "GET" && pathname === API_ROUTES.integrations.outlookEvents) {
    const auth = await getAuthContext(request as any);
    if (!auth) {
      sendJson(response, 401, { error: "Authentication required." });
      return;
    }

    const url = getUrl(request);
    const start = parseEventRange(url.searchParams.get("start")) ?? new Date();
    const end =
      parseEventRange(url.searchParams.get("end")) ?? new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

    try {
      sendJson(
        response,
        200,
        await fetchOutlookCalendarEventsForUser({
          userId: auth.user.id,
          start,
          end,
        }),
      );
    } catch (cause) {
      console.error("[outlook] events fetch failed", cause);
      sendJson(response, 400, {
        error: cause instanceof Error ? cause.message : "Could not load Outlook calendar events.",
      });
    }
    return;
  }

  if (method === "POST" && pathname === API_ROUTES.integrations.slackInteractions) {
    const rawBody = await readBuffer(request);
    console.log("[slack] interactions request received");

    if (!(await verifySlackSignature(request, rawBody))) {
      console.log("[slack] interactions rejected: invalid signature");
      sendJson(response, 401, { error: "Invalid Slack signature." });
      return;
    }

    const { payload, teamDomain } = parseSlackFormPayload(rawBody);
    if (!payload) {
      console.log("[slack] interactions rejected: missing payload");
      sendJson(response, 400, { error: "Missing Slack payload." });
      return;
    }

    const parsed = JSON.parse(payload) as SlackInteractionPayload;
    if (parsed.type !== "message_action") {
      sendJson(response, 200, { ok: true, ignored: true });
      return;
    }

    const workspaceId = await resolveCaptureWorkspaceId(teamDomain ?? getHeader(request, "x-timesmith-workspace"));
    const channelId = parsed.channel?.id;
    const channelName = parsed.channel?.name ? `#${parsed.channel.name}` : channelId ?? null;
    const sender = parsed.user?.name ?? parsed.user?.username ?? parsed.user?.id ?? parsed.message?.user ?? null;
    const messageText = parsed.message?.text?.trim() ?? "";
    const messageTs = parsed.message?.ts;
    const externalId = channelId && messageTs ? `${channelId}:${messageTs}` : `${parsed.trigger_id ?? crypto.randomUUID()}`;
    const sourceUrl = getSlackDeepLink(parsed.team?.id, channelId, messageTs);

    response.statusCode = 200;
    response.end("");

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

    return;
  }

  if (method === "POST" && pathname === API_ROUTES.integrations.slackCommands) {
    const rawBody = await readBuffer(request);
    console.log("[slack] slash command request received");

    if (!(await verifySlackSignature(request, rawBody))) {
      console.log("[slack] slash command rejected: invalid signature");
      sendJson(response, 401, { error: "Invalid Slack signature." });
      return;
    }

    const parsed = parseSlackFormPayload(rawBody);
    const text = parsed.text?.trim();

    if (!text) {
      sendText(response, 200, "Usage: /taskflow-save <task or follow-up>");
      return;
    }

    const workspaceId = await resolveCaptureWorkspaceId(parsed.teamDomain ?? getHeader(request, "x-timesmith-workspace"));
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
    sendText(response, 200, `Saved to TimeSmith inbox: ${item.title}`);
    return;
  }

  if (pathname.startsWith("/api/integrations")) {
    methodNotAllowed(response);
    return;
  }

  notFound(response);
}
