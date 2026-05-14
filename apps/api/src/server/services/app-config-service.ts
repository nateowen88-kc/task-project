import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../lib/db.js";
import type { AdminAppConfig, UpdateAppConfigPayload } from "../../../../../src/shared/api-types.js";
import { mergeThemeColors, isValidHexColor, type ThemeColorConfig } from "../../../../../src/shared/theme-config.js";

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

function normalizeStringList(value: string[] | null | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => item.trim()).filter((item) => item.length > 0);
}

function fromRecord(record: AppConfigRecord): AdminAppConfig {
  return {
    appBaseUrl: normalizeString(record?.appBaseUrl),
    directReportNameOptions: normalizeStringList(record?.directReportNameOptions),
    directReportRoleOptions: normalizeStringList(record?.directReportRoleOptions),
    themeColors: mergeThemeColors(record?.themeColors as Partial<ThemeColorConfig> | null | undefined),
  };
}

function defaultFromEnv(): AdminAppConfig {
  return {
    appBaseUrl: normalizeString(process.env.APP_BASE_URL),
    directReportNameOptions: [],
    directReportRoleOptions: [],
    themeColors: mergeThemeColors(),
  };
}

function isValidThemeColors(value: unknown): value is ThemeColorConfig {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.values(value as Record<string, unknown>).every(
    (item) => typeof item === "string" && isValidHexColor(item),
  );
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
    Array.isArray(input.directReportNameOptions) &&
    input.directReportNameOptions.every((item) => typeof item === "string") &&
    Array.isArray(input.directReportRoleOptions) &&
    input.directReportRoleOptions.every((item) => typeof item === "string") &&
    isValidThemeColors(input.themeColors)
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
      directReportNameOptions: normalizeStringList(input.directReportNameOptions),
      directReportRoleOptions: normalizeStringList(input.directReportRoleOptions),
      themeColors: mergeThemeColors(input.themeColors),
    },
    update: {
      appBaseUrl: nullableString(input.appBaseUrl),
      directReportNameOptions: normalizeStringList(input.directReportNameOptions),
      directReportRoleOptions: normalizeStringList(input.directReportRoleOptions),
      themeColors: mergeThemeColors(input.themeColors),
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
