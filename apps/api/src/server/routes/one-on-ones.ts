import express from "express";
import { OneOnOneCadence, OneOnOneMeetingStatus } from "@prisma/client";

import { API_ROUTES } from "../../../../../src/shared/api-routes.js";
import { requireAuth, authOf } from "../lib/auth.js";
import { prisma } from "../lib/db.js";

const cadenceMap = {
  weekly: OneOnOneCadence.WEEKLY,
  biweekly: OneOnOneCadence.BIWEEKLY,
  monthly: OneOnOneCadence.MONTHLY,
  "ad-hoc": OneOnOneCadence.AD_HOC,
} as const;

const reverseCadenceMap = {
  [OneOnOneCadence.WEEKLY]: "weekly",
  [OneOnOneCadence.BIWEEKLY]: "biweekly",
  [OneOnOneCadence.MONTHLY]: "monthly",
  [OneOnOneCadence.AD_HOC]: "ad-hoc",
} as const;

const meetingStatusMap = {
  scheduled: OneOnOneMeetingStatus.SCHEDULED,
  completed: OneOnOneMeetingStatus.COMPLETED,
  canceled: OneOnOneMeetingStatus.CANCELED,
} as const;

const reverseMeetingStatusMap = {
  [OneOnOneMeetingStatus.SCHEDULED]: "scheduled",
  [OneOnOneMeetingStatus.COMPLETED]: "completed",
  [OneOnOneMeetingStatus.CANCELED]: "canceled",
} as const;

