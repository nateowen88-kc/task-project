import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import type { DirectReport, OneOnOneCadence } from "../../api";
import {
  completeOneOnOneMeeting,
  createDirectReport,
  createOneOnOneAgendaItem,
  createOneOnOneMeeting,
  deleteDirectReport,
  deleteOneOnOneAgendaItem,
  deleteOneOnOneMeeting,
  updateDirectReport,
  updateOneOnOneAgendaItem,
  updateOneOnOneMeeting,
} from "../../api";

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export type DirectReportCreateForm = {
  reportName: string;
  reportEmail: string;
  role: string;
  cadence: OneOnOneCadence;
  nextMeetingAt: string;
  notes: string;
};

export function useOneOnOneActions({
  directReports,
  setDirectReports,
  onError,
}: {
  directReports: DirectReport[];
  setDirectReports: Dispatch<SetStateAction<DirectReport[]>>;
  onError: (message: string | null) => void;
}) {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<DirectReportCreateForm>({
    reportName: "",
    reportEmail: "",
    role: "",
    cadence: "weekly",
    nextMeetingAt: "",
    notes: "",
  });
  const [isCreatingReport, setIsCreatingReport] = useState(false);
  const [savingReportId, setSavingReportId] = useState<string | null>(null);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [savingAgendaItemId, setSavingAgendaItemId] = useState<string | null>(null);
  const [deletingAgendaItemId, setDeletingAgendaItemId] = useState<string | null>(null);
  const [savingMeetingId, setSavingMeetingId] = useState<string | null>(null);
  const [deletingMeetingId, setDeletingMeetingId] = useState<string | null>(null);
  const [creatingAgendaForReportId, setCreatingAgendaForReportId] = useState<string | null>(null);
  const [creatingMeetingForReportId, setCreatingMeetingForReportId] = useState<string | null>(null);
  const [completingMeetingForReportId, setCompletingMeetingForReportId] = useState<string | null>(null);

  useEffect(() => {
    if (directReports.length === 0) {
      setSelectedReportId(null);
      return;
    }

    if (!selectedReportId || !directReports.some((report) => report.id === selectedReportId)) {
      setSelectedReportId(directReports[0].id);
    }
  }, [directReports, selectedReportId]);

  async function handleCreateReport() {
    if (!createForm.reportName.trim()) {
      onError("Direct report name is required.");
      return;
    }

    if (!createForm.role.trim()) {
      onError("Direct report role is required.");
      return;
    }

    try {
      setIsCreatingReport(true);
      onError(null);
      const created = await createDirectReport({
        reportName: createForm.reportName,
        reportEmail: createForm.reportEmail || null,
        role: createForm.role,
        cadence: createForm.cadence,
        nextMeetingAt: createForm.nextMeetingAt || null,
        notes: createForm.notes,
      });
      setDirectReports((current) => [...current, created]);
      setSelectedReportId(created.id);
      setCreateForm({
        reportName: "",
        reportEmail: "",
        role: "",
        cadence: "weekly",
        nextMeetingAt: "",
        notes: "",
      });
    } catch (error) {
      onError(toErrorMessage(error, "Could not create direct report."));
    } finally {
      setIsCreatingReport(false);
    }
  }

  async function handleSaveReport(reportId: string, payload: DirectReportCreateForm) {
    if (!payload.reportName.trim()) {
      onError("Direct report name is required.");
      return;
    }

    if (!payload.role.trim()) {
      onError("Direct report role is required.");
      return;
    }

    try {
      setSavingReportId(reportId);
      onError(null);
      const updated = await updateDirectReport(reportId, {
        reportName: payload.reportName,
        reportEmail: payload.reportEmail || null,
        role: payload.role,
        cadence: payload.cadence,
        nextMeetingAt: payload.nextMeetingAt || null,
        notes: payload.notes,
      });
      setDirectReports((current) => current.map((report) => (report.id === reportId ? updated : report)));
    } catch (error) {
      onError(toErrorMessage(error, "Could not save direct report."));
    } finally {
      setSavingReportId(null);
    }
  }

  async function handleDeleteReport(reportId: string) {
    try {
      setDeletingReportId(reportId);
      onError(null);
      await deleteDirectReport(reportId);
      setDirectReports((current) => current.filter((report) => report.id !== reportId));
    } catch (error) {
      onError(toErrorMessage(error, "Could not delete direct report."));
    } finally {
      setDeletingReportId(null);
    }
  }

  async function handleCreateAgendaItem(reportId: string, body: string, isPrivate: boolean) {
    try {
      setCreatingAgendaForReportId(reportId);
      onError(null);
      const created = await createOneOnOneAgendaItem(reportId, { body, isPrivate });
      setDirectReports((current) =>
        current.map((report) =>
          report.id === reportId
            ? { ...report, standingItems: [...report.standingItems, created] }
            : report,
        ),
      );
    } catch (error) {
      onError(toErrorMessage(error, "Could not create agenda item."));
    } finally {
      setCreatingAgendaForReportId(null);
    }
  }

  async function handleUpdateAgendaItem(
    itemId: string,
    reportId: string,
    body: string,
    isPrivate: boolean,
    completed: boolean,
  ) {
    try {
      setSavingAgendaItemId(itemId);
      onError(null);
      const updated = await updateOneOnOneAgendaItem(itemId, { body, isPrivate, completed });
      setDirectReports((current) =>
        current.map((report) =>
          report.id === reportId
            ? {
                ...report,
                standingItems: report.standingItems.map((item) => (item.id === itemId ? updated : item)),
              }
            : report,
        ),
      );
    } catch (error) {
      onError(toErrorMessage(error, "Could not update agenda item."));
    } finally {
      setSavingAgendaItemId(null);
    }
  }

  async function handleDeleteAgendaItem(itemId: string, reportId: string) {
    try {
      setDeletingAgendaItemId(itemId);
      onError(null);
      await deleteOneOnOneAgendaItem(itemId);
      setDirectReports((current) =>
        current.map((report) =>
          report.id === reportId
            ? { ...report, standingItems: report.standingItems.filter((item) => item.id !== itemId) }
            : report,
        ),
      );
    } catch (error) {
      onError(toErrorMessage(error, "Could not delete agenda item."));
    } finally {
      setDeletingAgendaItemId(null);
    }
  }

  async function handleCreateMeeting(reportId: string, scheduledFor: string) {
    try {
      setCreatingMeetingForReportId(reportId);
      onError(null);
      const created = await createOneOnOneMeeting(reportId, { scheduledFor });
      setDirectReports((current) =>
        current.map((report) =>
          report.id === reportId
            ? { ...report, nextMeetingAt: created.scheduledFor, meetings: [created, ...report.meetings] }
            : report,
        ),
      );
    } catch (error) {
      onError(toErrorMessage(error, "Could not create meeting."));
    } finally {
      setCreatingMeetingForReportId(null);
    }
  }

  async function handleCompleteMeeting(
    reportId: string,
    scheduledFor: string,
    meetingDetails: string,
    nextActionItems: string[],
  ) {
    if (!scheduledFor.trim()) {
      onError("Meeting date and time are required.");
      return;
    }

    try {
      setCompletingMeetingForReportId(reportId);
      onError(null);
      const updated = await completeOneOnOneMeeting(reportId, {
        scheduledFor,
        meetingDetails,
        nextActionItems,
      });
      setDirectReports((current) =>
        current.map((report) => (report.id === reportId ? updated : report)),
      );
      setSelectedReportId(reportId);
    } catch (error) {
      onError(toErrorMessage(error, "Could not create 1:1."));
    } finally {
      setCompletingMeetingForReportId(null);
    }
  }

  async function handleUpdateMeeting(
    meetingId: string,
    reportId: string,
    scheduledFor: string,
    status: "scheduled" | "completed" | "canceled",
    sharedNotes: string,
    privateNotes: string,
  ) {
    try {
      setSavingMeetingId(meetingId);
      onError(null);
      const updated = await updateOneOnOneMeeting(meetingId, {
        scheduledFor,
        status,
        sharedNotes,
        privateNotes,
      });
      setDirectReports((current) =>
        current.map((report) =>
          report.id === reportId
            ? {
                ...report,
                meetings: report.meetings.map((meeting) => (meeting.id === meetingId ? updated : meeting)),
              }
            : report,
        ),
      );
    } catch (error) {
      onError(toErrorMessage(error, "Could not update meeting."));
    } finally {
      setSavingMeetingId(null);
    }
  }

  async function handleDeleteMeeting(meetingId: string, reportId: string) {
    try {
      setDeletingMeetingId(meetingId);
      onError(null);
      await deleteOneOnOneMeeting(meetingId);
      setDirectReports((current) =>
        current.map((report) =>
          report.id === reportId
            ? { ...report, meetings: report.meetings.filter((meeting) => meeting.id !== meetingId) }
            : report,
        ),
      );
    } catch (error) {
      onError(toErrorMessage(error, "Could not delete meeting."));
    } finally {
      setDeletingMeetingId(null);
    }
  }

  return {
    selectedReportId,
    setSelectedReportId,
    createForm,
    setCreateForm,
    isCreatingReport,
    savingReportId,
    deletingReportId,
    savingAgendaItemId,
    deletingAgendaItemId,
    savingMeetingId,
    deletingMeetingId,
    creatingAgendaForReportId,
    creatingMeetingForReportId,
    completingMeetingForReportId,
    handleCreateReport,
    handleSaveReport,
    handleDeleteReport,
    handleCreateAgendaItem,
    handleUpdateAgendaItem,
    handleDeleteAgendaItem,
    handleCreateMeeting,
    handleCompleteMeeting,
    handleUpdateMeeting,
    handleDeleteMeeting,
  };
}
