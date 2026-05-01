import { getAuthContext, resolveCaptureWorkspaceId } from "../lib/auth.js";
import {
  getSlackDeepLink,
  parseSlackFormPayload,
  upsertSlackCapturedItem,
  verifySlackSignature,
  type SlackInteractionPayload,
} from "../services/capture-service.js";
import { API_ROUTES } from "../../../../../src/shared/api-routes.js";
import {
  getHeader,
  getPathname,
  methodNotAllowed,
  NativeRequest,
  NativeResponse,
  notFound,
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

export default async function integrationsHandler(request: NativeRequest, response: NativeResponse) {
  const pathname = getPathname(request);
  const method = request.method ?? "GET";

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
