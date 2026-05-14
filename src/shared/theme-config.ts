export type ThemeColorConfig = {
  background: string;
  surface: string;
  surfaceMuted: string;
  primary: string;
  accent: string;
  accentWarm: string;
  textPrimary: string;
  light: string;
  success: string;
  warning: string;
  error: string;
  secondaryUi: string;
  secondaryUiHover: string;
  textSecondary: string;
  featureInbox: string;
  featureAlerts: string;
  featureOneOnOnes: string;
  featureTeamAdmin: string;
  statusTodo: string;
  statusInProgress: string;
  statusBlocked: string;
  statusDone: string;
};

export const DEFAULT_THEME_COLORS: ThemeColorConfig = {
  background: "#F4F7FB",
  surface: "#FFFFFF",
  surfaceMuted: "#EAF0F6",
  primary: "#3B82F6",
  accent: "#3B82F6",
  accentWarm: "#3B82F6",
  textPrimary: "#1F2937",
  light: "#FFFFFF",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  secondaryUi: "#596C7A",
  secondaryUiHover: "#4A5A66",
  textSecondary: "#6B7280",
  featureInbox: "#6366F1",
  featureAlerts: "#F97316",
  featureOneOnOnes: "#8B5CF6",
  featureTeamAdmin: "#0EA5E9",
  statusTodo: "#3B82F6",
  statusInProgress: "#F59E0B",
  statusBlocked: "#EF4444",
  statusDone: "#10B981",
};

export const THEME_COLOR_GROUPS = [
  {
    title: "Core",
    fields: [
      { key: "background", label: "Background" },
      { key: "surface", label: "Surface" },
      { key: "surfaceMuted", label: "Muted surface" },
      { key: "primary", label: "Primary" },
      { key: "secondaryUi", label: "Secondary UI" },
      { key: "secondaryUiHover", label: "Secondary hover" },
      { key: "accent", label: "Accent" },
      { key: "accentWarm", label: "Accent warm" },
      { key: "textPrimary", label: "Text primary" },
      { key: "textSecondary", label: "Text secondary" },
      { key: "light", label: "Light" },
    ],
  },
  {
    title: "Status",
    fields: [
      { key: "statusTodo", label: "To do" },
      { key: "statusInProgress", label: "In progress" },
      { key: "statusBlocked", label: "Blocked" },
      { key: "statusDone", label: "Done" },
      { key: "success", label: "Success" },
      { key: "warning", label: "Warning" },
      { key: "error", label: "Error" },
    ],
  },
  {
    title: "Feature accents",
    fields: [
      { key: "featureInbox", label: "Inbox" },
      { key: "featureAlerts", label: "Alerts" },
      { key: "featureOneOnOnes", label: "1:1s" },
      { key: "featureTeamAdmin", label: "Team/Admin" },
    ],
  },
] as const satisfies ReadonlyArray<{
  title: string;
  fields: ReadonlyArray<{ key: keyof ThemeColorConfig; label: string }>;
}>;

export function normalizeHexColor(value: string, fallback = "#000000") {
  const raw = value.trim().replace(/^#?/, "#");
  const shortMatch = /^#([0-9a-fA-F]{3})$/.exec(raw);
  if (shortMatch) {
    const expanded = shortMatch[1]
      .split("")
      .map((part) => `${part}${part}`)
      .join("");
    return `#${expanded.toUpperCase()}`;
  }

  if (/^#([0-9a-fA-F]{6})$/.test(raw)) {
    return raw.toUpperCase();
  }

  return fallback;
}

export function isValidHexColor(value: string) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

export function mergeThemeColors(input?: Partial<ThemeColorConfig> | null): ThemeColorConfig {
  const merged = { ...DEFAULT_THEME_COLORS };

  if (!input) {
    return merged;
  }

  for (const key of Object.keys(DEFAULT_THEME_COLORS) as Array<keyof ThemeColorConfig>) {
    const nextValue = input[key];
    if (typeof nextValue === "string" && isValidHexColor(nextValue)) {
      merged[key] = normalizeHexColor(nextValue, DEFAULT_THEME_COLORS[key]);
    }
  }

  return merged;
}
