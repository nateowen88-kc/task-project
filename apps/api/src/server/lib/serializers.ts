import {
  CaptureSourceType,
  CaptureStatus,
  Prisma,
  RecurrenceRule,
  TaskStatus,
  WorkspaceInviteRole,
  WorkspaceRole,
} from "@prisma/client";
import { formatDate, formatDateTime } from "./dates.js";

export type StatusValue = "blocked" | "todo" | "in-progress" | "done";
export type RecurrenceValue = "none" | "daily" | "weekdays" | "weekly" | "monthly";
export type TodaySourceType = "task" | "occurrence";
export type CaptureSourceValue = "slack" | "email";
export type CaptureStatusValue = "new" | "accepted" | "discarded";
export type WorkspaceRoleValue = "owner" | "admin" | "user";
export type WorkspaceInviteRoleValue = "admin" | "user";
export type WorkspaceInviteStatusValue = "pending" | "accepted" | "revoked" | "expired";
export type NotificationTypeValue = "task-assigned" | "comment-added" | "task-due" | "task-overdue";
export type NotificationTypeDb = "TASK_ASSIGNED" | "COMMENT_ADDED" | "TASK_DUE" | "TASK_OVERDUE";

export type ApiTask = {
  id: string;
  title: string;
  details: string;
  dueDate: string;
  remindAt: string | null;
  status: StatusValue;
  links: string[];
  isRecurring: boolean;
  recurrenceRule: RecurrenceValue;
  plannedForDate: string | null;
  archivedAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  importance: "low" | "medium" | "high";
  workspaceId: string;
  workspaceName: string | null;
  permissions: {
    canEdit: boolean;
    canChangeStatus: boolean;
    canComment: boolean;
    canArchive: boolean;
    canDelete: boolean;
    canReassign: boolean;
  };
};

export type ApiTodayItem = {
  id: string;
  taskId: string;
  sourceType: TodaySourceType;
  title: string;
  details: string;
  dueDate: string;
  scheduledFor: string;
  remindAt: string | null;
  status: StatusValue;
  links: string[];
  isRecurring: boolean;
  recurrenceRule: RecurrenceValue;
  plannedForDate: string | null;
  archivedAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  importance: "low" | "medium" | "high";
  workspaceId: string;
  workspaceName: string | null;
  agendaReason?: string;
  agendaConfidence?: number;
  permissions: {
    canEdit: boolean;
    canChangeStatus: boolean;
    canComment: boolean;
    canArchive: boolean;
    canDelete: boolean;
    canReassign: boolean;
  };
};

export type AgendaResponse = {
  date: string;
  promotedTaskCount: number;
  items: ApiTodayItem[];
};

