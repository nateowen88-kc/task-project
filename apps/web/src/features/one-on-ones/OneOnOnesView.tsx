import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import type { DirectReport, OneOnOneMeetingStatus, Task } from "../../api";
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

const WIN_KEYWORDS = ["win", "won", "shipped", "launched", "completed", "closed", "resolved", "improved", "progress"];
const RISK_KEYWORDS = ["blocked", "blocker", "risk", "stuck", "delay", "behind", "issue", "concern", "slip"];
const DECISION_KEYWORDS = ["decision", "decide", "approval", "approve", "input", "escalate", "alignment", "tradeoff"];

function toLocalDateTime(value: string | null) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 16);
}

function dedupeStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function extractNoteLines(...blocks: Array<string | null | undefined>) {
  return dedupeStrings(
    blocks.flatMap((block) =>
      (block ?? "")
        .split(/\n+/)
        .flatMap((line) => line.split(/(?<=[.!?])\s+/))
        .map((line) => line.replace(/^[-*•]\s*/, "").trim())
        .filter((line) => line.length > 0),
    ),
  );
}

function matchesKeyword(line: string, keywords: string[]) {
  const normalized = line.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function formatActionItem(task: DirectReport["openActionItems"][number]) {
  const labels: string[] = [];
  if (task.status === "blocked") {
    labels.push("blocked");
  }
  labels.push(`due ${formatReceivedLabel(task.dueDate)}`);

  return `${task.details || task.title} (${labels.join(", ")})`;
}

function buildGeneratedAgenda(report: DirectReport | null) {
  if (!report) {
    return {
      wins: [] as string[],
      risks: [] as string[],
      decisionsNeeded: [] as string[],
      followUps: [] as string[],
      recentNotes: [] as string[],
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const incompleteStandingItems = report.standingItems
    .filter((item) => item.completedAt === null)
    .map((item) => item.body);
  const completedStandingItems = report.standingItems
    .filter((item) => item.completedAt !== null)
    .sort((left, right) => new Date(right.completedAt ?? 0).getTime() - new Date(left.completedAt ?? 0).getTime())
    .slice(0, 3)
    .map((item) => item.body);
  const overdueTasks = report.openActionItems.filter((task) => task.dueDate < today);
  const blockedTasks = report.openActionItems.filter((task) => task.status === "blocked");
  const recentMeetings = report.meetings.slice(0, 3);
  const recentNoteLines = extractNoteLines(
    report.notes,
    ...recentMeetings.flatMap((meeting) => [meeting.sharedNotes, meeting.privateNotes]),
  );

  const wins = dedupeStrings([
    ...completedStandingItems,
    ...recentNoteLines.filter((line) => matchesKeyword(line, WIN_KEYWORDS)),
  ]).slice(0, 6);

  const risks = dedupeStrings([
    ...blockedTasks.map(formatActionItem),
    ...overdueTasks.map(formatActionItem),
    ...recentNoteLines.filter((line) => matchesKeyword(line, RISK_KEYWORDS)),
  ]).slice(0, 6);

  const decisionsNeeded = dedupeStrings(
    recentNoteLines.filter((line) => matchesKeyword(line, DECISION_KEYWORDS)),
  ).slice(0, 6);

  const followUps = dedupeStrings([
    ...report.openActionItems.map(formatActionItem),
    ...incompleteStandingItems,
    ...recentMeetings.flatMap((meeting) => meeting.nextActionItems),
  ]).slice(0, 8);

  return {
    wins,
    risks,
    decisionsNeeded,
    followUps,
    recentNotes: recentNoteLines.slice(0, 6),
  };
}

function buildAgendaDetailsText(agenda: ReturnType<typeof buildGeneratedAgenda>) {
  const sections = [
    { title: "Wins", items: agenda.wins },
    { title: "Risks", items: agenda.risks },
    { title: "Decisions needed", items: agenda.decisionsNeeded },
    { title: "Follow-ups", items: agenda.followUps },
    { title: "Recent notes", items: agenda.recentNotes },
  ].filter((section) => section.items.length > 0);

  return sections
    .map((section) => `${section.title}\n${section.items.map((item) => `- ${item}`).join("\n")}`)
    .join("\n\n");
}

function buildManagerDigest(directReports: DirectReport[], tasks: Task[]) {
  const today = new Date().toISOString().slice(0, 10);
  const attentionTasks = tasks
    .filter((task) => task.archivedAt === null && task.status !== "done")
    .filter((task) => task.status === "blocked" || task.dueDate <= today)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
    .slice(0, 6)
    .map((task) => {
      const labels = [task.status === "blocked" ? "blocked" : null, `due ${formatReceivedLabel(task.dueDate)}`]
        .filter(Boolean)
        .join(", ");
      return `${task.title} (${task.assigneeName ?? "Unassigned"}; ${labels})`;
    });

  const blockedReports = directReports
    .map((report) => ({
      reportName: report.reportName,
      blockedItems: report.openActionItems.filter((item) => item.status === "blocked"),
    }))
    .filter((entry) => entry.blockedItems.length > 0)
    .map((entry) => `${entry.reportName}: ${entry.blockedItems.map(formatActionItem).slice(0, 2).join("; ")}`);

  const slippedReports = directReports
    .map((report) => ({
      reportName: report.reportName,
      overdueItems: report.openActionItems.filter((item) => item.dueDate < today),
    }))
    .filter((entry) => entry.overdueItems.length > 0)
    .map((entry) => `${entry.reportName}: ${entry.overdueItems.map(formatActionItem).slice(0, 2).join("; ")}`);

  const discussToday = directReports
    .map((report) => {
      const agenda = buildGeneratedAgenda(report);
      const hasMeetingToday = report.nextMeetingAt?.slice(0, 10) === today;
      const keyItems = dedupeStrings([
        ...agenda.risks.slice(0, 2),
        ...agenda.decisionsNeeded.slice(0, 2),
        ...agenda.followUps.slice(0, 2),
      ]).slice(0, 3);

      if (!hasMeetingToday && keyItems.length === 0) {
        return null;
      }

      return `${report.reportName}${hasMeetingToday ? " (meeting today)" : ""}: ${keyItems.join("; ") || "General check-in"}`;
    })
    .filter((value): value is string => Boolean(value))
    .slice(0, 6);

  return {
    attentionTasks,
    blockedReports,
    slippedReports,
    discussToday,
  };
}

export function OneOnOnesView({
  directReports,
  tasks,
  setDirectReports,
  todayBadge,
  onError,
  onOpenTask,
}: {
  directReports: DirectReport[];
  tasks: Task[];
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
  const managerDigest = useMemo(() => buildManagerDigest(directReports, tasks), [directReports, tasks]);
  const generatedAgenda = useMemo(() => buildGeneratedAgenda(selectedReport), [selectedReport]);

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

      <section className="admin-form-panel">
        <div className="section-heading">
          <SectionHeaderLead>
            <p className="eyebrow">Daily manager digest</p>
            <h2>What needs attention today</h2>
          </SectionHeaderLead>
        </div>

        <div className="task-detail-columns">
          <div className="detail-card">
            <strong>Needs your attention</strong>
            {managerDigest.attentionTasks.length ? (
              <ul className="detail-list-inline">
                {managerDigest.attentionTasks.map((item, index) => (
                  <li key={`attention-${index}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>No urgent manager-owned task issues detected.</p>
            )}
          </div>
          <div className="detail-card">
            <strong>Who is blocked</strong>
            {managerDigest.blockedReports.length ? (
              <ul className="detail-list-inline">
                {managerDigest.blockedReports.map((item, index) => (
                  <li key={`blocked-${index}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>No blocked direct reports right now.</p>
            )}
          </div>
          <div className="detail-card">
            <strong>What slipped</strong>
            {managerDigest.slippedReports.length ? (
              <ul className="detail-list-inline">
                {managerDigest.slippedReports.map((item, index) => (
                  <li key={`slipped-${index}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>No slipped follow-ups detected.</p>
            )}
          </div>
          <div className="detail-card">
            <strong>Discuss today</strong>
            {managerDigest.discussToday.length ? (
              <ul className="detail-list-inline">
                {managerDigest.discussToday.map((item, index) => (
                  <li key={`discuss-${index}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>No critical team discussion items queued.</p>
            )}
          </div>
        </div>
      </section>

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

              <div className="detail-card">
                <div className="detail-card-top">
                  <strong>Suggested agenda</strong>
                  <button
                    className="ghost-button compact"
                    type="button"
                    onClick={() => setNewMeetingDetails(buildAgendaDetailsText(generatedAgenda))}
                  >
                    Use in notes
                  </button>
                </div>
                <div className="task-detail-columns">
                  <div className="detail-card">
                    <strong>Wins</strong>
                    {generatedAgenda.wins.length ? (
                      <ul className="detail-list-inline">
                        {generatedAgenda.wins.map((item, index) => (
                          <li key={`win-${index}`}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No recent wins detected yet.</p>
                    )}
                  </div>
                  <div className="detail-card">
                    <strong>Risks</strong>
                    {generatedAgenda.risks.length ? (
                      <ul className="detail-list-inline">
                        {generatedAgenda.risks.map((item, index) => (
                          <li key={`risk-${index}`}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No active risks detected.</p>
                    )}
                  </div>
                  <div className="detail-card">
                    <strong>Decisions needed</strong>
                    {generatedAgenda.decisionsNeeded.length ? (
                      <ul className="detail-list-inline">
                        {generatedAgenda.decisionsNeeded.map((item, index) => (
                          <li key={`decision-${index}`}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No explicit decision items found.</p>
                    )}
                  </div>
                  <div className="detail-card">
                    <strong>Follow-ups</strong>
                    {generatedAgenda.followUps.length ? (
                      <ul className="detail-list-inline">
                        {generatedAgenda.followUps.map((item, index) => (
                          <li key={`followup-${index}`}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No follow-up items yet.</p>
                    )}
                  </div>
                </div>
                {generatedAgenda.recentNotes.length ? (
                  <div className="detail-card" style={{ marginTop: "12px" }}>
                    <strong>Recent notes</strong>
                    <ul className="detail-list-inline">
                      {generatedAgenda.recentNotes.map((item, index) => (
                        <li key={`note-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
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
