import "dotenv/config";
import cors from "cors";
import crypto from "node:crypto";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { CaptureSourceType, CaptureStatus, Prisma, PrismaClient, RecurrenceRule, TaskStatus } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackDisableSignatureVerification = process.env.SLACK_DISABLE_SIGNATURE_VERIFICATION === "true";
const emailInboundToken = process.env.EMAIL_INBOUND_TOKEN;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to start the API server.");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });

const prisma = new PrismaClient({
  adapter,
});

const app = express();
const port = Number(process.env.PORT ?? 3001);
const isProduction = process.env.NODE_ENV === "production";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, "../dist");

type StatusValue = "blocked" | "todo" | "in-progress" | "done";
type RecurrenceValue = "none" | "daily" | "weekdays" | "weekly" | "monthly";
type TodaySourceType = "task" | "occurrence";
type CaptureSourceValue = "slack" | "email";
type CaptureStatusValue = "new" | "accepted" | "discarded";

type ApiTask = {
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
  createdAt: string;
  updatedAt: string;
};

type ApiTodayItem = {
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
  createdAt: string;
  updatedAt: string;
};

type AgendaResponse = {
  date: string;
  promotedTaskCount: number;
  items: ApiTodayItem[];
};

type ApiCapturedItem = {
  id: string;
  sourceType: CaptureSourceValue;
  status: CaptureStatusValue;
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

type TaskRecord = Prisma.TaskGetPayload<{
  include: {
    links: true;
  };
}>;

type OccurrenceRecord = Prisma.TaskOccurrenceGetPayload<{
  include: {
    task: {
      include: {
        links: true;
      };
    };
  };
}>;

type TaskInput = {
  title: string;
  details?: string;
  dueDate: string;
  remindAt?: string | null;
  status: StatusValue;
  links?: string[];
  isRecurring?: boolean;
  recurrenceRule?: RecurrenceValue;
};

type CaptureInput = {
  sourceType: CaptureSourceValue;
  title: string;
  body?: string;
  externalId?: string | null;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  sender?: string | null;
  suggestedDueDate?: string | null;
  receivedAt?: string | null;
};

type EmailInboundInput = {
  token?: string | null;
  subject: string;
  text?: string;
  html?: string;
  from?: string | null;
  to?: string | null;
  messageId?: string | null;
  receivedAt?: string | null;
  sourceUrl?: string | null;
};

type SlackInteractionPayload = {
  type: string;
  callback_id?: string;
  trigger_id?: string;
  team?: { id?: string; domain?: string };
  channel?: { id?: string; name?: string };
  message?: { text?: string; ts?: string; user?: string; bot_id?: string };
  user?: { id?: string; username?: string; name?: string };
};

const statusMap: Record<StatusValue, TaskStatus> = {
  blocked: TaskStatus.BLOCKED,
  todo: TaskStatus.TODO,
  "in-progress": TaskStatus.IN_PROGRESS,
  done: TaskStatus.DONE,
};

const reverseStatusMap: Record<TaskStatus, StatusValue> = {
  BLOCKED: "blocked",
  TODO: "todo",
  IN_PROGRESS: "in-progress",
  DONE: "done",
};

const recurrenceMap: Record<Exclude<RecurrenceValue, "none">, RecurrenceRule> = {
  daily: RecurrenceRule.DAILY,
  weekdays: RecurrenceRule.WEEKDAYS,
  weekly: RecurrenceRule.WEEKLY,
  monthly: RecurrenceRule.MONTHLY,
};

const reverseRecurrenceMap: Record<RecurrenceRule, Exclude<RecurrenceValue, "none">> = {
  DAILY: "daily",
  WEEKDAYS: "weekdays",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
};

const captureSourceMap: Record<CaptureSourceValue, CaptureSourceType> = {
  slack: CaptureSourceType.SLACK,
  email: CaptureSourceType.EMAIL,
};

const reverseCaptureSourceMap: Record<CaptureSourceType, CaptureSourceValue> = {
  SLACK: "slack",
  EMAIL: "email",
};

const reverseCaptureStatusMap: Record<CaptureStatus, CaptureStatusValue> = {
  NEW: "new",
  ACCEPTED: "accepted",
  DISCARDED: "discarded",
};

const slackFormMiddleware = express.urlencoded({
  extended: false,
  verify: (request, _response, buffer) => {
    (request as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
  },
});

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDateTime(value: Date | null) {
  return value ? value.toISOString().slice(0, 16) : null;
}

function toDateOnly(value: string) {
  return new Date(`${value}T12:00:00.000Z`);
}

function toDateTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return new Date(value);
}

function getDayBounds(target: Date) {
  const day = formatDate(target);
  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(`${day}T23:59:59.999Z`);
  return { start, end };
}

function addDays(target: Date, days: number) {
  const copy = new Date(target);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function daysBetween(left: Date, right: Date) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((getDayBounds(right).start.getTime() - getDayBounds(left).start.getTime()) / millisecondsPerDay);
}

function normalizeLinks(links: string[] | undefined) {
  return (links ?? []).map((url) => url.trim()).filter(Boolean);
}

function normalizeRecurrence(isRecurring: boolean | undefined, recurrenceRule: RecurrenceValue | undefined) {
  if (!isRecurring || !recurrenceRule || recurrenceRule === "none") {
    return null;
  }

  return recurrenceMap[recurrenceRule];
}

function normalizeCaptureLinks(item: { sourceUrl?: string | null }) {
  return [item.sourceUrl].filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim());
}

