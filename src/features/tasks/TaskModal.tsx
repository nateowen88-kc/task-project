import { type FormEvent, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import type { RecurrenceRuleValue, TaskDetail, TaskDraft, TaskImportance, TaskPermissions, WorkspaceMember } from "../../api";
import { AppSelect } from "../../components/ui/AppSelect";
import { formatDueLabel, formatReceivedLabel, formatReminderLabel } from "../../lib/formatters";
import {
  IMPORTANCE_LABELS,
  RECURRENCE_LABELS,
  RECURRENCE_OPTIONS,
  STATUS_LABELS,
  STATUS_ORDER,
} from "./config";

type TaskModalProps = {
  draft: TaskDraft;
  editingId: string | null;
  error: string | null;
  isSaving: boolean;
  isDeleting: boolean;
  isDetailLoading: boolean;
  isCommentSaving: boolean;
  taskDetail: TaskDetail | null;
  commentDraft: string;
  workspaceMembers: WorkspaceMember[];
  currentUserId: string;
  canAssignTasks: boolean;
  taskPermissions: TaskPermissions | null;
  onArchive: (() => Promise<void>) | null;
  onClose: () => void;
  onCommentDraftChange: (value: string) => void;
  onCommentSubmit: () => Promise<void>;
  onDelete: (() => Promise<void>) | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDraftChange: (updater: (current: TaskDraft) => TaskDraft) => void;
};

function parseDateValue(value: string) {
  return new Date(`${value}T12:00:00`);
}

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCalendarDays(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const leading = firstDay.getDay();
  const trailing = 6 - lastDay.getDay();
  const days: Array<{ value: string; label: number; inMonth: boolean }> = [];

  for (let index = leading; index > 0; index -= 1) {
    const date = new Date(year, month, 1 - index);
    days.push({ value: toDateValue(date), label: date.getDate(), inMonth: false });
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = new Date(year, month, day);
    days.push({ value: toDateValue(date), label: day, inMonth: true });
  }

  for (let index = 1; index <= trailing; index += 1) {
    const date = new Date(year, month + 1, index);
    days.push({ value: toDateValue(date), label: date.getDate(), inMonth: false });
  }

  return days;
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function CalendarShell({
  isOpen,
  children,
  rootRef,
  triggerLabel,
  onToggle,
}: {
  isOpen: boolean;
  children: ReactNode;
  rootRef: RefObject<HTMLDivElement>;
  triggerLabel: string;
  onToggle: () => void;
}) {
  return (
    <div ref={rootRef} className={`calendar-field ${isOpen ? "is-open" : ""}`}>
      <button type="button" className="calendar-trigger" onClick={onToggle}>
        <span>{triggerLabel}</span>
        <span className="app-select-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {isOpen && children}
    </div>
  );
}

function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (nextValue: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => (value ? parseDateValue(value) : new Date()));
  const rootRef = useRef<HTMLDivElement>(null);
  const todayValue = toDateValue(new Date());

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (value) {
      setViewDate(parseDateValue(value));
    }
  }, [value]);

  const days = buildCalendarDays(viewDate);

  return (
    <CalendarShell
      isOpen={isOpen}
      rootRef={rootRef}
      triggerLabel={value ? formatDueLabel(value) : "Select date"}
      onToggle={() => setIsOpen((current) => !current)}
    >
      <div className="calendar-popover">
        <div className="calendar-popover-header">
          <button type="button" className="ghost-button compact" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}>
            Prev
          </button>
          <strong>{formatMonthLabel(viewDate)}</strong>
          <button type="button" className="ghost-button compact" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}>
            Next
          </button>
        </div>
        <div className="calendar-weekdays">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {days.map((day) => (
            <button
              key={day.value}
              type="button"
              className={`calendar-day-button ${day.inMonth ? "" : "is-muted"} ${day.value === value ? "is-selected" : ""} ${day.value === todayValue ? "is-today" : ""}`}
              onClick={() => {
                onChange(day.value);
                setIsOpen(false);
              }}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>
    </CalendarShell>
  );
}

function ReminderField({
  value,
  onChange,
}: {
  value: string;
  onChange: (nextValue: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const initialDate = value ? value.slice(0, 10) : toDateValue(new Date());
  const [viewDate, setViewDate] = useState(() => parseDateValue(initialDate));
  const rootRef = useRef<HTMLDivElement>(null);
  const todayValue = toDateValue(new Date());
  const selectedDate = value ? value.slice(0, 10) : "";
  const selectedTime = value ? value.slice(11, 16) : "09:00";

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (selectedDate) {
      setViewDate(parseDateValue(selectedDate));
    }
  }, [selectedDate]);

  const days = buildCalendarDays(viewDate);

  function updateReminder(nextDate: string, nextTime: string) {
    onChange(`${nextDate}T${nextTime}`);
  }

  return (
    <CalendarShell
      isOpen={isOpen}
      rootRef={rootRef}
      triggerLabel={value ? formatReminderLabel(value) : "No reminder"}
      onToggle={() => setIsOpen((current) => !current)}
    >
      <div className="calendar-popover">
        <div className="calendar-popover-header">
          <button type="button" className="ghost-button compact" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}>
            Prev
          </button>
          <strong>{formatMonthLabel(viewDate)}</strong>
          <button type="button" className="ghost-button compact" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}>
            Next
          </button>
        </div>
        <div className="calendar-weekdays">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {days.map((day) => (
            <button
              key={day.value}
              type="button"
              className={`calendar-day-button ${day.inMonth ? "" : "is-muted"} ${day.value === selectedDate ? "is-selected" : ""} ${day.value === todayValue ? "is-today" : ""}`}
              onClick={() => updateReminder(day.value, selectedTime)}
            >
              {day.label}
            </button>
          ))}
        </div>
        <div className="calendar-time-row">
          <label>
            Time
            <input
              type="time"
              value={selectedTime}
              onChange={(event) => {
                if (selectedDate) {
                  updateReminder(selectedDate, event.target.value);
                }
              }}
            />
          </label>
          <button
            type="button"
            className="ghost-button compact"
            onClick={() => {
              onChange("");
              setIsOpen(false);
            }}
          >
            Clear
          </button>
        </div>
      </div>
    </CalendarShell>
  );
}

