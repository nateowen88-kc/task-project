import type { OutlookCalendarEvent, OutlookCalendarStatus, Task, TaskStatus, TodayItem } from "../../api";
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
  outlookStatus: OutlookCalendarStatus | null;
  outlookEvents: OutlookCalendarEvent[];
  isOutlookLoading: boolean;
  focusedItemKey: string | null;
  getItemWorkspaceLabel: (item: TodayItem | Task) => string | null;
  formatDueLabel: (value: string) => string;
  formatReminderLabel: (value: string | null) => string;
  getTodayReason: (item: TodayItem) => string;
  formatCalendarEventRange: (event: OutlookCalendarEvent) => string;
  onConnectOutlookCalendar: () => void;
  onDisconnectOutlookCalendar: () => void;
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
  outlookStatus,
  outlookEvents,
  isOutlookLoading,
  focusedItemKey,
  getItemWorkspaceLabel,
  formatDueLabel,
  formatReminderLabel,
  getTodayReason,
  formatCalendarEventRange,
  onConnectOutlookCalendar,
  onDisconnectOutlookCalendar,
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
        leading={<TodayCalendarBadge month={todayBadge.month} day={todayBadge.day} size="sm" showWeekday={false} />}
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
        {!isAllWorkspacesMode && (
          <div className="detail-card agenda-calendar-card">
            <div className="agenda-calendar-header">
              <div>
                <p className="eyebrow">Calendar sync</p>
                <h3>Outlook calendar</h3>
              </div>
              {outlookStatus?.isConnected ? (
                <button className="ghost-button" type="button" onClick={onDisconnectOutlookCalendar}>
                  Disconnect
                </button>
              ) : (
                <button
                  className="primary-button"
                  type="button"
                  disabled={isOutlookLoading || !outlookStatus?.isConfigured}
                  onClick={onConnectOutlookCalendar}
                >
                  {outlookStatus?.isConfigured ? "Connect Outlook" : "Configure Outlook first"}
                </button>
              )}
            </div>

            {isOutlookLoading ? (
              <p>Loading Outlook calendar status...</p>
            ) : !outlookStatus?.isConfigured ? (
              <p>Outlook calendar is not configured yet. Add the Microsoft app settings in Admin → Integrations.</p>
            ) : outlookStatus.isConnected ? (
              <div className="agenda-calendar-events">
                <p>
                  Connected as <strong>{outlookStatus.accountEmail ?? "your Outlook account"}</strong>.
                </p>
                {outlookEvents.length > 0 ? (
                  <ul className="agenda-calendar-event-list">
                    {outlookEvents.slice(0, 6).map((event) => (
                      <li key={event.id} className="agenda-calendar-event-item">
                        <div>
                          <strong>{event.subject}</strong>
                          <span>{formatCalendarEventRange(event)}</span>
                        </div>
                        {event.webLink ? (
                          <a href={event.webLink} target="_blank" rel="noopener noreferrer">
                            Open
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No busy Outlook events found for the next 7 days.</p>
                )}
              </div>
            ) : (
              <p>Connect your Outlook calendar to show upcoming busy time directly in the agenda.</p>
            )}
          </div>
        )}

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
