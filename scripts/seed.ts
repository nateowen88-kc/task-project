import "dotenv/config";
import crypto from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  CaptureSourceType,
  CaptureStatus,
  NotificationType,
  PrismaClient,
  RecurrenceRule,
  TaskActivityType,
  TaskImportance,
  TaskStatus,
  WorkspaceRole,
} from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Missing DATABASE_URL in environment.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL = "admin@timesmith.test";
const ADMIN_PASSWORD = "TimeSmithAdmin123!";
const SAMPLE_USER_EMAIL = "user@timesmith.test";
const SAMPLE_USER_PASSWORD = "TimeSmithUser123!";
const WORKSPACE_SLUG = "timesmith-local";

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function ensureUser(params: {
  email: string;
  name: string;
  password: string;
  isGodMode?: boolean;
}) {
  const existing = await prisma.user.findUnique({
    where: { email: params.email },
  });

  const passwordHash = hashPassword(params.password);

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name: params.name,
        passwordHash,
        isGodMode: params.isGodMode ?? existing.isGodMode,
      },
    });
  }

  return prisma.user.create({
    data: {
      email: params.email,
      name: params.name,
      passwordHash,
      isGodMode: params.isGodMode ?? false,
    },
  });
}

async function ensureTask(params: {
  workspaceId: string;
  createdById: string;
  assigneeId?: string;
  title: string;
  details: string;
  dueDate: Date;
  remindAt?: Date;
  status: TaskStatus;
  importance: TaskImportance;
  sortOrder: number;
  isRecurring?: boolean;
  recurrenceRule?: RecurrenceRule;
  plannedForDate?: Date;
  blockedReason?: string;
  links?: Array<{ url: string; label?: string }>;
}) {
  const existing = await prisma.task.findFirst({
    where: {
      workspaceId: params.workspaceId,
      title: params.title,
    },
    include: {
      links: true,
    },
  });

  if (existing) {
    const task = await prisma.task.update({
      where: { id: existing.id },
      data: {
        createdById: params.createdById,
        assigneeId: params.assigneeId ?? null,
        details: params.details,
        dueDate: params.dueDate,
        remindAt: params.remindAt ?? null,
        status: params.status,
        importance: params.importance,
        sortOrder: params.sortOrder,
        isRecurring: params.isRecurring ?? false,
        recurrenceRule: params.recurrenceRule ?? null,
        plannedForDate: params.plannedForDate ?? null,
        blockedReason: params.blockedReason ?? null,
        archivedAt: null,
      },
    });

    await prisma.taskLink.deleteMany({ where: { taskId: task.id } });

    if (params.links?.length) {
      await prisma.taskLink.createMany({
        data: params.links.map((link, index) => ({
          taskId: task.id,
          url: link.url,
          label: link.label,
          sortOrder: index,
        })),
      });
    }

    return task;
  }

  return prisma.task.create({
    data: {
      workspaceId: params.workspaceId,
      createdById: params.createdById,
      assigneeId: params.assigneeId,
      title: params.title,
      details: params.details,
      dueDate: params.dueDate,
      remindAt: params.remindAt,
      status: params.status,
      importance: params.importance,
      sortOrder: params.sortOrder,
      isRecurring: params.isRecurring ?? false,
      recurrenceRule: params.recurrenceRule,
      plannedForDate: params.plannedForDate,
      blockedReason: params.blockedReason,
      links: params.links?.length
        ? {
            create: params.links.map((link, index) => ({
              url: link.url,
              label: link.label,
              sortOrder: index,
            })),
          }
        : undefined,
    },
  });
}

