import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../lib/db.js";
import type { AdminAppConfig, UpdateAppConfigPayload } from "../../../../../src/shared/api-types.js";

const APP_CONFIG_ID = "primary";

type AppConfigClient = Prisma.TransactionClient | PrismaClient;

type AppConfigRecord = Awaited<ReturnType<typeof prisma.appConfig.findUnique>>;

function normalizeString(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function nullableString(value: string | null | undefined) {
  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : null;
}

function fromRecord(record: AppConfigRecord): AdminAppConfig {
  return {
    appBaseUrl: normalizeString(record?.appBaseUrl),
    resendApiKey: normalizeString(record?.resendApiKey),
    resendFromEmail: normalizeString(record?.resendFromEmail),
    resendReplyToEmail: normalizeString(record?.resendReplyToEmail),
    slackSigningSecret: normalizeString(record?.slackSigningSecret),
    slackDisableSignatureVerification: Boolean(record?.slackDisableSignatureVerification),
    emailInboundToken: normalizeString(record?.emailInboundToken),
  };
}

function defaultFromEnv(): AdminAppConfig {
  return {
    appBaseUrl: normalizeString(process.env.APP_BASE_URL),
    resendApiKey: normalizeString(process.env.RESEND_API_KEY),
    resendFromEmail: normalizeString(process.env.RESEND_FROM_EMAIL),
    resendReplyToEmail: normalizeString(process.env.RESEND_REPLY_TO_EMAIL),
    slackSigningSecret: normalizeString(process.env.SLACK_SIGNING_SECRET),
    slackDisableSignatureVerification: process.env.SLACK_DISABLE_SIGNATURE_VERIFICATION === "true",
    emailInboundToken: normalizeString(process.env.EMAIL_INBOUND_TOKEN),
  };
}

export async function getAdminAppConfig(tx: AppConfigClient = prisma): Promise<AdminAppConfig> {
  const record = await tx.appConfig.findUnique({ where: { id: APP_CONFIG_ID } });
  if (!record) {
    return defaultFromEnv();
  }

  return fromRecord(record);
}

export function validateUpdateAppConfigInput(input: Partial<UpdateAppConfigPayload>): input is UpdateAppConfigPayload {
  return (
    typeof input.appBaseUrl === "string" &&
    typeof input.resendApiKey === "string" &&
    typeof input.resendFromEmail === "string" &&
    typeof input.resendReplyToEmail === "string" &&
    typeof input.slackSigningSecret === "string" &&
    typeof input.slackDisableSignatureVerification === "boolean" &&
    typeof input.emailInboundToken === "string"
  );
}

export async function updateAdminAppConfig(
  input: UpdateAppConfigPayload,
  tx: AppConfigClient = prisma,
): Promise<AdminAppConfig> {
  const record = await tx.appConfig.upsert({
    where: { id: APP_CONFIG_ID },
    create: {
      id: APP_CONFIG_ID,
      appBaseUrl: nullableString(input.appBaseUrl),
      resendApiKey: nullableString(input.resendApiKey),
      resendFromEmail: nullableString(input.resendFromEmail),
      resendReplyToEmail: nullableString(input.resendReplyToEmail),
      slackSigningSecret: nullableString(input.slackSigningSecret),
      slackDisableSignatureVerification: input.slackDisableSignatureVerification,
      emailInboundToken: nullableString(input.emailInboundToken),
    },
    update: {
      appBaseUrl: nullableString(input.appBaseUrl),
      resendApiKey: nullableString(input.resendApiKey),
      resendFromEmail: nullableString(input.resendFromEmail),
      resendReplyToEmail: nullableString(input.resendReplyToEmail),
      slackSigningSecret: nullableString(input.slackSigningSecret),
      slackDisableSignatureVerification: input.slackDisableSignatureVerification,
      emailInboundToken: nullableString(input.emailInboundToken),
    },
  });

  return fromRecord(record);
}

export async function resolveAppBaseUrl(fallbackOrigin?: string | null) {
  const config = await getAdminAppConfig();
  const configured = normalizeString(config.appBaseUrl);

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return (fallbackOrigin?.trim() ?? "").replace(/\/$/, "");
}
