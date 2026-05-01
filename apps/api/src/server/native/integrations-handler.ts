import crypto from "node:crypto";

import { resolveCaptureWorkspaceId } from "../lib/auth.js";
import {
  upsertEmailCapturedItem,
  type EmailInboundInput,
} from "../services/capture-service.js";
import { API_ROUTES } from "../../../../../src/shared/api-routes.js";
import {
  getPathname,
  methodNotAllowed,
  NativeRequest,
  NativeResponse,
  notFound,
  readJsonBody,
  sendEmpty,
  sendJson,
} from "./http.js";

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export default async function integrationsHandler(request: NativeRequest, response: NativeResponse) {
  const pathname = getPathname(request);
  const method = request.method ?? "GET";

  if (method === "POST" && pathname === API_ROUTES.integrations.emailInbound) {
    const input = (await readJsonBody<Partial<EmailInboundInput>>(request)) ?? {};

    if (typeof input.subject !== "string" || !input.subject.trim()) {
      sendJson(response, 400, { error: "Subject is required." });
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

    sendJson(response, 201, { id: item.id, status: "accepted" });
    return;
  }

  if (pathname.startsWith("/api/integrations")) {
    methodNotAllowed(response);
    return;
  }

  notFound(response);
}