function TaskModal({
  draft,
  editingId,
  error,
  isSaving,
  isDeleting,
  isDetailLoading,
  isCommentSaving,
  taskDetail,
  commentDraft,
  workspaceMembers,
  currentUserId,
  canAssignTasks,
  taskPermissions,
  onArchive,
  onClose,
  onCommentDraftChange,
  onCommentSubmit,
  onDelete,
  onSubmit,
  onDraftChange,
}: TaskModalProps) {
  const isReadOnly = Boolean(editingId && taskPermissions && !taskPermissions.canEdit);
  const canComment = editingId ? Boolean(taskPermissions?.canComment) : false;
  const canArchive = editingId ? Boolean(taskPermissions?.canArchive) : false;
  const canDelete = editingId ? Boolean(taskPermissions?.canDelete) : false;
  const canEditAssignee = canAssignTasks;
  const assigneeOptions = [
    ...(!canAssignTasks ? [] : [{ value: "", label: "Unassigned" }]),
    ...workspaceMembers
      .filter((member) => canAssignTasks || member.id === currentUserId)
      .map((member) => ({
      value: member.id,
      label: member.name,
    })),
  ];

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <p className="modal-eyebrow">{editingId ? "Update task" : "Create a task"}</p>
            <h2>{editingId ? "Edit task" : "Create a task"}</h2>
          </div>
          <button className="ghost-button compact" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form className="modal-shell" onSubmit={(event) => void onSubmit(event)}>
          <div className="modal-scroll">
            <div className="task-form modal-form">
              <label>
                Title
                <input
                  required
                  value={draft.title}
                  disabled={isReadOnly}
                  onChange={(event) => onDraftChange((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Ship onboarding draft"
                />
              </label>

              <label>
                Details
                <textarea
                  rows={4}
                  value={draft.details}
                  disabled={isReadOnly}
                  onChange={(event) => onDraftChange((current) => ({ ...current, details: event.target.value }))}
                  placeholder="What needs to happen, context, notes, constraints..."
                />
              </label>

              <label>
                Useful links
                <textarea
                  rows={3}
                  value={draft.links}
                  disabled={isReadOnly}
                  onChange={(event) => onDraftChange((current) => ({ ...current, links: event.target.value }))}
                  placeholder="One URL per line or comma separated"
                />
              </label>

              <div className="modal-field-grid">
                <label className="field-span-wide">
                  Due date
                  <DateField
                    value={draft.dueDate}
                    onChange={(nextValue) => onDraftChange((current) => ({ ...current, dueDate: nextValue }))}
                  />
                </label>

                <label className="field-span-wide">
                  Reminder
                  <ReminderField
                    value={draft.remindAt}
                    onChange={(nextValue) => onDraftChange((current) => ({ ...current, remindAt: nextValue }))}
                  />
                </label>

                <label>
                  Status
                  <AppSelect
                    ariaLabel="Task status"
                    className="app-select"
                    menuClassName="app-select-menu"
                    value={draft.status}
                    disabled={isReadOnly}
                    options={STATUS_ORDER.map((status) => ({
                      value: status,
                      label: STATUS_LABELS[status],
                    }))}
                    onChange={(nextStatus) => onDraftChange((current) => ({ ...current, status: nextStatus }))}
                  />
                </label>
                <label>
                  Importance
                  <AppSelect
                    ariaLabel="Task importance"
                    className="app-select"
                    menuClassName="app-select-menu"
                    value={draft.importance}
                    disabled={isReadOnly}
                    options={(["low", "medium", "high"] as TaskImportance[]).map((importance) => ({
                      value: importance,
                      label: IMPORTANCE_LABELS[importance],
                    }))}
                    onChange={(nextImportance) =>
                      onDraftChange((current) => ({ ...current, importance: nextImportance }))
                    }
                  />
                </label>
                <label>
                  Assignee
                  <AppSelect
                    ariaLabel="Task assignee"
                    className="app-select"
                    menuClassName="app-select-menu"
                    value={draft.assigneeId}
                    options={assigneeOptions}
                    disabled={isReadOnly || !canEditAssignee}
                    onChange={(nextAssigneeId) =>
                      onDraftChange((current) => ({ ...current, assigneeId: nextAssigneeId }))
                    }
                  />
                </label>
              </div>

              <div className="recurrence-panel">
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={draft.isRecurring}
                    disabled={isReadOnly}
                    onChange={(event) => onDraftChange((current) => ({ ...current, isRecurring: event.target.checked }))}
                  />
                  <span>Repeat this task</span>
                </label>

                {draft.isRecurring && (
                  <label>
                    Repeats
                    <AppSelect
                      ariaLabel="Recurrence rule"
                      className="app-select"
                      menuClassName="app-select-menu"
                      value={draft.recurrenceRule}
                      disabled={isReadOnly}
                      options={RECURRENCE_OPTIONS.map((rule) => ({
                        value: rule,
                        label: RECURRENCE_LABELS[rule],
                      }))}
                      onChange={(nextRule: RecurrenceRuleValue) =>
                        onDraftChange((current) => ({
                          ...current,
                          recurrenceRule: nextRule,
                        }))
                      }
                    />
                  </label>
                )}
              </div>

              {editingId && (
                <div className="task-detail-panel">
                  <div className="task-detail-columns">
                    <section className="task-detail-section">
                      <div className="task-detail-header">
                        <p className="eyebrow">Discussion</p>
                        <h3>Comments</h3>
                      </div>
                      <div className="task-comment-composer">
                        <textarea
                          rows={3}
                          value={commentDraft}
                          disabled={!canComment}
                          onChange={(event) => onCommentDraftChange(event.target.value)}
                          placeholder="Add context, blockers, or handoff notes"
                        />
                        <button
                          className="primary-button compact"
                          type="button"
                          disabled={!canComment || isCommentSaving || commentDraft.trim().length === 0}
                          onClick={() => void onCommentSubmit()}
                        >
                          {isCommentSaving ? "Posting..." : "Add comment"}
                        </button>
                      </div>

                      <div className="task-detail-list">
                        {isDetailLoading ? (
                          <div className="detail-empty">Loading comments…</div>
                        ) : taskDetail?.comments.length ? (
                          taskDetail.comments.map((comment) => (
                            <article key={comment.id} className="detail-card">
                              <div className="detail-card-top">
                                <strong>{comment.authorName ?? "Unknown author"}</strong>
                                <span>{formatReceivedLabel(comment.createdAt)}</span>
                              </div>
                              <p>{comment.body}</p>
                            </article>
                          ))
                        ) : (
                          <div className="detail-empty">No comments yet.</div>
                        )}
                      </div>
                    </section>

                    <section className="task-detail-section">
                      <div className="task-detail-header">
                        <p className="eyebrow">History</p>
                        <h3>Activity</h3>
                      </div>
                      <div className="task-detail-list">
                        {isDetailLoading ? (
                          <div className="detail-empty">Loading activity…</div>
                        ) : taskDetail?.activities.length ? (
                          taskDetail.activities.map((activity) => (
                            <article key={activity.id} className="detail-card">
                              <div className="detail-card-top">
                                <strong>{activity.actorName ?? "System"}</strong>
                                <span>{formatReceivedLabel(activity.createdAt)}</span>
                              </div>
                              <p>{activity.message}</p>
                            </article>
                          ))
                        ) : (
                          <div className="detail-empty">No activity yet.</div>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="modal-actions modal-actions-bar">
            <div className="modal-actions-left">
              {editingId && onArchive && canArchive && (
                <button className="ghost-button compact" type="button" onClick={() => void onArchive()} disabled={isSaving || isDeleting}>
                  Archive
                </button>
              )}
              {editingId && onDelete && canDelete && (
                <button className="ghost-button compact danger-button" type="button" onClick={() => void onDelete()} disabled={isSaving || isDeleting}>
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              )}
            </div>
            <div className="modal-actions-right">
              <button className="ghost-button" type="button" onClick={onClose} disabled={isSaving || isDeleting}>
                Cancel
              </button>
              <button className="primary-button" type="submit" disabled={isReadOnly || isSaving || isDeleting}>
                {isSaving ? "Saving..." : editingId ? "Save changes" : "Create task"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export { TaskModal };
export type { TaskModalProps };
