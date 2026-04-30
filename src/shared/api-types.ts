export type TaskStatus = "blocked" | "todo" | "in-progress" | "done";
export type TaskImportance = "low" | "medium" | "high";
export type RecurrenceRuleValue = "none" | "daily" | "weekdays" | "weekly" | "monthly";
export type TodayItemSource = "task" | "occurrence";
export type CaptureSourceType = "slack" | "email";
export type CaptureStatus = "new" | "accepted" | "discarded";
export type WorkspaceRole = "owner" | "admin" | "user";
export type WorkspaceInviteRole = "admin" | "user";
export type WorkspaceInviteStatus = "pending" | "accepted" | "revoked" | "expired";
export type NotificationType = "task-assigned" | "comment-added" | "task-due" | "task-overdue";
export type OneOnOneCadence = "weekly" | "biweekly" | "monthly" | "ad-hoc";
export type OneOnOneMeetingStatus = "scheduled" | "completed" | "canceled";

export type AppPermissions = {
  canManageUsers: boolean;
  canCreateUsers: boolean;
  canCreateWorkspaces: boolean;
  canPromoteToOwner: boolean;
  canResetPasswords: boolean;
  canAssignTasks: boolean;
  canEditAllTasks: boolean;
  canDeleteAllTasks: boolean;
  canArchiveAllTasks: boolean;
};

export type TaskPermissions = {
  canEdit: boolean;
  canChangeStatus: boolean;
  canComment: boolean;
  canArchive: boolean;
  canDelete: boolean;
  canReassign: boolean;
};

export type Task = {
  id: string;
  title: string;
  details: string;
  dueDate: string;
  remindAt: string | null;
  status: TaskStatus;
  importance: TaskImportance;
  workspaceId?: string;
  workspaceName?: string | null;
  agendaReason?: string;
  agendaConfidence?: number;
  links: string[];
  isRecurring: boolean;
  recurrenceRule: RecurrenceRuleValue;
  plannedForDate: string | null;
  archivedAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  permissions: TaskPermissions;
};

export type TodayItem = {
  id: string;
  taskId: string;
  sourceType: TodayItemSource;
  title: string;
  details: string;
  dueDate: string;
  scheduledFor: string;
  remindAt: string | null;
  status: TaskStatus;
  importance: TaskImportance;
  workspaceId?: string;
  workspaceName?: string | null;
  agendaReason?: string;
  agendaConfidence?: number;
  links: string[];
  isRecurring: boolean;
  recurrenceRule: RecurrenceRuleValue;
  plannedForDate: string | null;
  archivedAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  permissions: TaskPermissions;
};

export type AgendaResponse = {
  date: string;
  promotedTaskCount: number;
  items: TodayItem[];
};

export type OutlookCalendarStatus = {
  provider: "outlook";
  isConfigured: boolean;
  isConnected: boolean;
  accountEmail: string | null;
  expiresAt: string | null;
};

export type OutlookCalendarEvent = {
  id: string;
  subject: string;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  showAs: string;
  webLink: string | null;
};