export type ApiCapturedItem = {
  id: string;
  sourceType: CaptureSourceValue;
  status: CaptureStatusValue;
  workspaceId: string;
  workspaceName: string | null;
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

export type ApiWorkspace = {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRoleValue;
};

export type ApiAuthSession = {
  user: {
    id: string;
    name: string;
    email: string;
    isGodMode: boolean;
  };
  workspace: ApiWorkspace;
  workspaces: ApiWorkspace[];
  permissions: {
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
};

export type ApiAdminUser = {
  id: string;
  name: string;
  email: string;
  role: WorkspaceRoleValue;
  createdAt: string;
  updatedAt: string;
};

export type ApiTaskComment = {
  id: string;
  taskId: string;
  body: string;
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiTaskActivity = {
  id: string;
  taskId: string;
  type: string;
  message: string;
  actorUserId: string | null;
  actorName: string | null;
  createdAt: string;
};

export type ApiWorkspaceMember = {
  id: string;
  name: string;
  email: string;
  role: WorkspaceRoleValue;
};

export type ApiNotification = {
  id: string;
  type: NotificationTypeValue;
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

export type ApiWorkspaceInvite = {
  id: string;
  email: string;
  role: WorkspaceInviteRoleValue;
  status: WorkspaceInviteStatusValue;
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

export type ApiTaskTemplate = {
  id: string;
  name: string;
  title: string;
  details: string;
  status: StatusValue;
  importance: "low" | "medium" | "high";
  dueDaysOffset: number;
  remindDaysOffset: number | null;
  links: string[];
  isRecurring: boolean;
  recurrenceRule: RecurrenceValue;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiTaskPlaybookItem = {
  id: string;
  sortOrder: number;
  title: string;
  details: string;
  status: StatusValue;
  importance: "low" | "medium" | "high";
  dueDaysOffset: number;
  remindDaysOffset: number | null;
  links: string[];
  isRecurring: boolean;
  recurrenceRule: RecurrenceValue;
};

export type ApiTaskPlaybook = {
  id: string;
  name: string;
  description: string;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  items: ApiTaskPlaybookItem[];
};

export type TaskRecord = Prisma.TaskGetPayload<{
  include: {
    workspace: true;
    links: true;
    assignee: {
      select: {
        name: true;
      };
    };
  };
}>;

export type OccurrenceRecord = Prisma.TaskOccurrenceGetPayload<{
  include: {
    task: {
      include: {
        workspace: true;
        links: true;
        assignee: {
          select: {
            name: true;
          };
        };
      };
    };
  };
}>;

export type TaskTemplateRecord = Prisma.TaskTemplateGetPayload<object>;

export type TaskPlaybookRecord = Prisma.TaskPlaybookGetPayload<{
  include: {
    items: true;
  };
}>;

export const reverseStatusMap: Record<TaskStatus, StatusValue> = {
  BLOCKED: "blocked",
  TODO: "todo",
  IN_PROGRESS: "in-progress",
  DONE: "done",
};

export const reverseImportanceMap = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export const reverseRecurrenceMap: Record<RecurrenceRule, Exclude<RecurrenceValue, "none">> = {
  DAILY: "daily",
  WEEKDAYS: "weekdays",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
};

export const reverseCaptureSourceMap: Record<CaptureSourceType, CaptureSourceValue> = {
  SLACK: "slack",
  EMAIL: "email",
};

export const reverseCaptureStatusMap: Record<CaptureStatus, CaptureStatusValue> = {
  NEW: "new",
  ACCEPTED: "accepted",
  DISCARDED: "discarded",
};

export const reverseWorkspaceRoleMap: Record<WorkspaceRole, WorkspaceRoleValue> = {
  OWNER: "owner",
  ADMIN: "admin",
  USER: "user",
};

export const reverseWorkspaceInviteRoleMap: Record<WorkspaceInviteRole, WorkspaceInviteRoleValue> = {
  ADMIN: "admin",
  USER: "user",
};

export const reverseNotificationTypeMap: Record<NotificationTypeDb, NotificationTypeValue> = {
  TASK_ASSIGNED: "task-assigned",
  COMMENT_ADDED: "comment-added",
  TASK_DUE: "task-due",
  TASK_OVERDUE: "task-overdue",
};

export function toApiTask(
  task: TaskRecord,
  permissions: ApiTask["permissions"],
): ApiTask {
  return {
    id: task.id,
    title: task.title,
    details: task.details,
    dueDate: formatDate(task.dueDate),
    remindAt: formatDateTime(task.remindAt),
    status: reverseStatusMap[task.status],
    importance: reverseImportanceMap[task.importance],
    workspaceId: task.workspaceId,
    workspaceName: task.workspace?.name ?? null,
    links: task.links.map((link) => link.url),
    isRecurring: task.isRecurring,
    recurrenceRule: task.recurrenceRule ? reverseRecurrenceMap[task.recurrenceRule] : "none",
    plannedForDate: task.plannedForDate ? formatDate(task.plannedForDate) : null,
    archivedAt: task.archivedAt ? task.archivedAt.toISOString() : null,
    assigneeId: task.assigneeId,
    createdById: task.createdById,
    assigneeName: task.assignee?.name ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    permissions,
  };
}

export function toApiTodayTask(
  task: TaskRecord,
  permissions: ApiTodayItem["permissions"],
  aiMetadata?: { reason: string; confidence: number },
): ApiTodayItem {
  return {
    id: task.id,
    taskId: task.id,
    sourceType: "task",
    title: task.title,
    details: task.details,
    dueDate: formatDate(task.dueDate),
    scheduledFor: task.plannedForDate ? formatDate(task.plannedForDate) : formatDate(task.dueDate),
    remindAt: formatDateTime(task.remindAt),
    status: reverseStatusMap[task.status],
    importance: reverseImportanceMap[task.importance],
    workspaceId: task.workspaceId,
    workspaceName: task.workspace?.name ?? null,
    agendaReason: aiMetadata?.reason,
    agendaConfidence: aiMetadata?.confidence,
    links: task.links.map((link) => link.url),
    isRecurring: task.isRecurring,
    recurrenceRule: task.recurrenceRule ? reverseRecurrenceMap[task.recurrenceRule] : "none",
    plannedForDate: task.plannedForDate ? formatDate(task.plannedForDate) : null,
    archivedAt: task.archivedAt ? task.archivedAt.toISOString() : null,
    assigneeId: task.assigneeId,
    createdById: task.createdById,
    assigneeName: task.assignee?.name ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    permissions,
  };
}

export function toApiTaskTemplate(template: TaskTemplateRecord): ApiTaskTemplate {
  return {
    id: template.id,
    name: template.name,
    title: template.title,
    details: template.details,
    status: reverseStatusMap[template.status],
    importance: reverseImportanceMap[template.importance],
    dueDaysOffset: template.dueDaysOffset,
    remindDaysOffset: template.remindDaysOffset,
    links: template.links,
    isRecurring: template.isRecurring,
    recurrenceRule: template.recurrenceRule ? reverseRecurrenceMap[template.recurrenceRule] : "none",
    createdById: template.createdById,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

export function toApiTaskPlaybook(playbook: TaskPlaybookRecord): ApiTaskPlaybook {
  return {
    id: playbook.id,
    name: playbook.name,
    description: playbook.description,
    createdById: playbook.createdById,
    createdAt: playbook.createdAt.toISOString(),
    updatedAt: playbook.updatedAt.toISOString(),
    items: playbook.items
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((item) => ({
        id: item.id,
        sortOrder: item.sortOrder,
        title: item.title,
        details: item.details,
        status: reverseStatusMap[item.status],
        importance: reverseImportanceMap[item.importance],
        dueDaysOffset: item.dueDaysOffset,
        remindDaysOffset: item.remindDaysOffset,
        links: item.links,
        isRecurring: item.isRecurring,
        recurrenceRule: item.recurrenceRule ? reverseRecurrenceMap[item.recurrenceRule] : "none",
      })),
  };
}

export function toApiTodayOccurrence(
  occurrence: OccurrenceRecord,
  permissions: ApiTodayItem["permissions"],
): ApiTodayItem {
  return {
    id: occurrence.id,
    taskId: occurrence.taskId,
    sourceType: "occurrence",
    title: occurrence.task.title,
    details: occurrence.task.details,
    dueDate: formatDate(occurrence.dueDate),
    scheduledFor: formatDate(occurrence.scheduledFor),
    remindAt: formatDateTime(occurrence.task.remindAt),
    status: reverseStatusMap[occurrence.status],
    importance: reverseImportanceMap[occurrence.task.importance],
    workspaceId: occurrence.task.workspaceId,
    workspaceName: occurrence.task.workspace?.name ?? null,
    links: occurrence.task.links.map((link) => link.url),
    isRecurring: true,
    recurrenceRule: occurrence.task.recurrenceRule
      ? reverseRecurrenceMap[occurrence.task.recurrenceRule]
      : "none",
    plannedForDate: null,
    archivedAt: occurrence.task.archivedAt ? occurrence.task.archivedAt.toISOString() : null,
    assigneeId: occurrence.task.assigneeId,
    createdById: occurrence.task.createdById,
    assigneeName: occurrence.task.assignee?.name ?? null,
    createdAt: occurrence.createdAt.toISOString(),
    updatedAt: occurrence.updatedAt.toISOString(),
    permissions,
  };
}

export function toApiCapturedItem(
  item: Prisma.CapturedItemGetPayload<{
    include: {
      workspace: true;
    };
  }>,
): ApiCapturedItem {
  return {
    id: item.id,
    sourceType: reverseCaptureSourceMap[item.sourceType],
    status: reverseCaptureStatusMap[item.status],
    workspaceId: item.workspaceId,
    workspaceName: item.workspace?.name ?? null,
    externalId: item.externalId,
    title: item.title,
    body: item.body,
    sourceLabel: item.sourceLabel,
    sourceUrl: item.sourceUrl,
    sender: item.sender,
    suggestedDueDate: item.suggestedDueDate ? formatDate(item.suggestedDueDate) : null,
    receivedAt: item.receivedAt.toISOString(),
    acceptedAt: item.acceptedAt ? item.acceptedAt.toISOString() : null,
    discardedAt: item.discardedAt ? item.discardedAt.toISOString() : null,
    taskId: item.taskId,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function toApiAdminUser(
  membership: Prisma.WorkspaceMemberGetPayload<{
    include: {
      user: true;
    };
  }>,
): ApiAdminUser {
  return {
    id: membership.user.id,
    name: membership.user.name,
    email: membership.user.email,
    role: reverseWorkspaceRoleMap[membership.role],
    createdAt: membership.user.createdAt.toISOString(),
    updatedAt: membership.user.updatedAt.toISOString(),
  };
}

export function toApiWorkspaceMember(
  member: Prisma.WorkspaceMemberGetPayload<{
    include: {
      user: true;
    };
  }>,
): ApiWorkspaceMember {
  return {
    id: member.user.id,
    name: member.user.name,
    email: member.user.email,
    role: reverseWorkspaceRoleMap[member.role],
  };
}

export function toApiNotification(
  notification: {
    id: string;
    type: NotificationTypeDb;
    title: string;
    body: string;
    readAt: Date | null;
    createdAt: Date;
    workspaceId: string;
    taskId: string | null;
    actorUserId: string | null;
    workspace?: { name: string | null } | null;
    actor?: { name: string | null } | null;
  },
): ApiNotification {
  return {
    id: notification.id,
    type: reverseNotificationTypeMap[notification.type],
    title: notification.title,
    body: notification.body,
    readAt: notification.readAt ? notification.readAt.toISOString() : null,
    createdAt: notification.createdAt.toISOString(),
    workspaceId: notification.workspaceId,
    workspaceName: notification.workspace?.name ?? null,
    taskId: notification.taskId,
    actorUserId: notification.actorUserId,
    actorName: notification.actor?.name ?? null,
  };
}

export function toApiWorkspaceInvite(
  invite: Prisma.WorkspaceInviteGetPayload<{
    include: {
      workspace: true;
      invitedBy: {
        select: {
          name: true;
        };
      };
    };
  }>,
  inviteBaseUrl: string,
): ApiWorkspaceInvite {
  let status: WorkspaceInviteStatusValue = "pending";

  if (invite.revokedAt) {
    status = "revoked";
  } else if (invite.acceptedAt) {
    status = "accepted";
  } else if (invite.expiresAt <= new Date()) {
    status = "expired";
  }

  return {
    id: invite.id,
    email: invite.email,
    role: reverseWorkspaceInviteRoleMap[invite.role],
    status,
    token: invite.token,
    inviteUrl: `${inviteBaseUrl.replace(/\/$/, "")}/?invite=${encodeURIComponent(invite.token)}`,
    workspaceId: invite.workspaceId,
    workspaceName: invite.workspace?.name ?? null,
    invitedById: invite.invitedById,
    invitedByName: invite.invitedBy?.name ?? null,
    expiresAt: invite.expiresAt.toISOString(),
    acceptedAt: invite.acceptedAt ? invite.acceptedAt.toISOString() : null,
    revokedAt: invite.revokedAt ? invite.revokedAt.toISOString() : null,
    createdAt: invite.createdAt.toISOString(),
    updatedAt: invite.updatedAt.toISOString(),
  };
}

export function toApiTaskComment(
  comment: Prisma.TaskCommentGetPayload<{
    include: {
      author: {
        select: {
          name: true;
        };
      };
    };
  }>,
): ApiTaskComment {
  return {
    id: comment.id,
    taskId: comment.taskId,
    body: comment.body,
    authorId: comment.authorId,
    authorName: comment.author?.name ?? null,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

export function toApiTaskActivity(
  activity: Prisma.TaskActivityGetPayload<{
    include: {
      actor: {
        select: {
          name: true;
        };
      };
    };
  }>,
): ApiTaskActivity {
  return {
    id: activity.id,
    taskId: activity.taskId,
    type: activity.type.toLowerCase(),
    message: activity.message,
    actorUserId: activity.actorUserId,
    actorName: activity.actor?.name ?? null,
    createdAt: activity.createdAt.toISOString(),
  };
}
