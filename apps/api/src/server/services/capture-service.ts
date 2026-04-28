import crypto from "node:crypto";
import express from "express";
import { CaptureSourceType, CaptureStatus } from "@prisma/client";

import { prisma } from "../lib/db.js";
import { getAdminAppConfig } from "./app-config-service.js";

export type CaptureSourceValue = "slack" | "email";

export type CaptureInput = {
  sourceType: CaptureSourceValue;
  title: string;
  body?: string;
  externalId?: string | null;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  sender?: string | null;
  suggestedDueDate?: string | null;
  receivedAt?: string | null;
};

export type EmailInboundInput = {
  token?: string | null;
  subject: string;
  text?: string;
  html?: string;
  from?: string | null;
  to?: string | null;
  messageId?: string | null;
  receivedAt?: string | null;
  sourceUrl?: string | null;
  workspaceSlug?: string | null;
};

export type SlackInteractionPayload = {
  type: string;
  callback_id?: string;
  trigger_id?: string;
  team?: { id?: string; domain?: string };
  channel?: { id?: string; name?: string };
  message?: { text?: string; ts?: string; user?: string; bot_id?: string };
  user?: { id?: string; username?: string; name?: string };
};

export const captureSourceMap: Record<CaptureSourceValue, CaptureSourceType> = {
  slack: CaptureSourceType.SLACK,
  email: CaptureSourceType.EMAIL,
};

export function normalizeCaptureLinks(item: { sourceUrl?: string | null }) {
  return [item.sourceUrl].filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim());
}

export function getSlackDeepLink(teamId: string | undefined, channelId: string | undefined, messageTs: string | undefined) {
  if (!teamId || !channelId || !messageTs) {
    return null;
  }

  return `https://app.slack.com/client/${teamId}/${channelId}/thread/${channelId}-${messageTs.replace(".", "")}`;
}

type HeaderCarrier =
  | express.Request
  | {
      headers?: Record<string, string | string[] | undefined>;
      header?: (name: string) => string | undefined | null;
    };

function getHeader(request: HeaderCarrier, name: string) {
  if ("header" in request && typeof request.header === "function") {
    return request.header(name) ?? null;
  }

  const value = request.headers?.[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export async function verifySlackSignature(request: HeaderCarrier, rawBody: Buffer) {
  const config = await getAdminAppConfig();
  const slackSigningSecret = config.slackSigningSecret.trim();
  const slackDisableSignatureVerification = config.slackDisableSignatureVerification;

  if (slackDisableSignatureVerification) {
    return true;
  }

  if (!slackSigningSecret) {
    return false;
  }

  const timestamp = getHeader(request, "x-slack-request-timestamp");
  const signature = getHeader(request, "x-slack-signature");

  if (!timestamp || !signature) {
    return false;
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (Number.isNaN(age) || age > 60 * 5) {
    return false;
  }

  const baseString = `v0:${timestamp}:${rawBody.toString("utf8")}`;
  const digest = `v0=${crypto.createHmac("sha256", slackSigningSecret).update(baseString).digest("hex")}`;

  const expected = Buffer.from(digest, "utf8");
  const received = Buffer.from(signature, "utf8");

  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, received);
}

export function parseSlackFormPayload(rawBody: Buffer) {
  const params = new URLSearchParams(rawBody.toString("utf8"));
  return {
    payload: params.get("payload"),
    text: params.get("text"),
    channelId: params.get("channel_id"),
    channelName: params.get("channel_name"),
    userId: params.get("user_id"),
    userName: params.get("user_name"),
    teamId: params.get("team_id"),
    teamDomain: params.get("team_domain"),
    triggerId: params.get("trigger_id"),
  };
}

function isValidCaptureSource(value: string): value is CaptureSourceValue {
  return value in captureSourceMap;
}

export function validateCaptureInput(input: Partial<CaptureInput>): input is CaptureInput {
  return (
    typeof input.sourceType === "string" &&
    isValidCaptureSource(input.sourceType) &&
    typeof input.title === "string" &&
    input.title.trim().length > 0
  );
}

export async function upsertSlackCapturedItem(input: {
  workspaceId: string;
  title: string;
  body: string;
  externalId: string;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  sender?: string | null;
}) {
  const existing = await prisma.capturedItem.findFirst({
    where: {
      workspaceId: input.workspaceId,
      sourceType: CaptureSourceType.SLACK,
      externalId: input.externalId,
    },
  });

  if (existing) {
    return prisma.capturedItem.update({
      where: { id: existing.id },
      data: {
        status: CaptureStatus.NEW,
        title: input.title,
        body: input.body,
        sourceLabel: input.sourceLabel ?? null,
        sourceUrl: input.sourceUrl ?? null,
        sender: input.sender ?? null,
        discardedAt: null,
        acceptedAt: null,
        taskId: null,
        receivedAt: new Date(),
      },
    });
  }

  return prisma.capturedItem.create({
    data: {
      workspaceId: input.workspaceId,
      sourceType: CaptureSourceType.SLACK,
      status: CaptureStatus.NEW,
      externalId: input.externalId,
      title: input.title,
      body: input.body,
      sourceLabel: input.sourceLabel ?? null,
      sourceUrl: input.sourceUrl ?? null,
      sender: input.sender ?? null,
      receivedAt: new Date(),
    },
  });
}

export async function upsertEmailCapturedItem(input: {
  workspaceId: string;
  title: string;
  body: string;
  externalId: string;
  sender?: string | null;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  receivedAt?: Date;
}) {
  const existing = await prisma.capturedItem.findFirst({
    where: {
      workspaceId: input.workspaceId,
      sourceType: CaptureSourceType.EMAIL,
      externalId: input.externalId,
    },
  });

  if (existing) {
    return prisma.capturedItem.update({
      where: { id: existing.id },
      data: {
        status: CaptureStatus.NEW,
        title: input.title,
        body: input.body,
        sender: input.sender ?? null,
        sourceLabel: input.sourceLabel ?? null,
        sourceUrl: input.sourceUrl ?? null,
        discardedAt: null,
        acceptedAt: null,
        taskId: null,
        receivedAt: input.receivedAt ?? new Date(),
      },
    });
  }

  return prisma.capturedItem.create({
    data: {
      workspaceId: input.workspaceId,
      sourceType: CaptureSourceType.EMAIL,
      status: CaptureStatus.NEW,
      externalId: input.externalId,
      title: input.title,
      body: input.body,
      sender: input.sender ?? null,
      sourceLabel: input.sourceLabel ?? null,
      sourceUrl: input.sourceUrl ?? null,
      receivedAt: input.receivedAt ?? new Date(),
    },
  });
}
