import type { CapturedItem } from "../../api";
import { SectionHeader } from "../../components/layout/SectionHeader";
import { TodayCalendarBadge } from "../../components/ui/TodayCalendarBadge";
import { formatDueLabel, formatReceivedLabel } from "../../lib/formatters";

type InboxViewProps = {
  capturedItems: CapturedItem[];
  isAllWorkspacesMode: boolean;
  todayBadge: { month: string; day: number; weekday: string };
  getItemWorkspaceLabel: (item: CapturedItem) => string | null;
  onStartCaptureReview: (item: CapturedItem) => void;
  onDiscardCapture: (id: string) => void;
};

export function InboxView({
  capturedItems,
  isAllWorkspacesMode,
  todayBadge,
  getItemWorkspaceLabel,
  onStartCaptureReview,
  onDiscardCapture,
}: InboxViewProps) {
  const newItems = capturedItems.filter((item) => item.status === "new");

  return (
    <section className="panel capture-panel">
      <SectionHeader
        wide
        eyebrow="Task Inbox"
        title="Task suggestions captured from inbound email"
        leading={<TodayCalendarBadge month={todayBadge.month} day={todayBadge.day} weekday={todayBadge.weekday} />}
        actions={
          <>
            <span>Forward work into <strong>task@timesmithhq.com</strong> to review it here.</span>
          </>
        }
      />

      <div className="capture-grid">
        {newItems.length > 0 ? (
          newItems.map((item) => (
            <article key={item.id} className={`capture-card ${item.sourceType}`}>
              <div className="capture-card-top">
                <span className={`capture-badge ${item.sourceType}`}>Email</span>
                <span className="capture-meta">{formatReceivedLabel(item.receivedAt)}</span>
              </div>

              <h3>{item.title}</h3>
              {isAllWorkspacesMode && getItemWorkspaceLabel(item) && (
                <div className="capture-details">
                  <span>{getItemWorkspaceLabel(item)}</span>
                </div>
              )}
              {item.body && <p>{item.body}</p>}

              <div className="capture-details">
                {item.sender && <span>{item.sender}</span>}
                {item.sourceLabel && <span>{item.sourceLabel}</span>}
                {item.suggestedDueDate && <span>Suggested due {formatDueLabel(item.suggestedDueDate)}</span>}
              </div>

              {item.sourceUrl && (
                <div className="link-list">
                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {item.sourceUrl}
                  </a>
                </div>
              )}

              <div className="capture-actions">
                <button className="primary-button" type="button" onClick={() => onStartCaptureReview(item)}>
                  Review as task
                </button>
                <button className="ghost-button compact" type="button" onClick={() => onDiscardCapture(item.id)}>
                  Discard
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state capture-empty">
            <p>No captured items waiting for review.</p>
            <span>Send an email to <strong>task@timesmithhq.com</strong> and it will land here.</span>
          </div>
        )}
      </div>
    </section>
  );
}
