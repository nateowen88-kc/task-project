import type { Task, TaskStatus, TodayItem } from "../../api";
import { SectionHeader, SectionHeaderLead } from "../../components/layout/SectionHeader";
import { TodayCalendarBadge } from "../../components/ui/TodayCalendarBadge";
import { AgendaItemCard } from "./AgendaItemCard";

type AgendaSection = {
  key: string;
  title: string;
  items: TodayItem[];
};

type AgendaViewProps = {
  todayBadge: { month: string; day: number; weekday: string };
  isAllWorkspacesMode: boolean;
  sortedAgendaItems: TodayItem[];
  focusNowItems: TodayItem[];
  agendaSections: AgendaSection[];
  promotedCount: number;
  isAgendaRefreshing: boolean;
  focusedItemKey: string | null;
  getItemWorkspaceLabel: (item: TodayItem | Task) => string | null;
  formatDueLabel: (value: string) => string;
  formatReminderLabel: (value: string | null) => string;
  getTodayReason: (item: TodayItem) => string;
  onGenerateAgenda: () => void;
  onFocus: (item: TodayItem) => void;
  onOpenTask: (item: TodayItem) => void;
  onStatusChange: (item: TodayItem, status: TaskStatus) => void;
  onSkip: (item: TodayItem) => void;
  onSnooze: (item: TodayItem) => void;
};

export function AgendaView({
  todayBadge,
  isAllWorkspacesMode,
  sortedAgendaItems,
  focusNowItems,
  agendaSections,
  promotedCount,
  isAgendaRefreshing,
  focusedItemKey,
  getItemWorkspaceLabel,
  formatDueLabel,
  formatReminderLabel,
  getTodayReason,
  onGenerateAgenda,
  onFocus,
  onOpenTask,
  onStatusChange,
  onSkip,
  onSnooze,
}: AgendaViewProps) {
  return (
    <section className="panel today-panel">
      <SectionHeader
        wide
        eyebrow="Today In TimeSmith"
        title="Generated daily agenda"
        leading={<TodayCalendarBadge month={todayBadge.month} day={todayBadge.day} weekday={todayBadge.weekday} />}
        actions={
          <>
            <span>
              {promotedCount > 0
                ? `${promotedCount} task(s) promoted into today`
                : "Uses overdue, due today, recurring, and near-term tasks"}
            </span>
            <button className="ghost-button" type="button" onClick={onGenerateAgenda}>
              {isAgendaRefreshing ? "Refreshing..." : "Generate agenda"}
            </button>
          </>
        }
      />
      <div className="today-grid">
        {isAllWorkspacesMode ? (
          <div className="empty-state today-empty">
            <p>Agenda is unavailable in All Workspaces mode.</p>
            <span>Select a specific workspace from the switcher to generate and review that workspace’s agenda.</span>
          </div>
        ) : sortedAgendaItems.length > 0 ? (
          <>
            {focusNowItems.length > 0 && (
              <div className="agenda-section-block">
                <div className="section-heading">
                  <SectionHeaderLead>
                    <p className="eyebrow">Top priority</p>
                    <h2>🎯 Focus Now</h2>
                  </SectionHeaderLead>
                </div>
                <div className="focus-now-row">
                  {focusNowItems.map((item) => (
                    <AgendaItemCard
                      key={`${item.sourceType}:${item.id}`}
                      item={item}
                      focusedKey={focusedItemKey}
                      isAllWorkspacesMode={isAllWorkspacesMode}
                      getItemWorkspaceLabel={getItemWorkspaceLabel}
                      formatDueLabel={formatDueLabel}
                      formatReminderLabel={formatReminderLabel}
                      getTodayReason={getTodayReason}
                      onStatusChange={onStatusChange}
                      onFocus={onFocus}
                      onOpenTask={onOpenTask}
                      onSkip={onSkip}
                      onSnooze={onSnooze}
                    />
                  ))}
                </div>
              </div>
            )}

            {agendaSections.filter((section) => section.items.length > 0).length > 0 && (
              <div className="agenda-buckets-grid">
                {agendaSections
                  .filter((section) => section.items.length > 0)
                  .map((section) => (
                    <div key={section.key} className="agenda-bucket-column">
                      <div className="section-heading agenda-bucket-heading">
                        {section.key === "today" ? (
                          <SectionHeaderLead
                            leading={<TodayCalendarBadge month={todayBadge.month} day={todayBadge.day} size="sm" showWeekday={false} />}
                          >
                            <h2>Today</h2>
                          </SectionHeaderLead>
                        ) : (
                          <SectionHeaderLead>
                            <h2>{section.title}</h2>
                          </SectionHeaderLead>
                        )}
                      </div>
                      <div className="agenda-bucket-cards">
                        {section.items.map((item) => (
                          <AgendaItemCard
                            key={`${item.sourceType}:${item.id}`}
                            item={item}
                            focusedKey={focusedItemKey}
                            isAllWorkspacesMode={isAllWorkspacesMode}
                            getItemWorkspaceLabel={getItemWorkspaceLabel}
                            formatDueLabel={formatDueLabel}
                            formatReminderLabel={formatReminderLabel}
                            getTodayReason={getTodayReason}
                            onStatusChange={onStatusChange}
                            onFocus={onFocus}
                            onOpenTask={onOpenTask}
                            onSkip={onSkip}
                            onSnooze={onSnooze}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </>
        ) : (
          <div className="empty-state today-empty">
            <p>No items scheduled for today.</p>
            <span>Create a task or generate the agenda to populate this view.</span>
          </div>
        )}
      </div>
    </section>
  );
}