async function ensureCapturedItem(params: {
  workspaceId: string;
  sourceType: CaptureSourceType;
  externalId: string;
  title: string;
  body: string;
  sourceLabel: string;
  sourceUrl?: string;
  sender: string;
  suggestedDueDate?: Date;
}) {
  const existing = await prisma.capturedItem.findUnique({
    where: {
      sourceType_externalId: {
        sourceType: params.sourceType,
        externalId: params.externalId,
      },
    },
  });

  if (existing) {
    return prisma.capturedItem.update({
      where: { id: existing.id },
      data: {
        workspaceId: params.workspaceId,
        status: CaptureStatus.NEW,
        title: params.title,
        body: params.body,
        sourceLabel: params.sourceLabel,
        sourceUrl: params.sourceUrl,
        sender: params.sender,
        suggestedDueDate: params.suggestedDueDate,
        receivedAt: new Date(),
        acceptedAt: null,
        discardedAt: null,
        taskId: null,
      },
    });
  }

  return prisma.capturedItem.create({
    data: {
      workspaceId: params.workspaceId,
      sourceType: params.sourceType,
      status: CaptureStatus.NEW,
      externalId: params.externalId,
      title: params.title,
      body: params.body,
      sourceLabel: params.sourceLabel,
      sourceUrl: params.sourceUrl,
      sender: params.sender,
      suggestedDueDate: params.suggestedDueDate,
      receivedAt: new Date(),
    },
  });
}

async function ensureCommentAndActivity(params: {
  workspaceId: string;
  taskId: string;
  authorId: string;
  body: string;
}) {
  const existingComment = await prisma.taskComment.findFirst({
    where: {
      taskId: params.taskId,
      body: params.body,
    },
  });

  if (!existingComment) {
    await prisma.taskComment.create({
      data: {
        workspaceId: params.workspaceId,
        taskId: params.taskId,
        authorId: params.authorId,
        body: params.body,
      },
    });
  }

  const existingActivity = await prisma.taskActivity.findFirst({
    where: {
      taskId: params.taskId,
      type: TaskActivityType.COMMENT_ADDED,
      message: params.body,
    },
  });

  if (!existingActivity) {
    await prisma.taskActivity.create({
      data: {
        workspaceId: params.workspaceId,
        taskId: params.taskId,
        actorUserId: params.authorId,
        type: TaskActivityType.COMMENT_ADDED,
        message: params.body,
      },
    });
  }
}

async function ensureNotification(params: {
  workspaceId: string;
  userId: string;
  actorUserId?: string;
  taskId?: string;
  type: NotificationType;
  title: string;
  body: string;
  dedupeKey: string;
}) {
  const existing = await prisma.notification.findUnique({
    where: { dedupeKey: params.dedupeKey },
  });

  if (existing) {
    return prisma.notification.update({
      where: { id: existing.id },
      data: {
        workspaceId: params.workspaceId,
        userId: params.userId,
        actorUserId: params.actorUserId ?? null,
        taskId: params.taskId ?? null,
        type: params.type,
        title: params.title,
        body: params.body,
        readAt: null,
      },
    });
  }

  return prisma.notification.create({
    data: {
      workspaceId: params.workspaceId,
      userId: params.userId,
      actorUserId: params.actorUserId,
      taskId: params.taskId,
      type: params.type,
      title: params.title,
      body: params.body,
      dedupeKey: params.dedupeKey,
    },
  });
}

