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
    outlookClientId: normalizeString(record?.outlookClientId),
    outlookClientSecret: normalizeString(record?.outlookClientSecret),
    outlookTenantId: normalizeString(record?.outlookTenantId),
    slackSigningSecret: normalizeString(record?.slackSigningSecret),
    slackDisableSignatureVerification: Boolean(record?.slackDisableSignatureVerification),
  };
}

function defaultFromEnv(): AdminAppConfig {
  return {
    appBaseUrl: normalizeString(process.env.APP_BASE_URL),
    outlookClientId: normalizeString(process.env.OUTLOOK_CLIENT_ID),
    outlookClientSecret: normalizeString(process.env.OUTLOOK_CLIENT_SECRET),
    outlookTenantId: normalizeString(process.env.OUTLOOK_TENANT_ID),
    slackSigningSecret: normalizeString(process.env.SLACK_SIGNING_SECRET),
    slackDisableSignatureVerification: process.env.SLACK_DISABLE_SIGNATURE_VERIFICATION === "true",
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
    typeof input.outlookClientId === "string" &&
    typeof input.outlookClientSecret === "string" &&
    typeof input.outlookTenantId === "string" &&
    typeof input.slackSigningSecret === "string" &&
    typeof input.slackDisableSignatureVerification === "boolean"
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
      outlookClientId: nullableString(input.outlookClientId),
      outlookClientSecret: nullableString(input.outlookClientSecret),
      outlookTenantId: nullableString(input.outlookTenantId),
      slackSigningSecret: nullableString(input.slackSigningSecret),
      slackDisableSignatureVerification: input.slackDisableSignatureVerification,
    },
    update: {
      appBaseUrl: nullableString(input.appBaseUrl),
      outlookClientId: nullableString(input.outlookClientId),
      outlookClientSecret: nullableString(input.outlookClientSecret),
      outlookTenantId: nullableString(input.outlookTenantId),
      slackSigningSecret: nullableString(input.slackSigningSecret),
      slackDisableSignatureVerification: input.slackDisableSignatureVerification,
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
