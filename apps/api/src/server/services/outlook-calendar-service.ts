import { CalendarProvider, PrismaClient } from "@prisma/client";

import { prisma } from "../lib/db.js";
import { getAdminAppConfig } from "./app-config-service.js";
import type { OutlookCalendarEvent, OutlookCalendarStatus } from "../../../../../src/shared/api-types.js";

const OUTLOOK_STATE_COOKIE = "timesmith_outlook_state";
const OUTLOOK_SCOPES = ["openid", "offline_access", "User.Read", "Calendars.Read"];
const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

type OutlookStatePayload = {
  state: string;
  returnTo: string;
};

type OutlookTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

type GraphDateTime = {
  dateTime: string;
  timeZone?: string;
};

type GraphCalendarEvent = {
  id: string;
  subject?: string | null;
  start: GraphDateTime;
  end: GraphDateTime;
  isAllDay?: boolean | null;
  showAs?: string | null;
  webLink?: string | null;
  isCancelled?: boolean | null;
};

function parseCookieHeader(header?: string | null) {
  if (!header) {
    return new Map<string, string>();
  }

  return new Map(
    header
      .split(";")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0 && entry.includes("="))
      .map((entry) => {
        const separatorIndex = entry.indexOf("=");
        return [
          decodeURIComponent(entry.slice(0, separatorIndex)),
          decodeURIComponent(entry.slice(separatorIndex + 1)),
        ];
      }),
  );
}

function normalizeUrl(value: string | null | undefined) {
  return value?.trim().replace(/\/$/, "") ?? "";
}

function getOutlookTenantId(config: Awaited<ReturnType<typeof getAdminAppConfig>>) {
  return config.outlookTenantId.trim() || "common";
}

function buildTokenEndpoint(tenantId: string) {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
}

function buildAuthorizeEndpoint(tenantId: string) {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/authorize`;
}

export async function getOutlookCalendarStatus(userId: string): Promise<OutlookCalendarStatus> {
  const config = await getAdminAppConfig();
  const connection = await prisma.calendarConnection.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: CalendarProvider.OUTLOOK,
      },
    },
  });

  return {
    provider: "outlook",
    isConfigured: Boolean(config.outlookClientId.trim() && config.outlookClientSecret.trim()),
    isConnected: Boolean(connection),
    accountEmail: connection?.externalAccountEmail ?? null,
    expiresAt: connection?.expiresAt.toISOString() ?? null,
  };
}

export function serializeOutlookStateCookie(state: string, returnTo: string) {
  const encoded = encodeURIComponent(JSON.stringify({ state, returnTo } satisfies OutlookStatePayload));
  const parts = [
    `${OUTLOOK_STATE_COOKIE}=${encoded}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=900",
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function clearOutlookStateCookie() {
  const parts = [
    `${OUTLOOK_STATE_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function readOutlookStateCookie(header?: string | null) {
  const value = parseCookieHeader(header).get(OUTLOOK_STATE_COOKIE);
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<OutlookStatePayload>;
    if (typeof parsed.state !== "string" || typeof parsed.returnTo !== "string") {
      return null;
    }

    return {
      state: parsed.state,
      returnTo: normalizeUrl(parsed.returnTo),
    };
  } catch {
    return null;
  }
}

export function buildOutlookAuthorizeUrl({
  clientId,
  tenantId,
  redirectUri,
  state,
}: {
  clientId: string;
  tenantId: string;
  redirectUri: string;
  state: string;
}) {
  const url = new URL(buildAuthorizeEndpoint(tenantId));
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", OUTLOOK_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function resolveOutlookConnectConfig() {
  const config = await getAdminAppConfig();
  const clientId = config.outlookClientId.trim();
  const clientSecret = config.outlookClientSecret.trim();
  const tenantId = getOutlookTenantId(config);

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    tenantId,
  };
}

async function exchangeToken(form: URLSearchParams, tenantId: string) {
  const response = await fetch(buildTokenEndpoint(tenantId), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Microsoft token exchange failed (${response.status}): ${payload}`);
  }

  return (await response.json()) as OutlookTokenResponse;
}

export async function exchangeOutlookAuthorizationCode({
  clientId,
  clientSecret,
  tenantId,
  code,
  redirectUri,
}: {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  code: string;
  redirectUri: string;
}) {
  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    scope: OUTLOOK_SCOPES.join(" "),
  });

  return exchangeToken(form, tenantId);
}

