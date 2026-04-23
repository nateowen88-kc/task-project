import { TaskStatus } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { addDays, formatDate, getDayBounds, recursOnDate, toDateOnly } from "../lib/dates.js";
import {
  type AgendaResponse,
  type ApiTodayItem,
  reverseImportanceMap,
  toApiTodayOccurrence,
  toApiTodayTask,
} from "../lib/serializers.js";
import { buildAuthContext, getTaskPermissions } from "../lib/auth.js";

const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";

type AgendaRankingCandidate = {
  id: string;
  title: string;
  details: string;
  dueDate: string;
  status: TaskStatus;
  importance: keyof typeof reverseImportanceMap;
};

type AgendaRankingResponse = {
  ordered: Array<{
    id: string;
    reason: string;
    confidence: number;
  }>;
};

const defaultTaskPermissions = {
  canEdit: false,
  canChangeStatus: false,
  canComment: false,
  canArchive: false,
  canDelete: false,
  canReassign: false,
} as const;

function sortTodayItems(items: ApiTodayItem[]) {
  const statusPriority: Record<ApiTodayItem["status"], number> = {
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

function deterministicAgendaSort(tasks: Array<{ id: string; status: TaskStatus; dueDate: Date; createdAt: Date }>) {
  const statusPriority: Record<TaskStatus, number> = {
    IN_PROGRESS: 0,
    BLOCKED: 1,
    TODO: 2,
    DONE: 3,
  };

  return [...tasks].sort((left, right) => {
    const byStatus = statusPriority[left.status] - statusPriority[right.status];
    if (byStatus !== 0) {
      return byStatus;
    }

    const byDueDate = left.dueDate.getTime() - right.dueDate.getTime();
    if (byDueDate !== 0) {
      return byDueDate;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

async function rankAgendaCandidatesWithAi(
  candidates: AgendaRankingCandidate[],
): Promise<Array<{ id: string; reason: string; confidence: number }> | null> {
  if (!geminiApiKey || candidates.length === 0) {
    return null;
  }

  const today = formatDate(new Date());

  const prompt = `You are ranking tasks for a daily agenda.

Prioritize based on:
- urgency (due date)
- importance
- momentum (in-progress tasks first)

Return ONLY valid JSON in this exact shape:
{
  "ordered": [
    {
      "id": "task-id",
      "reason": "short reason",
      "confidence": 0.82
    }
  ]
}

Rules:
- Only include IDs that appear in the provided task list.
- Keep reasons under 120 characters.
- Confidence must be a number between 0 and 1.
- Do not include markdown fences or any explanation outside the JSON.

Today: ${today}

Tasks:
${JSON.stringify(candidates)}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[agenda-ai] gemini request failed", response.status, errorText);
      return null;
    }

    const result = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      continue;
    }

    try {
      const cleaned = text.trim().replace(/```json|```/g, "");
      const parsed = JSON.parse(cleaned) as AgendaRankingResponse;
      const validIds = new Set(candidates.map((candidate) => candidate.id));

      const ordered = parsed.ordered
        .filter(
          (item, index, array) =>
            validIds.has(item.id) &&
            array.findIndex((candidate) => candidate.id === item.id) === index,
        )
        .map((item) => ({
          id: item.id,
          reason: item.reason?.trim() || "Ranked by Gemini for today.",
          confidence:
            typeof item.confidence === "number"
              ? Math.max(0, Math.min(1, item.confidence))
              : 0.5,
        }));

      if (ordered.length > 0) {
        return ordered;
      }
    } catch (error) {
      console.error("[agenda-ai] gemini parse failed", error, text);
    }
  }

  return null;
}

export async function generateRecurringOccurrences(workspaceId: string, target: Date) {
  const recurringTasks = await prisma.task.findMany({
    where: {
      workspaceId,
      isRecurring: true,
      recurrenceRule: { not: null },
      status: { not: TaskStatus.DONE },
      archivedAt: null,
    },
  });

  const { start, end } = getDayBounds(target);
  const existingOccurrences = await prisma.taskOccurrence.findMany({
    where: {
      workspaceId,
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
        workspaceId,
        taskId: task.id,
        scheduledFor: toDateOnly(formatDate(target)),
        dueDate: toDateOnly(formatDate(target)),
        status: task.status === TaskStatus.DONE ? TaskStatus.TODO : task.status,
      },
    });
  }
}

export async function generateDailyAgenda(
  workspaceId: string,
  target: Date,
  viewerUserId?: string,
): Promise<AgendaResponse> {
  return buildAgendaSnapshot(workspaceId, target, {
    promoteCandidates: true,
    includeAiRanking: true,
    viewerUserId,
  });
}

export async function buildAgendaSnapshot(
  workspaceId: string,
  target: Date,
  options?: {
    promoteCandidates?: boolean;
    includeAiRanking?: boolean;
    viewerUserId?: string;
  },
): Promise<AgendaResponse> {
  await generateRecurringOccurrences(workspaceId, target);

  const { start, end } = getDayBounds(target);
  const agendaTargetSize = 5;
  const promoteCandidates = options?.promoteCandidates ?? false;
  const includeAiRanking = options?.includeAiRanking ?? false;

  if (promoteCandidates) {
    await prisma.task.updateMany({
      where: {
        workspaceId,
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
  }

  const mandatoryTasks = await prisma.task.findMany({
    where: {
      workspaceId,
      isRecurring: false,
      status: { not: TaskStatus.DONE },
      archivedAt: null,
      OR: [{ dueDate: { lte: end } }, { plannedForDate: { gte: start, lte: end } }],
    },
    include: {
      workspace: true,
      links: { orderBy: { sortOrder: "asc" } },
      assignee: { select: { name: true } },
    },
  });

  const openOccurrences = await prisma.taskOccurrence.findMany({
    where: {
      workspaceId,
      scheduledFor: { gte: start, lte: end },
      status: { not: TaskStatus.DONE },
      skippedAt: null,
      task: { archivedAt: null },
    },
  });

  const remainingSlots = Math.max(agendaTargetSize - (mandatoryTasks.length + openOccurrences.length), 0);
  let promotedTaskCount = 0;

  if (promoteCandidates && remainingSlots > 0) {
    const candidateTasks = await prisma.task.findMany({
      where: {
        workspaceId,
        isRecurring: false,
        status: { not: TaskStatus.DONE },
        archivedAt: null,
        OR: [{ plannedForDate: null }, { plannedForDate: { gt: end } }],
        dueDate: {
          gt: end,
          lte: addDays(target, 7),
        },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    });

    const aiRankedTasks = includeAiRanking
      ? await rankAgendaCandidatesWithAi(
          candidateTasks.map((task) => ({
            id: task.id,
            title: task.title,
            details: task.details,
            dueDate: formatDate(task.dueDate),
            status: task.status,
            importance: task.importance,
          })),
        )
      : null;

    const promoted = aiRankedTasks
      ? aiRankedTasks
          .map((item) => candidateTasks.find((task) => task.id === item.id))
          .filter((task): task is (typeof candidateTasks)[number] => Boolean(task))
          .slice(0, remainingSlots)
      : deterministicAgendaSort(candidateTasks).slice(0, remainingSlots);

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
      workspaceId,
      isRecurring: false,
      archivedAt: null,
      OR: [{ dueDate: { lte: end } }, { plannedForDate: { gte: start, lte: end } }],
    },
    include: {
      workspace: true,
      links: { orderBy: { sortOrder: "asc" } },
      assignee: { select: { name: true } },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });

  const todayTaskAiRankings = includeAiRanking
    ? await rankAgendaCandidatesWithAi(
        todayTasks.map((task) => ({
          id: task.id,
          title: task.title,
          details: task.details,
          dueDate: formatDate(task.dueDate),
          status: task.status,
          importance: task.importance,
        })),
      )
    : null;

  const todayOccurrences = await prisma.taskOccurrence.findMany({
    where: {
      workspaceId,
      scheduledFor: { gte: start, lte: end },
      skippedAt: null,
      task: { archivedAt: null },
    },
    include: {
      task: {
        include: {
          workspace: true,
          links: { orderBy: { sortOrder: "asc" } },
          assignee: { select: { name: true } },
        },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });

  const aiReasonMap = new Map(
    (todayTaskAiRankings ?? []).map((item) => [
      item.id,
      { reason: item.reason, confidence: item.confidence },
    ]),
  );
  const viewerAuth = options?.viewerUserId ? await buildAuthContext(options.viewerUserId) : null;

  return {
    date: formatDate(target),
    promotedTaskCount,
    items: sortTodayItems([
      ...todayTasks.map((task) =>
        toApiTodayTask(
          task,
          viewerAuth ? getTaskPermissions(viewerAuth, task) : defaultTaskPermissions,
          aiReasonMap.get(task.id),
        ),
      ),
      ...todayOccurrences.map((occurrence) =>
        toApiTodayOccurrence(
          occurrence,
          viewerAuth ? getTaskPermissions(viewerAuth, occurrence.task) : defaultTaskPermissions,
        ),
      ),
    ]),
  };
}
