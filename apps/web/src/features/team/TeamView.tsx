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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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

  async function handleCreateSubmit() {
    await handleCreateReport();
    if (isDirectReportConfigReady) {
      setIsCreateModalOpen(false);
    }
  }

  return (
    <section className="panel admin-panel">
      <SectionHeader
        wide
        eyebrow="Manager Workspace"
        title="Team"
        leading={<TodayCalendarBadge month={todayBadge.month} day={todayBadge.day} weekday={todayBadge.weekday} />}
        actions={<span>Manage your direct reports and their standing 1:1 cadence here.</span>}
      />

      <section className="admin-form-panel">
        <div className="section-heading">
          <SectionHeaderLead>
            <p className="eyebrow">Your team</p>
            <h2>Team members</h2>
          </SectionHeaderLead>
          <div className="admin-user-actions">
            {selectedReportId ? (
              <button
                className="ghost-button"
                type="button"
                onClick={() => setSelectedReportId(null)}
              >
                Minimize all
              </button>
            ) : null}
            <button
              className="primary-button"
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              disabled={!isDirectReportConfigReady}
            >
              Add team member
            </button>
          </div>
        </div>

        {!isDirectReportConfigReady ? (
          <div className="empty-state">
            <p>Team member options are not configured yet.</p>
            <span>Add direct report names and roles in Admin first.</span>
          </div>
        ) : null}

        {directReports.length > 0 ? (
          <div className="admin-users-list">
            {directReports.map((report) => {
              const isExpanded = selectedReportId === report.id;

              return (
                <article key={report.id} className={`admin-user-card ${isExpanded ? "is-selected-report" : ""}`}>
                  <div className="admin-user-top">
                    <div>
                      <h3>{report.reportName}</h3>
                      <div className="admin-user-meta">
                        <span>{report.role}</span>
                        <span>{cadenceOptions.find((option) => option.value === report.cadence)?.label}</span>
                        <span>
                          {report.nextMeetingAt
                            ? formatReceivedLabel(report.nextMeetingAt)
                            : "No meeting scheduled"}
                        </span>
                      </div>
                    </div>
                    <div className="admin-user-actions">
                      <button
                        className="ghost-button compact"
                        type="button"
                        onClick={() => setSelectedReportId(isExpanded ? null : report.id)}
                      >
                        {isExpanded ? "Close" : "Open"}
                      </button>
                    </div>
                  </div>

                  {isExpanded ? (
                    <form
                      className="task-form"
                      style={{ marginTop: "16px" }}
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleSaveReport(report.id, reportDraft).then(() => {
                          setSelectedReportId(null);
                        });
                      }}
                    >
                      <label>
                        Name
                        <AppSelect
                          ariaLabel="Selected team member name"
                          className="app-select"
                          menuClassName="app-select-menu"
                          value={reportDraft.reportName}
                          options={reportDraftNameOptions}
                          onChange={(value) => setReportDraft((current) => ({ ...current, reportName: value }))}
                          disabled={!isDirectReportConfigReady}
                        />
                      </label>

                      <label>
                        Role
                        <AppSelect
                          ariaLabel="Selected team member role"
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
                          ariaLabel="Selected team member cadence"
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
                        Email
                        <input
                          type="email"
                          value={reportDraft.reportEmail}
                          onChange={(event) => setReportDraft((current) => ({ ...current, reportEmail: event.target.value }))}
                          placeholder="optional"
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
                          disabled={deletingReportId === report.id}
                          onClick={() => void handleDeleteReport(report.id)}
                        >
                          {deletingReportId === report.id ? "Deleting..." : "Delete"}
                        </button>
                        <button
                          className="primary-button"
                          type="submit"
                          disabled={savingReportId === report.id || !isDirectReportConfigReady}
                        >
                          {savingReportId === report.id ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <p>No team members yet.</p>
            <span>Use the button above to add your first direct report.</span>
          </div>
        )}
      </section>

      {isCreateModalOpen ? (
        <div className="modal-backdrop" onClick={() => setIsCreateModalOpen(false)} role="presentation">
          <div className="modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <p className="modal-eyebrow">Team setup</p>
                <h2>Add team member</h2>
              </div>
              <button className="ghost-button compact" type="button" onClick={() => setIsCreateModalOpen(false)}>
                Close
              </button>
            </div>

            <form
              className="modal-shell"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateSubmit();
              }}
            >
              <div className="modal-scroll">
                <div className="task-form modal-form">
                  <label>
                    Name
                    <AppSelect
                      ariaLabel="Team member name"
                      className="app-select"
                      menuClassName="app-select-menu"
                      value={createForm.reportName}
                      options={directReportNameSelectOptions}
                      onChange={(value) => setCreateForm((current) => ({ ...current, reportName: value }))}
                      disabled={!isDirectReportConfigReady}
                    />
                  </label>

                  <label>
                    Role
                    <AppSelect
                      ariaLabel="Team member role"
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
                      ariaLabel="Team member cadence"
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
                    Email
                    <input
                      type="email"
                      value={createForm.reportEmail}
                      onChange={(event) => setCreateForm((current) => ({ ...current, reportEmail: event.target.value }))}
                      placeholder="optional"
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
                </div>
              </div>

              <div className="modal-actions modal-actions-bar">
                <div className="modal-actions-left" />
                <div className="modal-actions-right">
                  <button className="ghost-button" type="button" onClick={() => setIsCreateModalOpen(false)}>
                    Cancel
                  </button>
                  <button className="primary-button" type="submit" disabled={isCreatingReport || !isDirectReportConfigReady}>
                    {isCreatingReport ? "Creating..." : "Add team member"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
