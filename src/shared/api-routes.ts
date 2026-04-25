export type TodayItemSource = "task" | "occurrence";

export const API_ROUTES = {
  auth: {
    me: "/api/auth/me",
    login: "/api/auth/login",
    register: "/api/auth/register",
    invite: (token: string) => `/api/auth/invite/${token}`,
    acceptInvite: "/api/auth/accept-invite",
    logout: "/api/auth/logout",
    workspace: "/api/auth/workspace",
  },
  admin: {
    users: "/api/admin/users",
    user: (id: string) => `/api/admin/users/${id}`,
    resetPassword: (id: string) => `/api/admin/users/${id}/reset-password`,
    invites: "/api/admin/invites",
    invite: (id: string) => `/api/admin/invites/${id}`,
    workspaces: "/api/admin/workspaces",
    workspace: (id: string) => `/api/admin/workspaces/${id}`,
    workspaceStatus: (id: string) => `/api/admin/workspaces/${id}/status`,
  },
  agenda: {
    today: "/api/today",
    generate: "/api/agenda/generate",
    itemStatus: (source: TodayItemSource, id: string) => `/api/today-items/${source}/${id}/status`,
    itemSkip: (source: TodayItemSource, id: string) => `/api/today-items/${source}/${id}/skip`,
    itemSnooze: (source: TodayItemSource, id: string) => `/api/today-items/${source}/${id}/snooze`,
  },
  tasks: {
    list: "/api/tasks",
    create: "/api/tasks",
    detail: (id: string) => `/api/tasks/${id}/detail`,
    update: (id: string) => `/api/tasks/${id}`,
    delete: (id: string) => `/api/tasks/${id}`,
    comments: (id: string) => `/api/tasks/${id}/comments`,
    status: (id: string) => `/api/tasks/${id}/status`,
    archive: (id: string) => `/api/tasks/${id}/archive`,
  },
  capturedItems: {
    list: "/api/captured-items",
    create: "/api/captured-items",
    accept: (id: string) => `/api/captured-items/${id}/accept`,
    discard: (id: string) => `/api/captured-items/${id}/discard`,
    demoSlack: "/api/captured-items/demo/slack",
    demoEmail: "/api/captured-items/demo/email",
  },
  notifications: {
    list: "/api/notifications",
    read: (id: string) => `/api/notifications/${id}/read`,
    readAll: "/api/notifications/read-all",
  },
  workspaceMembers: {
    list: "/api/workspace-members",
  },
  integrations: {
    slackInteractions: "/api/integrations/slack/interactions",
    slackCommands: "/api/integrations/slack/commands",
    emailInbound: "/api/integrations/email/inbound",
  },
} as const;
