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

export type AppPermissions = {
  canManageUsers: boolean;
  canCreateUsers: boolean;
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

export type SwitchWorkspacePayload = {
  workspaceId: string;
};

export type GenerateAgendaPayload = {
  date?: string;
};

export type MarkNotificationReadResponse = Notification;

export type ResetPasswordResponse = {
  password: string;
};
