import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import type { DirectReport, OneOnOneCadence } from "../../api";
import { SectionHeader, SectionHeaderLead } from "../../components/layout/SectionHeader";
import { AppSelect } from "../../components/ui/AppSelect";
import { TodayCalendarBadge } from "../../components/ui/TodayCalendarBadge";
import { formatReceivedLabel } from "../../lib/formatters";
import { useOneOnOneActions } from "../one-on-ones/useOneOnOneActions";

const cadenceOptions: Array<{ value: OneOnOneCadence; label: string }> = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "ad-hoc", label: "Ad hoc" },
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

export function TeamView({
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
    handleCreateReport,
    handleSaveReport,
    handleDeleteReport,
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
    if (!directReportNameSelectOptions.length || createForm.reportName) {
      return;
    }

    setCreateForm((current) => ({ ...current, reportName: directReportNameSelectOptions[0].value }));
  }, [createForm.reportName, directReportNameSelectOptions, setCreateForm]);

  useEffect(() => {
    if (!directReportRoleSelectOptions.length || createForm.role) {
      return;
    }

    setCreateForm((current) => ({ ...current, role: directReportRoleSelectOptions[0].value }));
  }, [createForm.role, directReportRoleSelectOptions, setCreateForm]);

  return (
    <section className="panel admin-panel">
      <SectionHeader
        wide
        eyebrow="Manager Workspace"
        title="Team"
        leading={<TodayCalendarBadge month={todayBadge.month} day={todayBadge.day} weekday={todayBadge.weekday} />}
        actions={<span>Manage your direct reports and their standing 1:1 cadence here.</span>}
      />

      <div className="one-on-one-grid">
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

        <section className="admin-form-panel">
          <div className="section-heading">
            <SectionHeaderLead>
              <p className="eyebrow">Relationship details</p>
              <h2>{selectedReport?.reportName ?? "Select a direct report"}</h2>
            </SectionHeaderLead>
          </div>

          {selectedReport ? (
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
                <button
                  className="ghost-button danger-button"
                  type="button"
                  disabled={deletingReportId === selectedReport.id}
                  onClick={() => void handleDeleteReport(selectedReport.id)}
                >
                  {deletingReportId === selectedReport.id ? "Deleting..." : "Delete"}
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={savingReportId === selectedReport.id || !isDirectReportConfigReady}
                >
                  {savingReportId === selectedReport.id ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          ) : (
            <div className="empty-state">
              <p>No direct report selected.</p>
              <span>Pick someone from the team list to edit their relationship details.</span>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