async function main() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  const laterToday = new Date(today);
  laterToday.setHours(16, 0, 0, 0);

  const admin = await ensureUser({
    email: ADMIN_EMAIL,
    name: "TimeSmith Admin",
    password: ADMIN_PASSWORD,
    isGodMode: true,
  });

  const sampleUser = await ensureUser({
    email: SAMPLE_USER_EMAIL,
    name: "Sample User",
    password: SAMPLE_USER_PASSWORD,
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: {
      name: "TimeSmith Local Workspace",
      ownerId: admin.id,
    },
    create: {
      name: "TimeSmith Local Workspace",
      slug: WORKSPACE_SLUG,
      ownerId: admin.id,
    },
  });

  await prisma.user.update({
    where: { id: admin.id },
    data: { defaultWorkspaceId: workspace.id },
  });

  await prisma.user.update({
    where: { id: sampleUser.id },
    data: { defaultWorkspaceId: workspace.id },
  });

  await prisma.workspaceMember.upsert({
    where: {
      userId_workspaceId: {
        userId: admin.id,
        workspaceId: workspace.id,
      },
    },
    update: { role: WorkspaceRole.OWNER },
    create: {
      userId: admin.id,
      workspaceId: workspace.id,
      role: WorkspaceRole.OWNER,
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      userId_workspaceId: {
        userId: sampleUser.id,
        workspaceId: workspace.id,
      },
    },
    update: { role: WorkspaceRole.USER },
    create: {
      userId: sampleUser.id,
      workspaceId: workspace.id,
      role: WorkspaceRole.USER,
    },
  });

  const todayTask = await ensureTask({
    workspaceId: workspace.id,
    createdById: admin.id,
    assigneeId: sampleUser.id,
    title: "Confirm launch checklist",
    details: "Run through the daily launch checklist and confirm the blockers are still accurate.",
    dueDate: laterToday,
    remindAt: new Date(today.getTime() + 13 * 60 * 60 * 1000),
    status: TaskStatus.IN_PROGRESS,
    importance: TaskImportance.HIGH,
    sortOrder: 10,
    plannedForDate: today,
    links: [{ url: "https://timesmith.test", label: "Local app" }],
  });

  const blockedTask = await ensureTask({
    workspaceId: workspace.id,
    createdById: admin.id,
    assigneeId: admin.id,
    title: "Finalize billing integration",
    details: "Finish the billing integration once the sandbox account credentials are available.",
    dueDate: tomorrow,
    status: TaskStatus.BLOCKED,
    importance: TaskImportance.HIGH,
    sortOrder: 20,
    blockedReason: "Waiting on sandbox API credentials from finance.",
  });

  const recurringTask = await ensureTask({
    workspaceId: workspace.id,
    createdById: admin.id,
    assigneeId: sampleUser.id,
    title: "Review inbound captures",
    details: "Clear the capture inbox and convert useful items into tasks.",
    dueDate: nextWeek,
    status: TaskStatus.TODO,
    importance: TaskImportance.MEDIUM,
    sortOrder: 30,
    isRecurring: true,
    recurrenceRule: RecurrenceRule.WEEKDAYS,
    plannedForDate: today,
  });

  await prisma.taskOccurrence.upsert({
    where: {
      taskId_scheduledFor: {
        taskId: recurringTask.id,
        scheduledFor: today,
      },
    },
    update: {
      workspaceId: workspace.id,
      dueDate: laterToday,
      status: TaskStatus.TODO,
      skippedAt: null,
      completedAt: null,
    },
    create: {
      workspaceId: workspace.id,
      taskId: recurringTask.id,
      scheduledFor: today,
      dueDate: laterToday,
      status: TaskStatus.TODO,
    },
  });

  await ensureCommentAndActivity({
    workspaceId: workspace.id,
    taskId: todayTask.id,
    authorId: admin.id,
    body: "Keep this focused on the top two blockers for today.",
  });

  await ensureCapturedItem({
    workspaceId: workspace.id,
    sourceType: CaptureSourceType.SLACK,
    externalId: "seed-slack-1",
    title: "Follow up on customer migration request",
    body: "Customer success flagged a migration request that likely needs engineering follow-up this week.",
    sourceLabel: "#customer-success",
    sourceUrl: "https://slack.com/app_redirect?channel=customer-success",
    sender: "ops-bot",
    suggestedDueDate: tomorrow,
  });

  await ensureCapturedItem({
    workspaceId: workspace.id,
    sourceType: CaptureSourceType.EMAIL,
    externalId: "seed-email-1",
    title: "Vendor renewal needs approval",
    body: "Finance sent over the renewal details and needs a decision before Friday.",
    sourceLabel: "finance@vendor.test",
    sender: "finance@vendor.test",
    suggestedDueDate: nextWeek,
  });

  await ensureNotification({
    workspaceId: workspace.id,
    userId: sampleUser.id,
    actorUserId: admin.id,
    taskId: todayTask.id,
    type: NotificationType.TASK_ASSIGNED,
    title: "Task assigned",
    body: "Confirm launch checklist is assigned to you.",
    dedupeKey: "seed-task-assigned-sample-user",
  });

  await ensureNotification({
    workspaceId: workspace.id,
    userId: admin.id,
    actorUserId: sampleUser.id,
    taskId: blockedTask.id,
    type: NotificationType.TASK_OVERDUE,
    title: "Blocked task needs attention",
    body: "Finalize billing integration is still blocked.",
    dedupeKey: "seed-blocked-task-admin",
  });

  console.log("Seed complete.");
  console.log(`Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`Sample user: ${SAMPLE_USER_EMAIL} / ${SAMPLE_USER_PASSWORD}`);
  console.log(`Workspace: ${workspace.name}`);
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