function getSlackDeepLink(teamId: string | undefined, channelId: string | undefined, messageTs: string | undefined) {
  if (!teamId || !channelId || !messageTs) {
    return null;
  }

  return `https://app.slack.com/client/${teamId}/${channelId}/thread/${channelId}-${messageTs.replace(".", "")}`;
}

function verifySlackSignature(request: express.Request, rawBody: Buffer) {
  if (slackDisableSignatureVerification) {
    return true;
  }

  if (!slackSigningSecret) {
    return false;
  }

  const timestamp = request.header("x-slack-request-timestamp");
  const signature = request.header("x-slack-signature");

  if (!timestamp || !signature) {
    return false;
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (Number.isNaN(age) || age > 60 * 5) {
    return false;
  }

  const baseString = `v0:${timestamp}:${rawBody.toString("utf8")}`;
  const digest = `v0=${crypto.createHmac("sha256", slackSigningSecret).update(baseString).digest("hex")}`;

  const expected = Buffer.from(digest, "utf8");
  const received = Buffer.from(signature, "utf8");

  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, received);
}

function parseSlackFormPayload(rawBody: Buffer) {
  const params = new URLSearchParams(rawBody.toString("utf8"));
  return {
    payload: params.get("payload"),
    text: params.get("text"),
    channelId: params.get("channel_id"),
    channelName: params.get("channel_name"),
    userId: params.get("user_id"),
    userName: params.get("user_name"),
    teamId: params.get("team_id"),
    teamDomain: params.get("team_domain"),
    triggerId: params.get("trigger_id"),
  };
}

async function upsertSlackCapturedItem(input: {
  title: string;
  body: string;
  externalId: string;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  sender?: string | null;
}) {
  const item = await prisma.capturedItem.upsert({
    where: {
      sourceType_externalId: {
        sourceType: CaptureSourceType.SLACK,
        externalId: input.externalId,
      },
    },
    update: {
      status: CaptureStatus.NEW,
      title: input.title,
      body: input.body,
      sourceLabel: input.sourceLabel ?? null,
      sourceUrl: input.sourceUrl ?? null,
      sender: input.sender ?? null,
      discardedAt: null,
      acceptedAt: null,
      taskId: null,
      receivedAt: new Date(),
    },
    create: {
      sourceType: CaptureSourceType.SLACK,
      status: CaptureStatus.NEW,
      externalId: input.externalId,
      title: input.title,
      body: input.body,
      sourceLabel: input.sourceLabel ?? null,
      sourceUrl: input.sourceUrl ?? null,
      sender: input.sender ?? null,
      receivedAt: new Date(),
    },
  });

  return item;
}

async function upsertEmailCapturedItem(input: {
  title: string;
  body: string;
  externalId: string;
  sender?: string | null;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  receivedAt?: Date;
}) {
  const item = await prisma.capturedItem.upsert({
    where: {
      sourceType_externalId: {
        sourceType: CaptureSourceType.EMAIL,
        externalId: input.externalId,
      },
    },
    update: {
      status: CaptureStatus.NEW,
      title: input.title,
      body: input.body,
      sender: input.sender ?? null,
      sourceLabel: input.sourceLabel ?? null,
      sourceUrl: input.sourceUrl ?? null,
      discardedAt: null,
      acceptedAt: null,
      taskId: null,
      receivedAt: input.receivedAt ?? new Date(),
    },
    create: {
      sourceType: CaptureSourceType.EMAIL,
      status: CaptureStatus.NEW,
      externalId: input.externalId,
      title: input.title,
      body: input.body,
      sender: input.sender ?? null,
      sourceLabel: input.sourceLabel ?? null,
      sourceUrl: input.sourceUrl ?? null,
      receivedAt: input.receivedAt ?? new Date(),
    },
  });

  return item;
}