export async function refreshOutlookAccessToken({
  refreshToken,
  clientId,
  clientSecret,
  tenantId,
}: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  tenantId: string;
}) {
  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: OUTLOOK_SCOPES.join(" "),
  });

  return exchangeToken(form, tenantId);
}

export async function fetchOutlookProfile(accessToken: string) {
  const response = await fetch(`${GRAPH_BASE_URL}/me?$select=mail,userPrincipalName`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Microsoft profile lookup failed (${response.status}): ${payload}`);
  }

  const payload = (await response.json()) as {
    mail?: string | null;
    userPrincipalName?: string | null;
  };

  return payload.mail?.trim() || payload.userPrincipalName?.trim() || null;
}

function expiresAtFromNow(expiresInSeconds: number) {
  return new Date(Date.now() + Math.max(expiresInSeconds - 60, 60) * 1000);
}

export async function upsertOutlookConnectionForUser({
  userId,
  accessToken,
  refreshToken,
  expiresInSeconds,
  externalAccountEmail,
  tx = prisma,
}: {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds: number;
  externalAccountEmail: string | null;
  tx?: PrismaClient;
}) {
  return tx.calendarConnection.upsert({
    where: {
      userId_provider: {
        userId,
        provider: CalendarProvider.OUTLOOK,
      },
    },
    create: {
      userId,
      provider: CalendarProvider.OUTLOOK,
      externalAccountEmail,
      accessToken,
      refreshToken: refreshToken ?? null,
      expiresAt: expiresAtFromNow(expiresInSeconds),
    },
    update: {
      externalAccountEmail,
      accessToken,
      refreshToken: refreshToken ?? null,
      expiresAt: expiresAtFromNow(expiresInSeconds),
    },
  });
}

export async function deleteOutlookConnectionForUser(userId: string) {
  await prisma.calendarConnection.deleteMany({
    where: {
      userId,
      provider: CalendarProvider.OUTLOOK,
    },
  });
}

export async function ensureOutlookAccessToken(userId: string) {
  const config = await resolveOutlookConnectConfig();
  if (!config) {
    throw new Error("Outlook calendar is not configured.");
  }

  const connection = await prisma.calendarConnection.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: CalendarProvider.OUTLOOK,
      },
    },
  });

  if (!connection) {
    throw new Error("Outlook calendar is not connected.");
  }

  if (connection.expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return connection.accessToken;
  }

  if (!connection.refreshToken) {
    throw new Error("Outlook calendar refresh token is missing.");
  }

  const refreshed = await refreshOutlookAccessToken({
    refreshToken: connection.refreshToken,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    tenantId: config.tenantId,
  });

  const updated = await prisma.calendarConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? connection.refreshToken,
      expiresAt: expiresAtFromNow(refreshed.expires_in),
    },
  });

  return updated.accessToken;
}

function parseUtcGraphDateTime(value: GraphDateTime) {
  const raw = value.dateTime.trim();
  if (!raw) {
    throw new Error("Calendar event dateTime is empty.");
  }

  const normalized = raw.endsWith("Z") ? raw : `${raw}Z`;
  return new Date(normalized);
}

export async function fetchOutlookCalendarEventsForUser({
  userId,
  start,
  end,
}: {
  userId: string;
  start: Date;
  end: Date;
}): Promise<OutlookCalendarEvent[]> {
  const accessToken = await ensureOutlookAccessToken(userId);
  const url = new URL(`${GRAPH_BASE_URL}/me/calendarView`);
  url.searchParams.set("startDateTime", start.toISOString());
  url.searchParams.set("endDateTime", end.toISOString());
  url.searchParams.set("$select", "id,subject,start,end,isAllDay,showAs,webLink,isCancelled");
  url.searchParams.set("$orderby", "start/dateTime");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="UTC"',
    },
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Microsoft calendar lookup failed (${response.status}): ${payload}`);
  }

  const payload = (await response.json()) as { value?: GraphCalendarEvent[] };
  const events = payload.value ?? [];

  return events
    .filter((event) => !event.isCancelled && (event.showAs?.toLowerCase() ?? "busy") !== "free")
    .map((event) => ({
      id: event.id,
      subject: event.subject?.trim() || "Busy",
      startsAt: parseUtcGraphDateTime(event.start).toISOString(),
      endsAt: parseUtcGraphDateTime(event.end).toISOString(),
      isAllDay: Boolean(event.isAllDay),
      showAs: event.showAs?.toLowerCase() ?? "busy",
      webLink: event.webLink?.trim() || null,
    }));
}
