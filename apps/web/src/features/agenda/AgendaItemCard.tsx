import type { Task, TaskStatus, TodayItem } from "../../api";
import { AppSelect } from "../../components/ui/AppSelect";
import { IMPORTANCE_LABELS, RECURRENCE_LABELS, STATUS_LABELS, STATUS_ORDER } from "../tasks/config";

type AgendaItemCardProps = {
  item: TodayItem;
  focusedKey?: string | null;
  isAllWorkspacesMode: boolean;
  getItemWorkspaceLabel: (item: TodayItem | Task) => string | null;
  formatDueLabel: (value: string) => string;
  formatReminderLabel: (value: string | null) => string;
  getTodayReason: (item: TodayItem) => string;
  onStatusChange: (item: TodayItem, status: TaskStatus) => void;
  onFocus?: (item: TodayItem) => void;
  onOpenTask?: (item: TodayItem) => void;
  onSkip: (item: TodayItem) => void;
  onSnooze: (item: TodayItem) => void;
};

export function AgendaItemCard({
  item,
  focusedKey = null,
  isAllWorkspacesMode,
  getItemWorkspaceLabel,
  formatDueLabel,
  formatReminderLabel,
  getTodayReason,
  onStatusChange,
  onFocus,
  onOpenTask,
  onSkip,
  onSnooze,
}: AgendaItemCardProps) {
  const itemKey = `${item.sourceType}:${item.id}`;
  const isFocused = focusedKey === itemKey;
  const canChangeStatus = item.permissions.canChangeStatus;

  return (
    <article
      className={`today-card ${item.status} ${isFocused ? "is-focused" : ""}`}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        border: isFocused ? "2px solid #596C7A" : undefined,
        boxShadow: isFocused
          ? "0 0 0 2px rgba(89,108,122,0.15), 0 8px 20px rgba(15,23,42,0.12)"
          : undefined,
      }}
    >
      <div className="today-card-top" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {isFocused && (
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#ffffff",
                background: "#596C7A",
                padding: "2px 8px",
                borderRadius: "999px",
                marginRight: "8px",
              }}
            >
              🎯 Focus
            </span>
          )}
          {isAllWorkspacesMode && getItemWorkspaceLabel(item) && (
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#24313a",
                background: "rgba(89, 108, 122, 0.12)",
                padding: "2px 8px",
                borderRadius: "999px",
              }}
            >
              {getItemWorkspaceLabel(item)}
            </span>
          )}
          <span className={`today-badge ${item.sourceType}`}>
            {item.sourceType === "occurrence" ? "Recurring" : "Task"}
          </span>
        </div>
        <span className="due-pill">{getTodayReason(item)}</span>
      </div>

      <h3>{item.title}</h3>
      {item.details ? (
        <p>{item.details}</p>
      ) : item.isPrivate ? (
        <p>Private details hidden until you open the task.</p>
      ) : (
        <p>No additional notes yet.</p>
      )}
      {item.agendaReason && (
        <div
          style={{
            marginTop: "10px",
            padding: "10px 12px",
            borderRadius: "14px",
            background: "rgba(89, 108, 122, 0.08)",
            color: "#24313a",
            fontSize: "13px",
            lineHeight: 1.45,
          }}
        >
          <strong>Why this made today&apos;s agenda:</strong> {item.agendaReason}
          {typeof item.agendaConfidence === "number" && (
            <span style={{ display: "block", marginTop: "4px", opacity: 0.72 }}>
              Confidence: {Math.round(item.agendaConfidence * 100)}%
            </span>
          )}
        </div>
      )}

      <div className="today-meta">
        <span>Due: {formatDueLabel(item.dueDate)}</span>
        <span>{formatReminderLabel(item.remindAt)}</span>
        <span>Importance: {IMPORTANCE_LABELS[item.importance]}</span>
        {item.isPrivate && <span>Private</span>}
        <span>Assignee: {item.assigneeName ?? "Unassigned"}</span>
        {item.isRecurring && <span>{RECURRENCE_LABELS[item.recurrenceRule]}</span>}
      </div>

      {item.links.length > 0 && (
        <div className="link-list">
          {item.links.map((link) => (
            <a key={link} href={link} target="_blank" rel="noopener noreferrer">
              {link}
            </a>
          ))}
        </div>
      )}

      <div className="today-actions" style={{ marginTop: "auto" }}>
        <AppSelect
          ariaLabel="Agenda item status"
          className={`app-select status-select ${item.status}`}
          menuClassName="app-select-menu"
          value={item.status}
          disabled={!canChangeStatus}
          options={STATUS_ORDER.map((status) => ({
            value: status,
            label: STATUS_LABELS[status],
          }))}
          onChange={(nextStatus) => onStatusChange(item, nextStatus)}
        />
        {onFocus ? (
          <button className="primary-button compact" type="button" onClick={() => onFocus(item)}>
            Focus
          </button>
        ) : null}
        {onOpenTask ? (
          <button className="ghost-button compact" type="button" onClick={() => onOpenTask(item)}>
            Open task
          </button>
        ) : null}
        {item.sourceType === "occurrence" && (
          <button className="ghost-button compact" type="button" onClick={() => onSkip(item)} disabled={!canChangeStatus}>
            Skip today
          </button>
        )}
        <button className="ghost-button compact" type="button" onClick={() => onSnooze(item)} disabled={!canChangeStatus}>
          Snooze
        </button>
      </div>
    </article>
  );
}