function toApiTask(task: TaskRecord): ApiTask {
  return {
    id: task.id,
    title: task.title,
    details: task.details,
    dueDate: formatDate(task.dueDate),
    remindAt: formatDateTime(task.remindAt),
    status: reverseStatusMap[task.status],
    links: task.links.map((link: TaskRecord["links"][number]) => link.url),
    isRecurring: task.isRecurring,
    recurrenceRule: task.recurrenceRule ? reverseRecurrenceMap[task.recurrenceRule] : "none",
    plannedForDate: task.plannedForDate ? formatDate(task.plannedForDate) : null,
    archivedAt: task.archivedAt ? task.archivedAt.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function toApiTodayTask(task: TaskRecord): ApiTodayItem {
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
    links: task.links.map((link: TaskRecord["links"][number]) => link.url),
    isRecurring: task.isRecurring,
    recurrenceRule: task.recurrenceRule ? reverseRecurrenceMap[task.recurrenceRule] : "none",
    plannedForDate: task.plannedForDate ? formatDate(task.plannedForDate) : null,
    archivedAt: task.archivedAt ? task.archivedAt.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function toApiTodayOccurrence(occurrence: OccurrenceRecord): ApiTodayItem {
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
    links: occurrence.task.links.map((link: OccurrenceRecord["task"]["links"][number]) => link.url),
    isRecurring: true,
    recurrenceRule: occurrence.task.recurrenceRule ? reverseRecurrenceMap[occurrence.task.recurrenceRule] : "none",
    plannedForDate: null,
    archivedAt: occurrence.task.archivedAt ? occurrence.task.archivedAt.toISOString() : null,
    createdAt: occurrence.createdAt.toISOString(),
    updatedAt: occurrence.updatedAt.toISOString(),
  };
}

function toApiCapturedItem(item: Prisma.CapturedItemGetPayload<object>): ApiCapturedItem {
  return {
    id: item.id,
    sourceType: reverseCaptureSourceMap[item.sourceType],
    status: reverseCaptureStatusMap[item.status],
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

async function getNextSortOrder(status: TaskStatus) {
  const { _max } = await prisma.task.aggregate({
    where: { status, archivedAt: null },
    _max: { sortOrder: true },
  });

  return (_max.sortOrder ?? -1) + 1;
}

function isValidStatus(status: string): status is StatusValue {
  return status in statusMap;
}

function isValidRecurrence(value: string): value is RecurrenceValue {
  return value === "none" || value in recurrenceMap;
}

function isValidCaptureSource(value: string): value is CaptureSourceValue {
  return value in captureSourceMap;
}

function validateTaskInput(input: Partial<TaskInput>): input is TaskInput {
  const recurrenceRule = input.recurrenceRule ?? "none";

  return (
    typeof input.title === "string" &&
    input.title.trim().length > 0 &&
    typeof input.dueDate === "string" &&
    typeof input.status === "string" &&
    isValidStatus(input.status) &&
    typeof recurrenceRule === "string" &&
    isValidRecurrence(recurrenceRule)
  );
}

function validateCaptureInput(input: Partial<CaptureInput>): input is CaptureInput {
  return (
    typeof input.sourceType === "string" &&
    isValidCaptureSource(input.sourceType) &&
    typeof input.title === "string" &&
    input.title.trim().length > 0
  );
}

function recursOnDate(task: { dueDate: Date; recurrenceRule: RecurrenceRule | null }, target: Date) {
  if (!task.recurrenceRule) {
    return false;
  }

  const anchor = task.dueDate;

  if (getDayBounds(target).start < getDayBounds(anchor).start) {
    return false;
  }

  switch (task.recurrenceRule) {
    case RecurrenceRule.DAILY:
      return true;
    case RecurrenceRule.WEEKDAYS:
      return ![0, 6].includes(target.getUTCDay());
    case RecurrenceRule.WEEKLY:
      return target.getUTCDay() === anchor.getUTCDay();
    case RecurrenceRule.MONTHLY:
      return target.getUTCDate() === anchor.getUTCDate();
    default:
      return false;
  }
}

function sortTodayItems(items: ApiTodayItem[]) {
  const statusPriority: Record<StatusValue, number> = {
    blocked: 0,
    "in-progress": 1,
    todo: 2,
    done: 3,
  };

  return [...items].sort((left, right) => {
    const byStatus = statusPriority[left.status] - statusPriority[right.status];
    if (byStatus !== 0) {
      return byStatus;
    }

    if (left.scheduledFor !== right.scheduledFor) {
      return left.scheduledFor.localeCompare(right.scheduledFor);
    }

    if (left.dueDate !== right.dueDate) {
      return left.dueDate.localeCompare(right.dueDate);
    }

    return left.createdAt.localeCompare(right.createdAt);
  });
}

async function generateRecurringOccurrences(target: Date) {
  const recurringTasks = await prisma.task.findMany({
    where: {
      isRecurring: true,
      recurrenceRule: { not: null },
      status: { not: TaskStatus.DONE },
      archivedAt: null,
    },
  });

  const { start, end } = getDayBounds(target);
  const existingOccurrences = await prisma.taskOccurrence.findMany({
    where: {
      scheduledFor: {
        gte: start,
        lte: end,
      },
    },
    select: {
      taskId: true,
    },
  });

  const existingTaskIds = new Set(existingOccurrences.map((item) => item.taskId));

  for (const task of recurringTasks) {
    if (!recursOnDate(task, target) || existingTaskIds.has(task.id)) {
      continue;
    }

    await prisma.taskOccurrence.create({
      data: {
        taskId: task.id,
        scheduledFor: toDateOnly(formatDate(target)),
        dueDate: toDateOnly(formatDate(target)),
        status: task.status === TaskStatus.DONE ? TaskStatus.TODO : task.status,
      },
    });
  }
}

async function generateDailyAgenda(target: Date): Promise<AgendaResponse> {
  await generateRecurringOccurrences(target);

  const { start, end } = getDayBounds(target);
  const agendaTargetSize = 5;

  await prisma.task.updateMany({
    where: {
      isRecurring: false,
      status: { not: TaskStatus.DONE },
      archivedAt: null,
      plannedForDate: {
        lt: start,
      },
    },
    data: {
      plannedForDate: toDateOnly(formatDate(target)),
    },
  });

  const mandatoryTasks = await prisma.task.findMany({
    where: {
      isRecurring: false,
      status: { not: TaskStatus.DONE },
      archivedAt: null,
      OR: [
        {
          dueDate: {
            lte: end,
          },
        },
        {
          plannedForDate: {
            gte: start,
            lte: end,
          },
        },
      ],
    },
    include: {
      links: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  const openOccurrences = await prisma.taskOccurrence.findMany({
    where: {
      scheduledFor: {
        gte: start,
        lte: end,
      },
      status: { not: TaskStatus.DONE },
      skippedAt: null,
      task: {
        archivedAt: null,
      },
    },
  });

  const remainingSlots = Math.max(agendaTargetSize - (mandatoryTasks.length + openOccurrences.length), 0);
  let promotedTaskCount = 0;

  if (remainingSlots > 0) {
    const candidateTasks = await prisma.task.findMany({
      where: {
        isRecurring: false,
        status: { not: TaskStatus.DONE },
        archivedAt: null,
        OR: [
          { plannedForDate: null },
          {
            plannedForDate: {
              gt: end,
            },
          },
        ],
        dueDate: {
          gt: end,
          lte: addDays(target, 7),
        },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    });

    const statusPriority: Record<TaskStatus, number> = {
      IN_PROGRESS: 0,
      BLOCKED: 1,
      TODO: 2,
      DONE: 3,
    };

    const promoted = candidateTasks
      .sort((left, right) => {
        const byStatus = statusPriority[left.status] - statusPriority[right.status];
        if (byStatus !== 0) {
          return byStatus;
        }

        return left.dueDate.getTime() - right.dueDate.getTime();
      })
      .slice(0, remainingSlots);

    for (const task of promoted) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          plannedForDate: toDateOnly(formatDate(target)),
        },
      });
    }

    promotedTaskCount = promoted.length;
  }

  const todayTasks = await prisma.task.findMany({
    where: {
      isRecurring: false,
      archivedAt: null,
      OR: [
        {
          dueDate: {
            lte: end,
          },
        },
        {
          plannedForDate: {
            gte: start,
            lte: end,
          },
        },
      ],
    },
    include: {
      links: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });

  const todayOccurrences = await prisma.taskOccurrence.findMany({
    where: {
      scheduledFor: {
        gte: start,
        lte: end,
      },
      skippedAt: null,
      task: {
        archivedAt: null,
      },
    },
    include: {
      task: {
        include: {
          links: {
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });

  return {
    date: formatDate(target),
    promotedTaskCount,
    items: sortTodayItems([
      ...todayTasks.map((task) => toApiTodayTask(task)),
      ...todayOccurrences.map((occurrence) => toApiTodayOccurrence(occurrence)),
    ]),
  };
}

app.get("/api/tasks", async (_request, response) => {
  const tasks = await prisma.task.findMany({
    where: {
      archivedAt: null,
    },
    include: {
      links: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });

  response.json(tasks.map((task) => toApiTask(task)));
});

app.get("/api/captured-items", async (_request, response) => {
  const items = await prisma.capturedItem.findMany({
    where: {
      status: {
        not: CaptureStatus.DISCARDED,
      },
    },
    orderBy: [{ status: "asc" }, { receivedAt: "desc" }],
  });

  response.json(items.map((item) => toApiCapturedItem(item)));
});

app.post("/api/integrations/slack/interactions", slackFormMiddleware, async (request, response) => {
  const rawBody = (request as express.Request & { rawBody?: Buffer }).rawBody ?? Buffer.from("");
  console.log("[slack] interactions request received");

  if (!verifySlackSignature(request, rawBody)) {
    console.log("[slack] interactions rejected: invalid signature");
    response.status(401).json({ error: "Invalid Slack signature." });
    return;
  }

  const { payload } = parseSlackFormPayload(rawBody);

  if (!payload) {
    console.log("[slack] interactions rejected: missing payload");
    response.status(400).json({ error: "Missing Slack payload." });
    return;
  }

  const parsed = JSON.parse(payload) as SlackInteractionPayload;

  if (parsed.type !== "message_action") {
    console.log(`[slack] interactions ignored: unsupported type ${parsed.type}`);
    response.status(200).json({ ok: true, ignored: true });
    return;
  }

  const channelId = parsed.channel?.id;
  const channelName = parsed.channel?.name ? `#${parsed.channel.name}` : channelId ?? null;
  const sender = parsed.user?.name ?? parsed.user?.username ?? parsed.user?.id ?? parsed.message?.user ?? null;
  const messageText = parsed.message?.text?.trim() ?? "";
  const messageTs = parsed.message?.ts;
  const externalId = channelId && messageTs ? `${channelId}:${messageTs}` : `${parsed.trigger_id ?? crypto.randomUUID()}`;
  const sourceUrl = getSlackDeepLink(parsed.team?.id, channelId, messageTs);
  response.status(200).send("");

  void upsertSlackCapturedItem({
    title: messageText.length > 80 ? `${messageText.slice(0, 77)}...` : messageText || "Slack message",
    body: messageText,
    externalId,
    sourceLabel: channelName,
    sourceUrl,
    sender,
  })
    .then((item) => {
      console.log(`[slack] interactions saved capture ${item.id} for externalId ${externalId}`);
    })
    .catch((error: unknown) => {
      console.error("[slack] interactions save failed", error);
    });
});

app.post("/api/integrations/slack/commands", slackFormMiddleware, async (request, response) => {
  const rawBody = (request as express.Request & { rawBody?: Buffer }).rawBody ?? Buffer.from("");
  console.log("[slack] slash command request received");

  if (!verifySlackSignature(request, rawBody)) {
    console.log("[slack] slash command rejected: invalid signature");
    response.status(401).json({ error: "Invalid Slack signature." });
    return;
  }

  const parsed = parseSlackFormPayload(rawBody);
  const text = parsed.text?.trim();

  if (!text) {
    console.log("[slack] slash command rejected: empty text");
    response.status(200).send("Usage: /taskflow-save <task or follow-up>");
    return;
  }

  const item = await upsertSlackCapturedItem({
    title: text.length > 80 ? `${text.slice(0, 77)}...` : text,
    body: text,
    externalId: parsed.channelId && parsed.triggerId ? `${parsed.channelId}:${parsed.triggerId}` : crypto.randomUUID(),
    sourceLabel: parsed.channelName ? `#${parsed.channelName}` : parsed.channelId ?? null,
    sender: parsed.userName ?? parsed.userId ?? null,
    sourceUrl: null,
  });

  console.log(`[slack] slash command saved capture ${item.id} for text "${item.title}"`);

  response.status(200).send(`Saved to Task Flow inbox: ${item.title}`);
});

app.post("/api/integrations/email/inbound", async (request, response) => {
  const input = request.body as Partial<EmailInboundInput>;
  const authorization = request.header("authorization");
  const directTokenHeader = request.header("x-email-inbound-token");
  const bearerToken = authorization?.replace(/^Bearer\s+/i, "").trim() ?? null;
  const expectedToken = emailInboundToken?.trim() ?? null;
  const bodyToken = input.token?.trim() ?? null;

  if (
    !expectedToken ||
    (bearerToken !== expectedToken && directTokenHeader?.trim() !== expectedToken && bodyToken !== expectedToken)
  ) {
    response.status(401).json({ error: "Invalid email inbound token." });
    return;
  }

  if (typeof input.subject !== "string" || input.subject.trim().length === 0) {
    response.status(400).json({ error: "Email subject is required." });
    return;
  }

  const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();
  const body = input.text?.trim() || input.html?.trim() || "";
  const sender = input.from?.trim() || null;
  const recipient = input.to?.trim() || null;
  const externalId = input.messageId?.trim() || crypto.randomUUID();

  const item = await upsertEmailCapturedItem({
    title: input.subject.trim(),
    body,
    externalId,
    sender,
    sourceLabel: recipient ? `To: ${recipient}` : "Forwarded email",
    sourceUrl: input.sourceUrl?.trim() || null,
    receivedAt,
  });

  response.status(201).json(toApiCapturedItem(item));
});

app.get("/api/today", async (request, response) => {
  const targetDate = typeof request.query.date === "string" ? request.query.date : formatDate(new Date());
  const agenda = await generateDailyAgenda(toDateOnly(targetDate));
  response.json(agenda);
});

app.post("/api/agenda/generate", async (request, response) => {
  const targetDate =
    typeof (request.body as { date?: string } | undefined)?.date === "string"
      ? (request.body as { date: string }).date
      : formatDate(new Date());

  const agenda = await generateDailyAgenda(toDateOnly(targetDate));
  response.json(agenda);
});

app.post("/api/tasks", async (request, response) => {
  const input = request.body as Partial<TaskInput>;

  if (!validateTaskInput(input)) {
    response.status(400).json({ error: "Invalid task payload." });
    return;
  }

  const recurrenceRule = normalizeRecurrence(input.isRecurring, input.recurrenceRule);
  const status = statusMap[input.status];
  const links = normalizeLinks(input.links);
  const sortOrder = await getNextSortOrder(status);

  const task = await prisma.task.create({
    data: {
      title: input.title.trim(),
      details: input.details?.trim() ?? "",
      dueDate: toDateOnly(input.dueDate),
      remindAt: toDateTime(input.remindAt),
      status,
      sortOrder,
      isRecurring: Boolean(recurrenceRule),
      recurrenceRule,
      archivedAt: null,
      completedAt: status === TaskStatus.DONE ? new Date() : null,
      links: {
        create: links.map((url, index) => ({
          url,
          sortOrder: index,
        })),
      },
    },
    include: {
      links: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  response.status(201).json(toApiTask(task));
});

app.post("/api/captured-items", async (request, response) => {
  const input = request.body as Partial<CaptureInput>;

  if (!validateCaptureInput(input)) {
    response.status(400).json({ error: "Invalid captured item payload." });
    return;
  }

  const item = await prisma.capturedItem.create({
    data: {
      sourceType: captureSourceMap[input.sourceType],
      title: input.title.trim(),
      body: input.body?.trim() ?? "",
      externalId: input.externalId?.trim() || null,
      sourceLabel: input.sourceLabel?.trim() || null,
      sourceUrl: input.sourceUrl?.trim() || null,
      sender: input.sender?.trim() || null,
      suggestedDueDate: input.suggestedDueDate ? toDateOnly(input.suggestedDueDate) : null,
      receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
    },
  });

  response.status(201).json(toApiCapturedItem(item));
});

app.post("/api/captured-items/demo/slack", async (_request, response) => {
  const timestamp = new Date();
  const item = await prisma.capturedItem.create({
    data: {
      sourceType: CaptureSourceType.SLACK,
      title: "Follow up on launch checklist update",
      body: "Can you turn the launch checklist thread into next-week tasks and flag blockers before Thursday?",
      sourceLabel: "#product-ops",
      sourceUrl: "https://slack.com/app_redirect?channel=product-ops",
      sender: "Avery Morgan",
      receivedAt: timestamp,
      suggestedDueDate: toDateOnly(formatDate(addDays(timestamp, 3))),
    },
  });

  response.status(201).json(toApiCapturedItem(item));
});

app.post("/api/captured-items/demo/email", async (_request, response) => {
  const timestamp = new Date();
  const item = await upsertEmailCapturedItem({
    title: "Client follow-up on Q2 launch plan",
    body: "Can you break this thread into tasks, note owners, and make sure we reply by Friday afternoon?",
    externalId: `demo-email-${timestamp.getTime()}`,
    sender: "jordan@example.com",
    sourceLabel: "To: founder@taskflow.app",
    sourceUrl: "mailto:founder@taskflow.app",
    receivedAt: timestamp,
  });

  response.status(201).json(toApiCapturedItem(item));
});

app.put("/api/tasks/:id", async (request, response) => {
  const input = request.body as Partial<TaskInput>;

  if (!validateTaskInput(input)) {
    response.status(400).json({ error: "Invalid task payload." });
    return;
  }

  const existing = await prisma.task.findUnique({
    where: { id: request.params.id },
  });

  if (!existing || existing.archivedAt) {
    response.status(404).json({ error: "Task not found." });
    return;
  }

  const recurrenceRule = normalizeRecurrence(input.isRecurring, input.recurrenceRule);
  const status = statusMap[input.status];
  const links = normalizeLinks(input.links);
  const sortOrder =
    existing.status === status ? existing.sortOrder : await getNextSortOrder(status);

  const task = await prisma.task.update({
    where: { id: request.params.id },
    data: {
      title: input.title.trim(),
      details: input.details?.trim() ?? "",
      dueDate: toDateOnly(input.dueDate),
      remindAt: toDateTime(input.remindAt),
      status,
      sortOrder,
      isRecurring: Boolean(recurrenceRule),
      recurrenceRule,
      plannedForDate: status === TaskStatus.DONE ? null : existing.plannedForDate,
      completedAt: status === TaskStatus.DONE ? existing.completedAt ?? new Date() : null,
      links: {
        deleteMany: {},
        create: links.map((url, index) => ({
          url,
          sortOrder: index,
        })),
      },
    },
    include: {
      links: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  response.json(toApiTask(task));
});

app.patch("/api/tasks/:id/status", async (request, response) => {
  const statusValue = (request.body as { status?: string }).status;

  if (!statusValue || !isValidStatus(statusValue)) {
    response.status(400).json({ error: "Invalid status payload." });
    return;
  }

  const existing = await prisma.task.findUnique({
    where: { id: request.params.id },
    include: {
      links: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!existing || existing.archivedAt) {
    response.status(404).json({ error: "Task not found." });
    return;
  }

  const status = statusMap[statusValue];
  const sortOrder =
    existing.status === status ? existing.sortOrder : await getNextSortOrder(status);

  const task = await prisma.task.update({
    where: { id: request.params.id },
    data: {
      status,
      sortOrder,
      plannedForDate: status === TaskStatus.DONE ? null : existing.plannedForDate,
      completedAt: status === TaskStatus.DONE ? existing.completedAt ?? new Date() : null,
    },
    include: {
      links: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  response.json(toApiTask(task));
});

app.patch("/api/today-items/:source/:id/status", async (request, response) => {
  const statusValue = (request.body as { status?: string }).status;
  const source = request.params.source;

  if (!statusValue || !isValidStatus(statusValue)) {
    response.status(400).json({ error: "Invalid status payload." });
    return;
  }

  const status = statusMap[statusValue];

  if (source === "task") {
    const existing = await prisma.task.findUnique({
      where: { id: request.params.id },
      include: {
        links: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!existing || existing.archivedAt) {
      response.status(404).json({ error: "Task not found." });
      return;
    }

    const task = await prisma.task.update({
      where: { id: request.params.id },
      data: {
        status,
        completedAt: status === TaskStatus.DONE ? existing.completedAt ?? new Date() : null,
        plannedForDate: status === TaskStatus.DONE ? null : existing.plannedForDate,
      },
      include: {
        links: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    response.json(toApiTodayTask(task));
    return;
  }

  if (source === "occurrence") {
    const existing = await prisma.taskOccurrence.findUnique({
      where: { id: request.params.id },
      include: {
        task: {
          include: {
            links: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });

    if (!existing || existing.task.archivedAt) {
      response.status(404).json({ error: "Occurrence not found." });
      return;
    }

    const occurrence = await prisma.taskOccurrence.update({
      where: { id: request.params.id },
      data: {
        status,
        completedAt: status === TaskStatus.DONE ? existing.completedAt ?? new Date() : null,
      },
      include: {
        task: {
          include: {
            links: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });

    response.json(toApiTodayOccurrence(occurrence));
    return;
  }

  response.status(400).json({ error: "Invalid today item source." });
});

app.patch("/api/tasks/:id/archive", async (request, response) => {
  const existing = await prisma.task.findUnique({
    where: { id: request.params.id },
    include: {
      links: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!existing || existing.archivedAt) {
    response.status(404).json({ error: "Task not found." });
    return;
  }

  const task = await prisma.task.update({
    where: { id: request.params.id },
    data: {
      archivedAt: new Date(),
      plannedForDate: null,
    },
    include: {
      links: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  response.json(toApiTask(task));
});

app.post("/api/captured-items/:id/accept", async (request, response) => {
  const input = request.body as Partial<TaskInput>;

  if (!validateTaskInput(input)) {
    response.status(400).json({ error: "Invalid task payload." });
    return;
  }

  const existing = await prisma.capturedItem.findUnique({
    where: { id: request.params.id },
  });

  if (!existing || existing.status !== CaptureStatus.NEW) {
    response.status(404).json({ error: "Captured item not found." });
    return;
  }

  const recurrenceRule = normalizeRecurrence(input.isRecurring, input.recurrenceRule);
  const status = statusMap[input.status];
  const links = Array.from(new Set([...normalizeLinks(input.links), ...normalizeCaptureLinks(existing)]));
  const sortOrder = await getNextSortOrder(status);

  const task = await prisma.task.create({
    data: {
      title: input.title.trim(),
      details: input.details?.trim() ?? "",
      dueDate: toDateOnly(input.dueDate),
      remindAt: toDateTime(input.remindAt),
      status,
      sortOrder,
      isRecurring: Boolean(recurrenceRule),
      recurrenceRule,
      completedAt: status === TaskStatus.DONE ? new Date() : null,
      links: {
        create: links.map((url, index) => ({
          url,
          sortOrder: index,
        })),
      },
      capturedItems: {
        connect: {
          id: existing.id,
        },
      },
    },
    include: {
      links: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  await prisma.capturedItem.update({
    where: { id: existing.id },
    data: {
      status: CaptureStatus.ACCEPTED,
      acceptedAt: new Date(),
      discardedAt: null,
      taskId: task.id,
    },
  });

  response.status(201).json(toApiTask(task));
});

app.patch("/api/captured-items/:id/discard", async (request, response) => {
  const existing = await prisma.capturedItem.findUnique({
    where: { id: request.params.id },
  });

  if (!existing || existing.status !== CaptureStatus.NEW) {
    response.status(404).json({ error: "Captured item not found." });
    return;
  }

  const item = await prisma.capturedItem.update({
    where: { id: request.params.id },
    data: {
      status: CaptureStatus.DISCARDED,
      discardedAt: new Date(),
    },
  });

  response.json(toApiCapturedItem(item));
});

app.delete("/api/tasks/:id", async (request, response) => {
  const existing = await prisma.task.findUnique({
    where: { id: request.params.id },
    select: { id: true, archivedAt: true },
  });

  if (!existing || existing.archivedAt) {
    response.status(404).json({ error: "Task not found." });
    return;
  }

  await prisma.task.delete({
    where: { id: request.params.id },
  });

  response.status(204).send();
});

app.patch("/api/today-items/:source/:id/skip", async (request, response) => {
  const source = request.params.source;

  if (source === "task") {
    const existing = await prisma.task.findUnique({
      where: { id: request.params.id },
      include: {
        links: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!existing || existing.archivedAt) {
      response.status(404).json({ error: "Task not found." });
      return;
    }

    const task = await prisma.task.update({
      where: { id: request.params.id },
      data: {
        plannedForDate: null,
      },
      include: {
        links: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    response.json(toApiTodayTask(task));
    return;
  }

  if (source === "occurrence") {
    const existing = await prisma.taskOccurrence.findUnique({
      where: { id: request.params.id },
      include: {
        task: {
          include: {
            links: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });

    if (!existing || existing.task.archivedAt) {
      response.status(404).json({ error: "Occurrence not found." });
      return;
    }

    const occurrence = await prisma.taskOccurrence.update({
      where: { id: request.params.id },
      data: {
        skippedAt: new Date(),
      },
      include: {
        task: {
          include: {
            links: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });

    response.json(toApiTodayOccurrence(occurrence));
    return;
  }

  response.status(400).json({ error: "Invalid today item source." });
});

app.patch("/api/today-items/:source/:id/snooze", async (request, response) => {
  const source = request.params.source;
  const tomorrow = toDateOnly(formatDate(addDays(new Date(), 1)));

  if (source === "task") {
    const existing = await prisma.task.findUnique({
      where: { id: request.params.id },
      include: {
        links: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!existing || existing.archivedAt) {
      response.status(404).json({ error: "Task not found." });
      return;
    }

    const task = await prisma.task.update({
      where: { id: request.params.id },
      data: {
        plannedForDate: tomorrow,
      },
      include: {
        links: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    response.json(toApiTodayTask(task));
    return;
  }

  if (source === "occurrence") {
    const existing = await prisma.taskOccurrence.findUnique({
      where: { id: request.params.id },
      include: {
        task: {
          include: {
            links: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });

    if (!existing || existing.task.archivedAt) {
      response.status(404).json({ error: "Occurrence not found." });
      return;
    }

    const occurrence = await prisma.taskOccurrence.update({
      where: { id: request.params.id },
      data: {
        skippedAt: new Date(),
      },
      include: {
        task: {
          include: {
            links: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });

    await prisma.taskOccurrence.upsert({
      where: {
        taskId_scheduledFor: {
          taskId: existing.taskId,
          scheduledFor: tomorrow,
        },
      },
      update: {
        dueDate: tomorrow,
        skippedAt: null,
      },
      create: {
        taskId: existing.taskId,
        scheduledFor: tomorrow,
        dueDate: tomorrow,
        status: existing.status === TaskStatus.DONE ? TaskStatus.TODO : existing.status,
      },
    });

    response.json(toApiTodayOccurrence(occurrence));
    return;
  }

  response.status(400).json({ error: "Invalid today item source." });
});

if (isProduction) {
  app.use(express.static(clientDistPath));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(clientDistPath, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Task Flow server listening on http://localhost:${port}`);
});
