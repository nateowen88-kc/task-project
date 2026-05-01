import { CaptureSourceType, CaptureStatus } from "@prisma/client";

import { prisma } from "../lib/db.js";

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

export const captureSourceMap: Record<CaptureSourceValue, CaptureSourceType> = {
  slack: CaptureSourceType.SLACK,
  email: CaptureSourceType.EMAIL,
};

export function normalizeCaptureLinks(item: { sourceUrl?: string | null }) {
  return [item.sourceUrl].filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim());
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
