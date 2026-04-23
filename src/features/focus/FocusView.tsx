import type { Task, TaskStatus, TodayItem } from "../../api";
import { SectionHeader } from "../../components/layout/SectionHeader";
import { TodayCalendarBadge } from "../../components/ui/TodayCalendarBadge";
import { AgendaItemCard } from "../agenda/AgendaItemCard";

type FocusViewProps = {
  focusedItem: TodayItem | null;
  nextFocusItem: TodayItem | null;
  todayBadge: { month: string; day: number; weekday: string };
  isAllWorkspacesMode: boolean;
  getItemWorkspaceLabel: (item: TodayItem | Task) => string | null;
  formatDueLabel: (value: string) => string;
  formatReminderLabel: (value: string | null) => string;
  getTodayReason: (item: TodayItem) => string;
  onExitFocus: () => void;
  onStatusChange: (item: TodayItem, status: TaskStatus) => void;
  onSkip: (item: TodayItem) => void;
  onSnooze: (item: TodayItem) => void;
};

export function FocusView({
  focusedItem,
  nextFocusItem,
  todayBadge,
  isAllWorkspacesMode,
  getItemWorkspaceLabel,
  formatDueLabel,
  formatReminderLabel,
  getTodayReason,
  onExitFocus,
  onStatusChange,
  onSkip,
  onSnooze,
}: FocusViewProps) {
  if (!focusedItem) {
    return (
      <section className="panel today-panel">
        <SectionHeader
          wide
          eyebrow="Focus Mode"
          title="No focused task"
          leading={<TodayCalendarBadge month={todayBadge.month} day={todayBadge.day} size="sm" showWeekday={false} />}
          actions={
            <button className="ghost-button" type="button" onClick={onExitFocus}>
              Back to agenda
            </button>
          }
        />
        <div className="empty-state today-empty">
          <p>Your focused item is no longer on today’s agenda.</p>
          <span>Pick another item from Agenda to continue working in focus mode.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="panel today-panel">
      <SectionHeader
        wide
        eyebrow="Focus Mode"
        title={focusedItem.title}
        leading={<TodayCalendarBadge month={todayBadge.month} day={todayBadge.day} size="sm" showWeekday={false} />}
        actions={
          <>
            <span>{getTodayReason(focusedItem)}</span>
            <button className="ghost-button" type="button" onClick={onExitFocus}>
              Back to agenda
            </button>
          </>
        }
      />

      <div className="agenda-section-block">
        <div className="focus-mode-layout">
          <div className="focus-mode-card">
            <AgendaItemCard
              item={focusedItem}
              focusedKey={`${focusedItem.sourceType}:${focusedItem.id}`}
              isAllWorkspacesMode={isAllWorkspacesMode}
              getItemWorkspaceLabel={getItemWorkspaceLabel}
              formatDueLabel={formatDueLabel}
              formatReminderLabel={formatReminderLabel}
              getTodayReason={getTodayReason}
              onStatusChange={onStatusChange}
              onSkip={onSkip}
              onSnooze={onSnooze}
            />
          </div>
        </div>
      </div>

      {nextFocusItem && (
        <div
          className="focus-next-preview focus-next-preview-bottom"
          style={{
            marginTop: "20px",
            padding: "14px 16px",
            borderRadius: "16px",
            background: "#ffffff",
            border: "1px solid rgba(89, 108, 122, 0.18)",
            boxShadow: "0 6px 16px rgba(15, 23, 42, 0.08)",
          }}
        >
          <p className="eyebrow" style={{ marginBottom: "6px" }}>
            Up next
          </p>
          <strong style={{ fontSize: "15px" }}>{nextFocusItem.title}</strong>
          <div className="today-meta" style={{ marginTop: "6px" }}>
            <span>{getTodayReason(nextFocusItem)}</span>
            <span>Due: {formatDueLabel(nextFocusItem.dueDate)}</span>
          </div>
        </div>
      )}
    </section>
  );
}