function toApiDirectReport(
  report: Awaited<ReturnType<typeof fetchDirectReports>>[number],
) {
  return {
    id: report.id,
    reportName: report.reportName,
    reportEmail: report.reportEmail ?? null,
    role: report.role,
    cadence: reverseCadenceMap[report.cadence],
    nextMeetingAt: report.nextMeetingAt ? report.nextMeetingAt.toISOString() : null,
    notes: report.notes,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
    standingItems: report.standingItems
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((item) => ({
        id: item.id,
        body: item.body,
        isPrivate: item.isPrivate,
        sortOrder: item.sortOrder,
        completedAt: item.completedAt ? item.completedAt.toISOString() : null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    meetings: report.meetings
      .slice()
      .sort((left, right) => right.scheduledFor.getTime() - left.scheduledFor.getTime())
      .map((meeting) => toApiMeeting(meeting)),
  };
}

function toApiMeeting(
  meeting: {
    id: string;
    scheduledFor: Date;
    status: OneOnOneMeetingStatus;
    sharedNotes: string;
    privateNotes: string;
    priorActionItems: string[];
    nextActionItems: string[];
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
) {
  return {
    id: meeting.id,
    scheduledFor: meeting.scheduledFor.toISOString(),
    status: reverseMeetingStatusMap[meeting.status],
    sharedNotes: meeting.sharedNotes,
    privateNotes: meeting.privateNotes,
    priorActionItems: meeting.priorActionItems,
    nextActionItems: meeting.nextActionItems,
    completedAt: meeting.completedAt ? meeting.completedAt.toISOString() : null,
    createdAt: meeting.createdAt.toISOString(),
    updatedAt: meeting.updatedAt.toISOString(),
  };
}

async function fetchDirectReports(workspaceId: string, managerUserId: string) {
  return prisma.directReport.findMany({
    where: {
      workspaceId,
      managerUserId,
    },
    include: { standingItems: true, meetings: true },
    orderBy: [{ nextMeetingAt: "asc" }, { createdAt: "asc" }],
  });
}

async function fetchOwnedReportOrNull(reportId: string, workspaceId: string, managerUserId: string) {
  return prisma.directReport.findFirst({
    where: {
      id: reportId,
      workspaceId,
      managerUserId,
    },
  });
}

function isValidCadence(value: string): value is keyof typeof cadenceMap {
  return value in cadenceMap;
}

function isValidMeetingStatus(value: string): value is keyof typeof meetingStatusMap {
  return value in meetingStatusMap;
}

function normalizeActionItems(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
}

function computeNextMeetingAt(currentMeetingAt: Date, cadence: OneOnOneCadence) {
  const nextMeetingAt = new Date(currentMeetingAt);

  if (cadence === OneOnOneCadence.WEEKLY) {
    nextMeetingAt.setDate(nextMeetingAt.getDate() + 7);
    return nextMeetingAt;
  }

  if (cadence === OneOnOneCadence.BIWEEKLY) {
    nextMeetingAt.setDate(nextMeetingAt.getDate() + 14);
    return nextMeetingAt;
  }

  if (cadence === OneOnOneCadence.MONTHLY) {
    nextMeetingAt.setMonth(nextMeetingAt.getMonth() + 1);
    return nextMeetingAt;
  }

  return null;
}

export function createOneOnOnesRouter() {
  const router = express.Router();
  router.use(requireAuth);

  router.get(API_ROUTES.oneOnOnes.list, async (request, response) => {
    const auth = authOf(request);
    const reports = await fetchDirectReports(auth.workspace.id, auth.user.id);
    response.json(reports.map((report) => toApiDirectReport(report)));
  });

  router.post(API_ROUTES.oneOnOnes.reports, async (request, response) => {
    const auth = authOf(request);
    const input = request.body as {
      reportName?: string;
      reportEmail?: string | null;
      role?: string;
      cadence?: string;
      nextMeetingAt?: string | null;
      notes?: string;
    };

    if (
      typeof input.reportName !== "string" ||
      !input.reportName.trim() ||
      typeof input.role !== "string" ||
      typeof input.cadence !== "string" ||
      !isValidCadence(input.cadence)
    ) {
      response.status(400).json({ error: "Invalid direct report payload." });
      return;
    }

    const report = await prisma.directReport.create({
      data: {
        workspaceId: auth.workspace.id,
        managerUserId: auth.user.id,
        reportName: input.reportName.trim(),
        reportEmail: input.reportEmail?.trim() || null,
        role: input.role.trim(),
        cadence: cadenceMap[input.cadence],
        nextMeetingAt: input.nextMeetingAt ? new Date(input.nextMeetingAt) : null,
        notes: input.notes?.trim() ?? "",
      },
      include: { standingItems: true, meetings: true },
    });

    response.status(201).json(toApiDirectReport(report));
  });

  router.put("/api/one-on-ones/reports/:id", async (request, response) => {
    const auth = authOf(request);
    const input = request.body as {
      reportName?: string;
      reportEmail?: string | null;
      role?: string;
      cadence?: string;
      nextMeetingAt?: string | null;
      notes?: string;
    };

    if (
      typeof input.reportName !== "string" ||
      !input.reportName.trim() ||
      typeof input.role !== "string" ||
      typeof input.cadence !== "string" ||
      !isValidCadence(input.cadence)
    ) {
      response.status(400).json({ error: "Invalid direct report payload." });
      return;
    }

    const existing = await fetchOwnedReportOrNull(request.params.id, auth.workspace.id, auth.user.id);
    if (!existing) {
      response.status(404).json({ error: "Direct report not found." });
      return;
    }

    const report = await prisma.directReport.update({
      where: { id: existing.id },
      data: {
        reportName: input.reportName.trim(),
        reportEmail: input.reportEmail?.trim() || null,
        role: input.role.trim(),
        cadence: cadenceMap[input.cadence],
        nextMeetingAt: input.nextMeetingAt ? new Date(input.nextMeetingAt) : null,
        notes: input.notes?.trim() ?? "",
      },
      include: { standingItems: true, meetings: true },
    });

    response.json(toApiDirectReport(report));
  });

  router.delete("/api/one-on-ones/reports/:id", async (request, response) => {
    const auth = authOf(request);
    const existing = await fetchOwnedReportOrNull(request.params.id, auth.workspace.id, auth.user.id);
    if (!existing) {
      response.status(404).json({ error: "Direct report not found." });
      return;
    }

    await prisma.directReport.delete({ where: { id: existing.id } });
    response.status(204).send();
  });

  router.post("/api/one-on-ones/reports/:id/agenda-items", async (request, response) => {
    const auth = authOf(request);
    const existing = await fetchOwnedReportOrNull(request.params.id, auth.workspace.id, auth.user.id);
    if (!existing) {
      response.status(404).json({ error: "Direct report not found." });
      return;
    }

    const input = request.body as { body?: string; isPrivate?: boolean };
    if (typeof input.body !== "string" || !input.body.trim()) {
      response.status(400).json({ error: "Agenda item body is required." });
      return;
    }

    const sortOrder =
      (
        await prisma.oneOnOneAgendaItem.aggregate({
          where: { directReportId: existing.id },
          _max: { sortOrder: true },
        })
      )._max.sortOrder ?? -1;

    const item = await prisma.oneOnOneAgendaItem.create({
      data: {
        directReportId: existing.id,
        body: input.body.trim(),
        isPrivate: input.isPrivate ?? true,
        sortOrder: sortOrder + 1,
      },
    });

    response.status(201).json({
      id: item.id,
      body: item.body,
      isPrivate: item.isPrivate,
      sortOrder: item.sortOrder,
      completedAt: item.completedAt ? item.completedAt.toISOString() : null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    });
  });

  router.put("/api/one-on-ones/agenda-items/:id", async (request, response) => {
    const auth = authOf(request);
    const input = request.body as { body?: string; isPrivate?: boolean; completed?: boolean };
    if (typeof input.body !== "string" || !input.body.trim() || typeof input.isPrivate !== "boolean" || typeof input.completed !== "boolean") {
      response.status(400).json({ error: "Invalid agenda item payload." });
      return;
    }

    const existing = await prisma.oneOnOneAgendaItem.findFirst({
      where: {
        id: request.params.id,
        directReport: {
          workspaceId: auth.workspace.id,
          managerUserId: auth.user.id,
        },
      },
    });

    if (!existing) {
      response.status(404).json({ error: "Agenda item not found." });
      return;
    }

    const item = await prisma.oneOnOneAgendaItem.update({
      where: { id: existing.id },
      data: {
        body: input.body.trim(),
        isPrivate: input.isPrivate,
        completedAt: input.completed ? existing.completedAt ?? new Date() : null,
      },
    });

    response.json({
      id: item.id,
      body: item.body,
      isPrivate: item.isPrivate,
      sortOrder: item.sortOrder,
      completedAt: item.completedAt ? item.completedAt.toISOString() : null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    });
  });

  router.delete("/api/one-on-ones/agenda-items/:id", async (request, response) => {
    const auth = authOf(request);
    const existing = await prisma.oneOnOneAgendaItem.findFirst({
      where: {
        id: request.params.id,
        directReport: {
          workspaceId: auth.workspace.id,
          managerUserId: auth.user.id,
        },
      },
    });

    if (!existing) {
      response.status(404).json({ error: "Agenda item not found." });
      return;
    }

    await prisma.oneOnOneAgendaItem.delete({ where: { id: existing.id } });
    response.status(204).send();
  });

  router.post("/api/one-on-ones/reports/:id/meetings", async (request, response) => {
    const auth = authOf(request);
    const existing = await fetchOwnedReportOrNull(request.params.id, auth.workspace.id, auth.user.id);
    if (!existing) {
      response.status(404).json({ error: "Direct report not found." });
      return;
    }

    const input = request.body as { scheduledFor?: string };
    if (typeof input.scheduledFor !== "string" || !input.scheduledFor.trim()) {
      response.status(400).json({ error: "Scheduled time is required." });
      return;
    }

    const meeting = await prisma.oneOnOneMeeting.create({
      data: {
        workspaceId: auth.workspace.id,
        directReportId: existing.id,
        scheduledFor: new Date(input.scheduledFor),
      },
    });

    await prisma.directReport.update({
      where: { id: existing.id },
      data: { nextMeetingAt: meeting.scheduledFor },
    });

    response.status(201).json(toApiMeeting(meeting));
  });

  router.post("/api/one-on-ones/reports/:id/meetings/complete", async (request, response) => {
    const auth = authOf(request);
    const existing = await fetchOwnedReportOrNull(request.params.id, auth.workspace.id, auth.user.id);
    if (!existing) {
      response.status(404).json({ error: "Direct report not found." });
      return;
    }

    const input = request.body as {
      scheduledFor?: string;
      meetingDetails?: string;
      nextActionItems?: unknown;
    };
    if (typeof input.scheduledFor !== "string" || !input.scheduledFor.trim() || typeof input.meetingDetails !== "string") {
      response.status(400).json({ error: "Invalid 1:1 payload." });
      return;
    }

    const scheduledFor = new Date(input.scheduledFor);
    if (Number.isNaN(scheduledFor.getTime())) {
      response.status(400).json({ error: "Scheduled time is invalid." });
      return;
    }

    const meetingDetails = input.meetingDetails.trim();
    const nextActionItems = normalizeActionItems(input.nextActionItems);

    const updatedReport = await prisma.$transaction(async (tx) => {
      const priorItems = await tx.oneOnOneAgendaItem.findMany({
        where: {
          directReportId: existing.id,
          completedAt: null,
        },
        orderBy: { sortOrder: "asc" },
      });

      await tx.oneOnOneMeeting.create({
        data: {
          workspaceId: auth.workspace.id,
          directReportId: existing.id,
          scheduledFor,
          status: OneOnOneMeetingStatus.COMPLETED,
          sharedNotes: meetingDetails,
          priorActionItems: priorItems.map((item) => item.body),
          nextActionItems,
          completedAt: new Date(),
        },
      });

      await tx.oneOnOneAgendaItem.deleteMany({
        where: { directReportId: existing.id },
      });

      if (nextActionItems.length > 0) {
        await tx.oneOnOneAgendaItem.createMany({
          data: nextActionItems.map((body, index) => ({
            directReportId: existing.id,
            body,
            isPrivate: true,
            sortOrder: index,
          })),
        });
      }

      await tx.directReport.update({
        where: { id: existing.id },
        data: {
          nextMeetingAt: computeNextMeetingAt(scheduledFor, existing.cadence),
        },
      });

      return tx.directReport.findFirstOrThrow({
        where: { id: existing.id },
        include: { standingItems: true, meetings: true },
      });
    });

    response.status(201).json(toApiDirectReport(updatedReport));
  });

  router.put("/api/one-on-ones/meetings/:id", async (request, response) => {
    const auth = authOf(request);
    const input = request.body as {
      scheduledFor?: string;
      status?: string;
      sharedNotes?: string;
      privateNotes?: string;
    };

    if (
      typeof input.scheduledFor !== "string" ||
      typeof input.status !== "string" ||
      !isValidMeetingStatus(input.status)
    ) {
      response.status(400).json({ error: "Invalid meeting payload." });
      return;
    }

    const existing = await prisma.oneOnOneMeeting.findFirst({
      where: {
        id: request.params.id,
        workspaceId: auth.workspace.id,
        directReport: {
          managerUserId: auth.user.id,
        },
      },
    });

    if (!existing) {
      response.status(404).json({ error: "Meeting not found." });
      return;
    }

    const meeting = await prisma.oneOnOneMeeting.update({
      where: { id: existing.id },
      data: {
        scheduledFor: new Date(input.scheduledFor),
        status: meetingStatusMap[input.status],
        sharedNotes: input.sharedNotes?.trim() ?? "",
        privateNotes: input.privateNotes?.trim() ?? "",
        completedAt:
          input.status === "completed"
            ? existing.completedAt ?? new Date()
            : null,
      },
    });

    response.json(toApiMeeting(meeting));
  });

  router.delete("/api/one-on-ones/meetings/:id", async (request, response) => {
    const auth = authOf(request);
    const existing = await prisma.oneOnOneMeeting.findFirst({
      where: {
        id: request.params.id,
        workspaceId: auth.workspace.id,
        directReport: {
          managerUserId: auth.user.id,
        },
      },
    });

    if (!existing) {
      response.status(404).json({ error: "Meeting not found." });
      return;
    }

    await prisma.oneOnOneMeeting.delete({ where: { id: existing.id } });
    response.status(204).send();
  });

  return router;
}
