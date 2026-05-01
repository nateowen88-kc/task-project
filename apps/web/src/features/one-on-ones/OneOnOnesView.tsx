import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import type { DirectReport, OneOnOneMeetingStatus } from "../../api";
import { SectionHeader, SectionHeaderLead } from "../../components/layout/SectionHeader";
import { AppSelect } from "../../components/ui/AppSelect";
import { TodayCalendarBadge } from "../../components/ui/TodayCalendarBadge";
import { formatReceivedLabel } from "../../lib/formatters";
import { useOneOnOneActions } from "./useOneOnOneActions";

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

export function OneOnOnesView({
  directReports,
  setDirectReports,
  todayBadge,
  onError,
  onOpenTask,
}: {
  directReports: DirectReport[];
  setDirectReports: Dispatch<SetStateAction<DirectReport[]>>;
  todayBadge: { month: string; day: number; weekday: string };
  onError: (message: string | null) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const {
    selectedReportId,
    setSelectedReportId,
    savingMeetingId,
    deletingMeetingId,
    completingMeetingForReportId,
    handleCompleteMeeting,
    handleUpdateMeeting,
    handleDeleteMeeting,
  } = useOneOnOneActions({
    directReports,
    setDirectReports,
    onError,
  });

  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [newMeetingScheduledFor, setNewMeetingScheduledFor] = useState("");
  const [newMeetingDetails, setNewMeetingDetails] = useState("");
  const [newMeetingNextActions, setNewMeetingNextActions] = useState("");
  const [meetingDrafts, setMeetingDrafts] = useState<
    Record<string, { scheduledFor: string; status: OneOnOneMeetingStatus; sharedNotes: string; privateNotes: string }>
  >({});

  const directReportOptions = useMemo(
    () =>
      directReports.map((report) => ({
        value: report.id,
        label: `${report.reportName} - ${report.role || "No role"}`,
      })),
    [directReports],
  );
  const selectedReport = useMemo(
    () => directReports.find((report) => report.id === selectedReportId) ?? null,
    [directReports, selectedReportId],
  );

  useEffect(() => {
    if (!directReportOptions.length) {
      return;
    }

    if (!selectedReportId || !directReports.some((report) => report.id === selectedReportId)) {
      setSelectedReportId(directReportOptions[0].value);
    }
  }, [directReportOptions, directReports, selectedReportId, setSelectedReportId]);

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
    if (newMeetingScheduledFor) {
      return;
    }

    setNewMeetingScheduledFor(
      toLocalDateTime(selectedReport?.nextMeetingAt ?? null) || new Date().toISOString().slice(0, 16),
    );
  }, [newMeetingScheduledFor, selectedReport?.nextMeetingAt]);

  return (
    <section className="panel admin-panel">
      <SectionHeader
        wide
        eyebrow="Manager Workspace"
        title="1:1s"
        leading={<TodayCalendarBadge month={todayBadge.month} day={todayBadge.day} weekday={todayBadge.weekday} />}
        actions={<span>Start a 1:1, capture notes, and turn follow-up items into private tasks.</span>}
      />

      <div className="one-on-one-grid">
        <section className="admin-form-panel">
          <div className="section-heading">
            <SectionHeaderLead>
              <p className="eyebrow">Start a 1:1</p>
              <h2>Select a team member</h2>
            </SectionHeaderLead>
          </div>

          <form
            className="task-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!selectedReportId) {
                onError("Add a direct report in Team before starting a 1:1.");
                return;
              }
              onError(null);
              setIsComposerOpen(true);
            }}
          >
            <label>
              Team member
              <AppSelect
                ariaLabel="Team member"
                className="app-select"
                menuClassName="app-select-menu"
                value={selectedReportId ?? ""}
                options={directReportOptions}
                onChange={setSelectedReportId}
                disabled={directReports.length === 0}
              />
            </label>

            <div className="admin-form-actions">
              <button className="primary-button" type="submit" disabled={!selectedReportId}>
                Start 1:1
              </button>
            </div>
          </form>

          {!selectedReport ? (
            <div className="detail-card">
              <p>Add direct reports in the Team tab before starting a 1:1.</p>
            </div>
          ) : null}
        </section>

        {isComposerOpen && selectedReport ? (
          <section className="admin-form-panel">
            <div className="section-heading">
              <SectionHeaderLead>
                <p className="eyebrow">New 1:1</p>
                <h2>{selectedReport.reportName}</h2>
              </SectionHeaderLead>
            </div>

            <form
              className="task-form"
              onSubmit={(event) => {
                event.preventDefault();
                const nextActionItems = newMeetingNextActions
                  .split("\n")
                  .map((item) => item.trim())
                  .filter((item) => item.length > 0);

                void handleCompleteMeeting(
                  selectedReport.id,
                  newMeetingScheduledFor,
                  newMeetingDetails,
                  nextActionItems,
                ).then(() => {
                  setNewMeetingDetails("");
                  setNewMeetingNextActions("");
                  setNewMeetingScheduledFor("");
                });
              }}
            >
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
                {selectedReport.openActionItems.length ? (
                  <div className="task-detail-list admin-compact-list" style={{ marginTop: "12px" }}>
                    {selectedReport.openActionItems.map((item) => (
                      <article key={item.id} className="detail-card">
                        <div className="detail-card-top">
                          <strong>{item.details || item.title}</strong>
                          <span>due {formatReceivedLabel(item.dueDate)}</span>
                        </div>
                        <div className="admin-user-actions">
                          <button className="ghost-button compact" type="button" onClick={() => onOpenTask(item.id)}>
                            Open task
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p>No unresolved 1:1 action items.</p>
                )}
              </div>

              <label>
                Details for this 1:1
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
                  placeholder="One follow-up item per line"
                />
              </label>

              <div className="admin-form-actions">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setIsComposerOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={completingMeetingForReportId === selectedReport.id}
                >
                  {completingMeetingForReportId === selectedReport.id ? "Saving..." : "Save 1:1"}
                </button>
              </div>
            </form>
          </section>
        ) : null}
      </div>

      {selectedReport && (
        <section className="admin-form-panel admin-form-panel-wide">
          <div className="section-heading">
            <SectionHeaderLead>
              <p className="eyebrow">1:1s</p>
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
                        1:1 details
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
              <div className="detail-empty">No 1:1s have been scheduled yet.</div>
            )}
          </div>
        </section>
      )}
    </section>
  );
}
