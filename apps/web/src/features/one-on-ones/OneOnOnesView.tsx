import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import type { DirectReport, OneOnOneCadence, OneOnOneMeetingStatus } from "../../api";
import { SectionHeader, SectionHeaderLead } from "../../components/layout/SectionHeader";
import { AppSelect } from "../../components/ui/AppSelect";
import { TodayCalendarBadge } from "../../components/ui/TodayCalendarBadge";
import { formatReceivedLabel } from "../../lib/formatters";
import { useOneOnOneActions } from "./useOneOnOneActions";

const cadenceOptions: Array<{ value: OneOnOneCadence; label: string }> = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "ad-hoc", label: "Ad hoc" },
];

const meetingStatusOptions: Array<{ value: OneOnOneMeetingStatus; label: string }> = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" },
];

function toLocalDateTime(value: string | null) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 16);
}

function includeCurrentOption(options: Array<{ value: string; label: string }>, currentValue: string) {
  const normalized = currentValue.trim();
  if (!normalized || options.some((option) => option.value === normalized)) {
    return options;
  }

  return [{ value: normalized, label: normalized }, ...options];
}

export function OneOnOnesView({
  directReports,
  setDirectReports,
  directReportNameOptions,
  directReportRoleOptions,
  todayBadge,
  onError,
}: {
  directReports: DirectReport[];
  setDirectReports: Dispatch<SetStateAction<DirectReport[]>>;
  directReportNameOptions: string[];
  directReportRoleOptions: string[];
  todayBadge: { month: string; day: number; weekday: string };
  onError: (message: string | null) => void;
}) {
  const {
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
    completingMeetingForReportId,
    handleCreateReport,
    handleSaveReport,
    handleDeleteReport,
    handleCreateAgendaItem,
    handleUpdateAgendaItem,
    handleDeleteAgendaItem,
    handleCompleteMeeting,
    handleUpdateMeeting,
    handleDeleteMeeting,
  } = useOneOnOneActions({
    directReports,
    setDirectReports,
    onError,
  });

  const selectedReport = useMemo(
    () => directReports.find((report) => report.id === selectedReportId) ?? null,
    [directReports, selectedReportId],
  );

  const [reportDraft, setReportDraft] = useState({
    reportName: "",
    reportEmail: "",
    role: "",
    cadence: "weekly" as OneOnOneCadence,
    nextMeetingAt: "",
    notes: "",
  });
  const [agendaDraft, setAgendaDraft] = useState("");
  const [agendaIsPrivate, setAgendaIsPrivate] = useState(true);
  const [newMeetingReportId, setNewMeetingReportId] = useState("");
  const [newMeetingScheduledFor, setNewMeetingScheduledFor] = useState("");
  const [newMeetingDetails, setNewMeetingDetails] = useState("");
  const [newMeetingNextActions, setNewMeetingNextActions] = useState("");
  const [meetingDrafts, setMeetingDrafts] = useState<
    Record<string, { scheduledFor: string; status: OneOnOneMeetingStatus; sharedNotes: string; privateNotes: string }>
  >({});
  const isDirectReportConfigReady = directReportNameOptions.length > 0 && directReportRoleOptions.length > 0;
  const directReportNameSelectOptions = useMemo(
    () => directReportNameOptions.map((value) => ({ value, label: value })),
    [directReportNameOptions],
  );
  const directReportRoleSelectOptions = useMemo(
    () => directReportRoleOptions.map((value) => ({ value, label: value })),
    [directReportRoleOptions],
  );
  const reportDraftNameOptions = useMemo(
    () => includeCurrentOption(directReportNameSelectOptions, reportDraft.reportName),
    [directReportNameSelectOptions, reportDraft.reportName],
  );
  const reportDraftRoleOptions = useMemo(
    () => includeCurrentOption(directReportRoleSelectOptions, reportDraft.role),
    [directReportRoleSelectOptions, reportDraft.role],
  );
  const directReportSelectionOptions = useMemo(
    () =>
      directReports.map((report) => ({
        value: report.id,
        label: `${report.reportName} - ${report.role || "No role"}`,
      })),
    [directReports],
  );
  const newMeetingReport = useMemo(
    () => directReports.find((report) => report.id === newMeetingReportId) ?? null,
    [directReports, newMeetingReportId],
  );

  useEffect(() => {
    if (!selectedReport) {
      setReportDraft({
        reportName: "",
        reportEmail: "",
        role: "",
        cadence: "weekly",
        nextMeetingAt: "",
        notes: "",
      });
      return;
    }

    setReportDraft({
      reportName: selectedReport.reportName,
      reportEmail: selectedReport.reportEmail ?? "",
      role: selectedReport.role,
      cadence: selectedReport.cadence,
      nextMeetingAt: toLocalDateTime(selectedReport.nextMeetingAt),
      notes: selectedReport.notes,
    });
  }, [selectedReport]);

  useEffect(() => {
    if (!selectedReport) {
      setMeetingDrafts({});
      return;
    }

    const nextDrafts: Record<string, { scheduledFor: string; status: OneOnOneMeetingStatus; sharedNotes: string; privateNotes: string }> = {};
    selectedReport.meetings.forEach((meeting) => {
      nextDrafts[meeting.id] = {
        scheduledFor: toLocalDateTime(meeting.scheduledFor),
        status: meeting.status,
        sharedNotes: meeting.sharedNotes,
        privateNotes: meeting.privateNotes,
      };
    });
    setMeetingDrafts(nextDrafts);
  }, [selectedReport]);

  useEffect(() => {
    if (!directReportNameSelectOptions.length || createForm.reportName) {
      return;
    }

    setCreateForm((current) => ({ ...current, reportName: directReportNameSelectOptions[0].value }));
  }, [createForm.reportName, directReportNameSelectOptions]);

  useEffect(() => {
    if (!directReportRoleSelectOptions.length || createForm.role) {
      return;
    }

    setCreateForm((current) => ({ ...current, role: directReportRoleSelectOptions[0].value }));
  }, [createForm.role, directReportRoleSelectOptions]);

  useEffect(() => {
    if (!directReportSelectionOptions.length) {
      setNewMeetingReportId("");
      return;
    }

    if (!newMeetingReportId || !directReports.some((report) => report.id === newMeetingReportId)) {
      setNewMeetingReportId(directReportSelectionOptions[0].value);
    }
  }, [directReportSelectionOptions, directReports, newMeetingReportId]);

  useEffect(() => {
    if (newMeetingScheduledFor) {
      return;
    }

    setNewMeetingScheduledFor(new Date().toISOString().slice(0, 16));
  }, [newMeetingScheduledFor]);

  return (
    <section className="panel admin-panel">
      <SectionHeader
        wide
        eyebrow="Manager Workspace"
        title="1:1s and direct reports"
        leading={<TodayCalendarBadge month={todayBadge.month} day={todayBadge.day} weekday={todayBadge.weekday} />}
        actions={<span>Private notes stay tied to your account in the current workspace.</span>}
      />

      <div className="one-on-one-grid">
        <section className="admin-form-panel">
          <div className="section-heading">
            <SectionHeaderLead>
              <p className="eyebrow">New meeting</p>
              <h2>Create new 1:1</h2>
            </SectionHeaderLead>
          </div>

          <form
            className="task-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!newMeetingReportId) {
                onError("Select a direct report first.");
                return;
              }

              const nextActionItems = newMeetingNextActions
                .split("\n")
                .map((item) => item.trim())
                .filter((item) => item.length > 0);

              void handleCompleteMeeting(
                newMeetingReportId,
                newMeetingScheduledFor,
                newMeetingDetails,
                nextActionItems,
              ).then(() => {
                setNewMeetingDetails("");
                setNewMeetingNextActions("");
              });
            }}
          >
            <label>
              Direct report name
              <AppSelect
                ariaLabel="1:1 direct report"
                className="app-select"
                menuClassName="app-select-menu"
                value={newMeetingReportId}
                options={directReportSelectionOptions}
                onChange={setNewMeetingReportId}
                disabled={directReports.length === 0}
              />
            </label>

            <label>
              Meeting date and time
              <input
                type="datetime-local"
                value={newMeetingScheduledFor}
                onChange={(event) => setNewMeetingScheduledFor(event.target.value)}
                required
              />
            </label>

            <div className="detail-card">
              <strong>Action items from last 1:1</strong>
              {newMeetingReport?.standingItems.filter((item) => !item.completedAt).length ? (
                <ul className="detail-list-inline">
                  {newMeetingReport.standingItems
                    .filter((item) => !item.completedAt)
                    .map((item) => (
                      <li key={item.id}>{item.body}</li>
                    ))}
                </ul>
              ) : (
                <p>No open action items are carrying forward.</p>
              )}
            </div>

            <label>
              Details for this meeting
              <textarea
                rows={5}
                value={newMeetingDetails}
                onChange={(event) => setNewMeetingDetails(event.target.value)}
                placeholder="Discussion notes, decisions, feedback, blockers..."
              />
            </label>

            <label>
              Complete before next 1:1
              <textarea
                rows={5}
                value={newMeetingNextActions}
                onChange={(event) => setNewMeetingNextActions(event.target.value)}
                placeholder={"One action item per line"}
              />
            </label>

            <div className="admin-form-actions">
              <button className="primary-button" type="submit" disabled={completingMeetingForReportId === newMeetingReportId || directReports.length === 0}>
                {completingMeetingForReportId === newMeetingReportId ? "Creating..." : "Create 1:1"}
              </button>
            </div>
          </form>

          {directReports.length === 0 ? (
            <div className="detail-card">
              <p>Add a direct report in the panel on the right before creating a 1:1.</p>
            </div>
          ) : null}
        </section>

        <section className="admin-form-panel">
          <div className="section-heading">
            <SectionHeaderLead>
              <p className="eyebrow">Your team</p>
              <h2>Direct reports</h2>
            </SectionHeaderLead>
          </div>

          <div className="admin-users-list">
            {directReports.length > 0 ? (
              directReports.map((report) => (
                <article
                  key={report.id}
                  className={`admin-user-card ${selectedReportId === report.id ? "is-selected-report" : ""}`}
                >
                  <div className="admin-user-top">
                    <div>
                      <h3>{report.reportName}</h3>
                      <p>{report.reportEmail || "No email saved"}</p>
                      <div className="admin-user-meta">
                        <span>{report.role}</span>
                        <span>{cadenceOptions.find((option) => option.value === report.cadence)?.label}</span>
                        <span>
                          {report.nextMeetingAt
                            ? `Next: ${formatReceivedLabel(report.nextMeetingAt)}`
                            : "No meeting scheduled"}
                        </span>
                      </div>
                    </div>
                    <div className="admin-user-actions">
                      <button className="ghost-button compact" type="button" onClick={() => setSelectedReportId(report.id)}>
                        Open
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <p>No direct reports yet.</p>
                <span>Add the first one below.</span>
              </div>
            )}
          </div>

          <form
            className="task-form"
            style={{ marginTop: "16px" }}
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateReport();
            }}
          >
            <label>
              Direct report name
              <AppSelect
                ariaLabel="Direct report name"
                className="app-select"
                menuClassName="app-select-menu"
                value={createForm.reportName}
                options={directReportNameSelectOptions}
                onChange={(value) => setCreateForm((current) => ({ ...current, reportName: value }))}
                disabled={!isDirectReportConfigReady}
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={createForm.reportEmail}
                onChange={(event) => setCreateForm((current) => ({ ...current, reportEmail: event.target.value }))}
                placeholder="optional"
              />
            </label>

            <label>
              Role
              <AppSelect
                ariaLabel="Direct report role"
                className="app-select"
                menuClassName="app-select-menu"
                value={createForm.role}
                options={directReportRoleSelectOptions}
                onChange={(value) => setCreateForm((current) => ({ ...current, role: value }))}
                disabled={!isDirectReportConfigReady}
              />
            </label>

            <label>
              Cadence
              <AppSelect
                ariaLabel="Meeting cadence"
                className="app-select"
                menuClassName="app-select-menu"
                value={createForm.cadence}
                options={cadenceOptions}
                onChange={(value) =>
                  setCreateForm((current) => ({ ...current, cadence: value as OneOnOneCadence }))
                }
              />
            </label>

            <label>
              Next meeting
              <input
                type="datetime-local"
                value={createForm.nextMeetingAt}
                onChange={(event) => setCreateForm((current) => ({ ...current, nextMeetingAt: event.target.value }))}
              />
            </label>

            <label>
              Notes
              <textarea
                rows={4}
                value={createForm.notes}
                onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Context, goals, support areas, coaching notes..."
              />
            </label>

            <div className="admin-form-actions">
              <button className="primary-button" type="submit" disabled={isCreatingReport || !isDirectReportConfigReady}>
                {isCreatingReport ? "Creating..." : "Add direct report"}
              </button>
            </div>
          </form>
        </section>
      </div>

      {selectedReport && (
        <div className="one-on-one-grid">
          <section className="admin-form-panel">
            <div className="section-heading">
              <SectionHeaderLead>
                <p className="eyebrow">Relationship details</p>
                <h2>{selectedReport.reportName}</h2>
              </SectionHeaderLead>
            </div>

            <form
              className="task-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveReport(selectedReport.id, reportDraft);
              }}
            >
              <label>
                Direct report name
                <AppSelect
                  ariaLabel="Selected direct report name"
                  className="app-select"
                  menuClassName="app-select-menu"
                  value={reportDraft.reportName}
                  options={reportDraftNameOptions}
                  onChange={(value) => setReportDraft((current) => ({ ...current, reportName: value }))}
                  disabled={!isDirectReportConfigReady}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={reportDraft.reportEmail}
                  onChange={(event) => setReportDraft((current) => ({ ...current, reportEmail: event.target.value }))}
                  placeholder="optional"
                />
              </label>
              <label>
                Role
                <AppSelect
                  ariaLabel="Selected direct report role"
                  className="app-select"
                  menuClassName="app-select-menu"
                  value={reportDraft.role}
                  options={reportDraftRoleOptions}
                  onChange={(value) => setReportDraft((current) => ({ ...current, role: value }))}
                  disabled={!isDirectReportConfigReady}
                />
              </label>
              <label>
                Cadence
                <AppSelect
                  ariaLabel="Direct report cadence"
                  className="app-select"
                  menuClassName="app-select-menu"
                  value={reportDraft.cadence}
                  options={cadenceOptions}
                  onChange={(value) => setReportDraft((current) => ({ ...current, cadence: value as OneOnOneCadence }))}
                />
              </label>
              <label>
                Next meeting
                <input
                  type="datetime-local"
                  value={reportDraft.nextMeetingAt}
                  onChange={(event) => setReportDraft((current) => ({ ...current, nextMeetingAt: event.target.value }))}
                />
              </label>
              <label>
                Private notes
                <textarea
                  rows={5}
                  value={reportDraft.notes}
                  onChange={(event) => setReportDraft((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>
              <div className="admin-form-actions">
                <button className="ghost-button danger-button" type="button" disabled={deletingReportId === selectedReport.id} onClick={() => void handleDeleteReport(selectedReport.id)}>
                  {deletingReportId === selectedReport.id ? "Deleting..." : "Delete"}
                </button>
                <button className="primary-button" type="submit" disabled={savingReportId === selectedReport.id || !isDirectReportConfigReady}>
                  {savingReportId === selectedReport.id ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </section>

          <section className="admin-form-panel">
            <div className="section-heading">
              <SectionHeaderLead>
                <p className="eyebrow">Carry-forward</p>
                <h2>Action items from last 1:1</h2>
              </SectionHeaderLead>
            </div>

            <form
              className="task-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateAgendaItem(selectedReport.id, agendaDraft, agendaIsPrivate).then(() => {
                  setAgendaDraft("");
                  setAgendaIsPrivate(true);
                });
              }}
            >
              <label>
                Topic
                <textarea rows={3} value={agendaDraft} onChange={(event) => setAgendaDraft(event.target.value)} required />
              </label>
              <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input type="checkbox" checked={agendaIsPrivate} onChange={(event) => setAgendaIsPrivate(event.target.checked)} />
                Private to me
              </label>
              <div className="admin-form-actions">
                <button className="primary-button" type="submit" disabled={creatingAgendaForReportId === selectedReport.id}>
                  {creatingAgendaForReportId === selectedReport.id ? "Adding..." : "Add action item"}
                </button>
              </div>
            </form>

            <div className="task-detail-list admin-compact-list" style={{ marginTop: "16px" }}>
              {selectedReport.standingItems.length > 0 ? (
                selectedReport.standingItems.map((item) => (
                  <article key={item.id} className="detail-card">
                    <div className="detail-card-top">
                      <strong>{item.body}</strong>
                      <span>{item.isPrivate ? "Private" : "Shared"}</span>
                    </div>
                    <div className="admin-user-actions admin-user-actions-row">
                      <button
                        className="ghost-button compact"
                        type="button"
                        disabled={savingAgendaItemId === item.id}
                        onClick={() =>
                          void handleUpdateAgendaItem(item.id, selectedReport.id, item.body, item.isPrivate, !item.completedAt)
                        }
                      >
                        {savingAgendaItemId === item.id
                          ? "Saving..."
                          : item.completedAt
                            ? "Mark open"
                            : "Mark done"}
                      </button>
                      <button
                        className="ghost-button compact danger-button"
                        type="button"
                        disabled={deletingAgendaItemId === item.id}
                        onClick={() => void handleDeleteAgendaItem(item.id, selectedReport.id)}
                      >
                        {deletingAgendaItemId === item.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="detail-empty">No standing topics yet.</div>
              )}
            </div>
          </section>
        </div>
      )}

      {selectedReport && (
        <section className="admin-form-panel admin-form-panel-wide">
          <div className="section-heading">
            <SectionHeaderLead>
              <p className="eyebrow">Meetings</p>
              <h2>1:1 history</h2>
            </SectionHeaderLead>
          </div>

          <div className="task-detail-list admin-detail-list" style={{ marginTop: "16px" }}>
            {selectedReport.meetings.length > 0 ? (
              selectedReport.meetings.map((meeting) => {
                const draft = meetingDrafts[meeting.id];
                if (!draft) {
                  return null;
                }

                return (
                  <article key={meeting.id} className="detail-card">
                    <div className="detail-card-top">
                      <strong>{new Date(meeting.scheduledFor).toLocaleString()}</strong>
                      <span>{meeting.status}</span>
                    </div>
                    <div className="admin-user-meta" style={{ marginBottom: "12px" }}>
                      <span>{meeting.priorActionItems.length} action items brought in</span>
                      <span>{meeting.nextActionItems.length} action items assigned out</span>
                    </div>
                    <div className="task-form">
                      <label>
                        Scheduled for
                        <input
                          type="datetime-local"
                          value={draft.scheduledFor}
                          onChange={(event) =>
                            setMeetingDrafts((current) => ({
                              ...current,
                              [meeting.id]: { ...draft, scheduledFor: event.target.value },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Status
                        <AppSelect
                          ariaLabel="Meeting status"
                          className="app-select"
                          menuClassName="app-select-menu"
                          value={draft.status}
                          options={meetingStatusOptions}
                          onChange={(value) =>
                            setMeetingDrafts((current) => ({
                              ...current,
                              [meeting.id]: { ...draft, status: value as OneOnOneMeetingStatus },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Meeting details
                        <textarea
                          rows={4}
                          value={draft.sharedNotes}
                          onChange={(event) =>
                            setMeetingDrafts((current) => ({
                              ...current,
                              [meeting.id]: { ...draft, sharedNotes: event.target.value },
                            }))
                          }
                        />
                      </label>
                      <div className="detail-card">
                        <strong>Action items from last 1:1</strong>
                        {meeting.priorActionItems.length ? (
                          <ul className="detail-list-inline">
                            {meeting.priorActionItems.map((item, index) => (
                              <li key={`${meeting.id}-prior-${index}`}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>No carry-forward items.</p>
                        )}
                      </div>
                      <div className="detail-card">
                        <strong>Complete before next 1:1</strong>
                        {meeting.nextActionItems.length ? (
                          <ul className="detail-list-inline">
                            {meeting.nextActionItems.map((item, index) => (
                              <li key={`${meeting.id}-next-${index}`}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>No follow-up items were saved.</p>
                        )}
                      </div>
                      <label>
                        Private notes
                        <textarea
                          rows={4}
                          value={draft.privateNotes}
                          onChange={(event) =>
                            setMeetingDrafts((current) => ({
                              ...current,
                              [meeting.id]: { ...draft, privateNotes: event.target.value },
                            }))
                          }
                        />
                      </label>
                    </div>
                    <div className="admin-user-meta">
                      <span>Updated {formatReceivedLabel(meeting.updatedAt)}</span>
                    </div>
                    <div className="admin-form-actions">
                      <button
                        className="ghost-button compact danger-button"
                        type="button"
                        disabled={deletingMeetingId === meeting.id}
                        onClick={() => void handleDeleteMeeting(meeting.id, selectedReport.id)}
                      >
                        {deletingMeetingId === meeting.id ? "Deleting..." : "Delete"}
                      </button>
                      <button
                        className="primary-button compact"
                        type="button"
                        disabled={savingMeetingId === meeting.id}
                        onClick={() =>
                          void handleUpdateMeeting(
                            meeting.id,
                            selectedReport.id,
                            draft.scheduledFor,
                            draft.status,
                            draft.sharedNotes,
                            draft.privateNotes,
                          )
                        }
                      >
                        {savingMeetingId === meeting.id ? "Saving..." : "Save meeting"}
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="detail-empty">No meetings yet.</div>
            )}
          </div>
        </section>
      )}
    </section>
  );
}