export type CapturedItem = {
  id: string;
  sourceType: CaptureSourceType;
  status: CaptureStatus;
  workspaceId?: string;
  workspaceName?: string | null;
  externalId: string | null;
  title: string;
  body: string;
  sourceLabel: string | null;
  sourceUrl: string | null;
  sender: string | null;
  suggestedDueDate: string | null;
  receivedAt: string;
  acceptedAt: string | null;
  discardedAt: string | null;
  taskId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskDraft = {
  title: string;
  details: string;
  dueDate: string;
  remindAt: string;
  status: TaskStatus;
  importance: TaskImportance;
  assigneeId: string;
  links: string;
  isRecurring: boolean;
  recurrenceRule: RecurrenceRuleValue;
};

export type TaskTemplate = {
  id: string;
  name: string;
  title: string;
  details: string;
  status: TaskStatus;
  importance: TaskImportance;
  dueDaysOffset: number;
  remindDaysOffset: number | null;
  isRecurring: boolean;
  recurrenceRule: RecurrenceRuleValue;
  links: string[];
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskTemplatePayload = {
  name: string;
  title: string;
  details: string;
  status: TaskStatus;
  importance: TaskImportance;
  dueDaysOffset: number;
  remindDaysOffset: number | null;
  isRecurring: boolean;
  recurrenceRule: RecurrenceRuleValue;
  links: string[];
};

export type TaskPlaybookItem = {
  id: string;
  sortOrder: number;
  title: string;
  details: string;
  status: TaskStatus;
  importance: TaskImportance;
  dueDaysOffset: number;
  remindDaysOffset: number | null;
  isRecurring: boolean;
  recurrenceRule: RecurrenceRuleValue;
  links: string[];
};

export type TaskPlaybook = {
  id: string;
  name: string;
  description: string;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  items: TaskPlaybookItem[];
};

export type TaskPlaybookPayload = {
  name: string;
  description: string;
  items: Array<{
    title: string;
    details: string;
    status: TaskStatus;
    importance: TaskImportance;
    dueDaysOffset: number;
    remindDaysOffset: number | null;
    isRecurring: boolean;
    recurrenceRule: RecurrenceRuleValue;
    links: string[];
  }>;
};

export type OneOnOneAgendaItem = {
  id: string;
  body: string;
  isPrivate: boolean;
  sortOrder: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OneOnOneMeeting = {
  id: string;
  scheduledFor: string;
  status: OneOnOneMeetingStatus;
  sharedNotes: string;
  privateNotes: string;
  priorActionItems: string[];
  nextActionItems: string[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DirectReport = {
  id: string;
  reportName: string;
  reportEmail: string | null;
  role: string;
  cadence: OneOnOneCadence;
  nextMeetingAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  standingItems: OneOnOneAgendaItem[];
  meetings: OneOnOneMeeting[];
};

export type CreateDirectReportPayload = {
  reportName: string;
  reportEmail: string | null;
  role: string;
  cadence: OneOnOneCadence;
  nextMeetingAt: string | null;
  notes: string;
};

export type UpdateDirectReportPayload = {
  reportName: string;
  reportEmail: string | null;
  role: string;
  cadence: OneOnOneCadence;
  nextMeetingAt: string | null;
  notes: string;
};

export type CreateOneOnOneAgendaItemPayload = {
  body: string;
  isPrivate: boolean;
};

export type UpdateOneOnOneAgendaItemPayload = {
  body: string;
  isPrivate: boolean;
  completed: boolean;
};

export type CreateOneOnOneMeetingPayload = {
  scheduledFor: string;
};

export type CompleteOneOnOneMeetingPayload = {
  scheduledFor: string;
  meetingDetails: string;
  nextActionItems: string[];
};

export type UpdateOneOnOneMeetingPayload = {
  scheduledFor: string;
  status: OneOnOneMeetingStatus;
  sharedNotes: string;
  privateNotes: string;
};

export type WorkspaceMember = {
  id: string;
  name: string;
  email: string;
  role: WorkspaceRole;
};

export type TaskComment = {
  id: string;
  taskId: string;
  body: string;
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskActivity = {
  id: string;
  taskId: string;
  type: string;
  message: string;
  actorUserId: string | null;
  actorName: string | null;
  createdAt: string;
};

export type TaskDetail = {
  task: Task;
  comments: TaskComment[];
  activities: TaskActivity[];
};

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  workspaceId: string;
  workspaceName: string | null;
  taskId: string | null;
  actorUserId: string | null;
  actorName: string | null;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
};

export type AuthSession = {
  user: {
    id: string;
    name: string;
    email: string;
    isGodMode: boolean;
  };
  workspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
  permissions: AppPermissions;
};

export const GOD_WORKSPACE_ID = "__all_workspaces__";
export const GOD_USER_EMAIL = "god@timesmith.dev";
export const GOD_USER_PASSWORD = "timesmith-god";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceInvite = {
  id: string;
  email: string;
  role: WorkspaceInviteRole;
  status: WorkspaceInviteStatus;
  token: string;
  inviteUrl: string;
  workspaceId: string;
  workspaceName: string | null;
  invitedById: string | null;
  invitedByName: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceInviteLookup = {
  invite: WorkspaceInvite;
};

export type AdminAppConfig = {
  appBaseUrl: string;
  outlookClientId: string;
  outlookClientSecret: string;
  outlookTenantId: string;
  slackSigningSecret: string;
  slackDisableSignatureVerification: boolean;
  directReportNameOptions: string[];
  directReportRoleOptions: string[];
};

export type AdminWorkspace = {
  id: string;
  name: string;
  slug: string;
  inboundEmailKey: string;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
  memberCount: number;
  deactivatedAt: string | null;
  allowMemberTaskCreation: boolean;
  members: Array<{
    userId: string;
    name: string;
    email: string;
    role: WorkspaceRole;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  workspaceName: string;
};

export type AdminUserPayload = {
  name: string;
  email: string;
  password?: string;
  role: WorkspaceRole;
};

export type CreateWorkspaceInvitePayload = {
  email: string;
  role: WorkspaceInviteRole;
};

export type CreateWorkspacePayload = {
  workspaceName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
};

export type UpdateWorkspacePayload = {
  name: string;
  ownerUserId: string;
  allowMemberTaskCreation: boolean;
};

export type UpdateWorkspaceStatusPayload = {
  isActive: boolean;
};

export type UpdateAppConfigPayload = AdminAppConfig;

export type AcceptWorkspaceInvitePayload = {
  token: string;
  name: string;
  email: string;
  password: string;
};

export type TaskPayload = {
  title: string;
  details: string;
  dueDate: string;
  remindAt: string | null;
  status: TaskStatus;
  importance: TaskImportance;
  assigneeId: string | null;
  links: string[];
  isRecurring: boolean;
  recurrenceRule: RecurrenceRuleValue;
};

export type CreateCommentPayload = {
  body: string;
};

export type RunTaskPlaybookResponse = {
  tasks: Task[];
};

export type SwitchWorkspacePayload = {
  workspaceId: string;
};

export type GenerateAgendaPayload = {
  date?: string;
};

export type MarkNotificationReadResponse = Notification;

export type ResetPasswordResponse = {
  temporaryPassword: string;
};
