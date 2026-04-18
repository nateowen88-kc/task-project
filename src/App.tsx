import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  acceptCapturedItem,
  AgendaResponse,
  archiveTask,
  CapturedItem,
  createDemoEmailCapture,
  createTask,
  createDemoSlackCapture,
  deleteTask,
  discardCapturedItem,
  fetchCapturedItems,
  fetchTasks,
  fetchTodayAgenda,
  generateTodayAgenda,
  skipTodayItem,
  snoozeTodayItem,
  RecurrenceRuleValue,
  Task,
  TaskDraft,
  TaskStatus,
  TodayItem,
  updateTask,
  updateTaskStatus,
  updateTodayItemStatus,
} from "./api";

const STATUS_LABELS: Record<TaskStatus, string> = {
  blocked: "Blocked",
  todo: "To Do",
  "in-progress": "In Progress",
  done: "Done",
};

const RECURRENCE_LABELS: Record<RecurrenceRuleValue, string> = {
  none: "Does not repeat",
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
  monthly: "Monthly",
};

const STATUS_ORDER: TaskStatus[] = ["blocked", "todo", "in-progress", "done"];
const RECURRENCE_OPTIONS: RecurrenceRuleValue[] = ["daily", "weekdays", "weekly", "monthly"];

const STATUS_ICONS: Record<TaskStatus, string> = {
  blocked: "⛔",
  todo: "☑",
  "in-progress": "◷",
  done: "✓",
};

function getOffsetDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function createEmptyDraft(): TaskDraft {
  return {
    title: "",
    details: "",
    links: "",
    dueDate: getOffsetDate(0),
    remindAt: "",
    status: "todo",
    isRecurring: false,
    recurrenceRule: "daily",
  };
}

function sortByDueDate(tasks: Task[]) {
  return [...tasks].sort((left, right) => {
    if (left.dueDate === right.dueDate) {
      return left.createdAt.localeCompare(right.createdAt);
    }

    return left.dueDate.localeCompare(right.dueDate);
  });
}

function isToday(date: string) {
  return date === new Date().toISOString().slice(0, 10);
}

function isOverdue(date: string) {
  return date < new Date().toISOString().slice(0, 10);
}

function getTaskTone(task: Pick<Task, "dueDate" | "status">) {
  if (task.status === "done") {
    return "complete";
  }

  if (isOverdue(task.dueDate)) {
    return "overdue";
  }

  if (isToday(task.dueDate)) {
    return "today";
  }

  return "upcoming";
}

function formatDueLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

function formatReminderLabel(value: string | null) {
  if (!value) {
    return "No reminder";
  }

  const parsed = new Date(value);
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 16);
}

function formatReceivedLabel(value: string) {
  const parsed = new Date(value);
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function createDraftFromCapture(item: CapturedItem): TaskDraft {
  const details = [
    item.body.trim(),
    item.sender ? `From: ${item.sender}` : null,
    item.sourceLabel ? `Source: ${item.sourceLabel}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    title: item.title,
    details,
    links: item.sourceUrl ?? "",
    dueDate: item.suggestedDueDate ?? getOffsetDate(0),
    remindAt: "",
    status: "todo",
    isRecurring: false,
    recurrenceRule: "daily",
  };
}

function getTodayReason(item: TodayItem) {
  if (item.sourceType === "occurrence") {
    return "Recurring today";
  }

  if (isOverdue(item.dueDate)) {
    return "Overdue";
  }

  if (isToday(item.dueDate)) {
    return "Due today";
  }

  if (item.plannedForDate && isToday(item.plannedForDate)) {
    return "Promoted into today";
  }

  return "Today";
}

type TaskModalProps = {
  draft: TaskDraft;
  editingId: string | null;
  error: string | null;
  isSaving: boolean;
  isDeleting: boolean;
  onArchive: (() => Promise<void>) | null;
  onClose: () => void;
  onDelete: (() => Promise<void>) | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDraftChange: (updater: (current: TaskDraft) => TaskDraft) => void;
};

function TaskModal({
  draft,
  editingId,
  error,
  isSaving,
  isDeleting,
  onArchive,
  onClose,
  onDelete,
  onSubmit,
  onDraftChange,
}: TaskModalProps) {
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

        <form className="task-form modal-form" onSubmit={(event) => void onSubmit(event)}>
          <label>
            Title
            <input
              required
              value={draft.title}
              onChange={(event) => onDraftChange((current) => ({ ...current, title: event.target.value }))}
              placeholder="Ship onboarding draft"
            />
          </label>

          <label>
            Details
            <textarea
              rows={4}
              value={draft.details}
              onChange={(event) => onDraftChange((current) => ({ ...current, details: event.target.value }))}
              placeholder="What needs to happen, context, notes, constraints..."
            />
          </label>

          <label>
            Useful links
            <textarea
              rows={3}
              value={draft.links}
              onChange={(event) => onDraftChange((current) => ({ ...current, links: event.target.value }))}
              placeholder="One URL per line or comma separated"
            />
          </label>

          <div className="form-row form-row-triple">
            <label>
              Due date
              <input
                required
                type="date"
                value={draft.dueDate}
                onChange={(event) => onDraftChange((current) => ({ ...current, dueDate: event.target.value }))}
              />
            </label>

            <label>
              Reminder
              <input
                type="datetime-local"
                value={draft.remindAt}
                onChange={(event) => onDraftChange((current) => ({ ...current, remindAt: event.target.value }))}
              />
            </label>

            <label>
              Status
              <select
                className="modal-select"
                value={draft.status}
                onChange={(event) =>
                  onDraftChange((current) => ({ ...current, status: event.target.value as TaskStatus }))
                }
              >
                {STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="recurrence-panel">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={draft.isRecurring}
                onChange={(event) =>
                  onDraftChange((current) => ({ ...current, isRecurring: event.target.checked }))
                }
              />
              <span>Repeat this task</span>
            </label>

            {draft.isRecurring && (
              <label>
                Repeats
                <select
                  className="modal-select"
                  value={draft.recurrenceRule}
                  onChange={(event) =>
                    onDraftChange((current) => ({
                      ...current,
                      recurrenceRule: event.target.value as RecurrenceRuleValue,
                    }))
                  }
                >
                  {RECURRENCE_OPTIONS.map((rule) => (
                    <option key={rule} value={rule}>
                      {RECURRENCE_LABELS[rule]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="modal-actions">
            <div className="modal-actions-left">
              {editingId && onArchive && (
                <button className="ghost-button compact" type="button" onClick={() => void onArchive()} disabled={isSaving || isDeleting}>
                  Archive
                </button>
              )}
              {editingId && onDelete && (
                <button className="ghost-button compact danger-button" type="button" onClick={() => void onDelete()} disabled={isSaving || isDeleting}>
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              )}
            </div>
            <div className="modal-actions-right">
              <button className="ghost-button" type="button" onClick={onClose} disabled={isSaving || isDeleting}>
                Cancel
              </button>
              <button className="primary-button" type="submit" disabled={isSaving || isDeleting}>
                {isSaving ? "Saving..." : editingId ? "Save changes" : "Create task"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agenda, setAgenda] = useState<AgendaResponse | null>(null);
  const [capturedItems, setCapturedItems] = useState<CapturedItem[]>([]);
  const [draft, setDraft] = useState<TaskDraft>(createEmptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reviewCaptureId, setReviewCaptureId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAgendaRefreshing, setIsAgendaRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  async function refreshAppData() {
    const [nextTasks, nextAgenda, nextCapturedItems] = await Promise.all([
      fetchTasks(),
      fetchTodayAgenda(),
      fetchCapturedItems(),
    ]);
    setTasks(sortByDueDate(nextTasks));
    setAgenda(nextAgenda);
    setCapturedItems(nextCapturedItems);
  }

  useEffect(() => {
    async function load() {
      try {
        await refreshAppData();
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load tasks.");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  const todayItems = agenda?.items ?? [];

  const todayTasks = useMemo(
    () =>
      todayItems.filter((item) => {
        if (item.status === "done") {
          return false;
        }

        return true;
      }),
    [todayItems],
  );

  const stats = useMemo(
    () => ({
      total: tasks.length,
      dueNow: todayTasks.length,
      done: tasks.filter((task) => task.status === "done").length,
      blocked: tasks.filter((task) => task.status === "blocked").length,
      inbox: capturedItems.filter((item) => item.status === "new").length,
    }),
    [capturedItems, tasks, todayTasks.length],
  );

  function closeModal() {
    setDraft(createEmptyDraft());
    setEditingId(null);
    setReviewCaptureId(null);
    setError(null);
    setIsDeleting(false);
    setIsModalOpen(false);
  }

  function openCreateModal() {
    setDraft(createEmptyDraft());
    setEditingId(null);
    setReviewCaptureId(null);
    setError(null);
    setIsModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      if (editingId) {
        await updateTask(editingId, draft);
      } else if (reviewCaptureId) {
        await acceptCapturedItem(reviewCaptureId, draft);
      } else {
        await createTask(draft);
      }

      await refreshAppData();
      closeModal();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save task.");
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit(task: Task) {
    setEditingId(task.id);
    setReviewCaptureId(null);
    setDraft({
      title: task.title,
      details: task.details,
      links: task.links.join("\n"),
      dueDate: task.dueDate,
      remindAt: toDateTimeLocal(task.remindAt),
      status: task.status,
      isRecurring: task.isRecurring,
      recurrenceRule: task.recurrenceRule === "none" ? "daily" : task.recurrenceRule,
    });
    setError(null);
    setIsModalOpen(true);
  }

  function startCaptureReview(item: CapturedItem) {
    setEditingId(null);
    setReviewCaptureId(item.id);
    setDraft(createDraftFromCapture(item));
    setError(null);
    setIsModalOpen(true);
  }

  async function moveTask(taskId: string, status: TaskStatus) {
    const existing = tasks.find((task) => task.id === taskId);
    if (!existing || existing.status === status) {
      return;
    }

    const previousTasks = tasks;
    const optimistic = sortByDueDate(
      tasks.map((task) => (task.id === taskId ? { ...task, status } : task)),
    );
    setTasks(optimistic);
    setError(null);

    try {
      await updateTaskStatus(taskId, status);
      await refreshAppData();
    } catch (moveError) {
      setTasks(previousTasks);
      setError(moveError instanceof Error ? moveError.message : "Could not move task.");
    }
  }

  async function handleTodayStatusChange(item: TodayItem, status: TaskStatus) {
    if (item.status === status) {
      return;
    }

    setError(null);

    try {
      await updateTodayItemStatus(item.sourceType, item.id, status);
      await refreshAppData();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Could not update agenda item.");
    }
  }

  async function handleGenerateAgenda() {
    setIsAgendaRefreshing(true);
    setError(null);

    try {
      const nextAgenda = await generateTodayAgenda();
      const nextTasks = await fetchTasks();
      setAgenda(nextAgenda);
      setTasks(sortByDueDate(nextTasks));
    } catch (agendaError) {
      setError(agendaError instanceof Error ? agendaError.message : "Could not generate agenda.");
    } finally {
      setIsAgendaRefreshing(false);
    }
  }

  async function handleArchiveTask() {
    if (!editingId) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await archiveTask(editingId);
      await refreshAppData();
      closeModal();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Could not archive task.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteTask() {
    if (!editingId) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      await deleteTask(editingId);
      await refreshAppData();
      closeModal();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete task.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleSkipTodayItem(item: TodayItem) {
    setError(null);

    try {
      await skipTodayItem(item.sourceType, item.id);
      await refreshAppData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not skip agenda item.");
    }
  }

  async function handleSnoozeTodayItem(item: TodayItem) {
    setError(null);

    try {
      await snoozeTodayItem(item.sourceType, item.id);
      await refreshAppData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not snooze agenda item.");
    }
  }

  async function handleDiscardCapture(itemId: string) {
    setError(null);

    try {
      await discardCapturedItem(itemId);
      await refreshAppData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not discard captured item.");
    }
  }

  async function handleCreateDemoSlackCapture() {
    setError(null);

    try {
      await createDemoSlackCapture();
      await refreshAppData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not create Slack capture.");
    }
  }

  async function handleCreateDemoEmailCapture() {
    setError(null);

    try {
      await createDemoEmailCapture();
      await refreshAppData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not create email capture.");
    }
  }

  const promotedCount = agenda?.promotedTaskCount ?? 0;

  return (
    <>
      <div className="app-shell">
        <main className="workspace workspace-full">
          <section className="panel intro-panel intro-panel-compact">
            <div className="hero hero-compact">
              <div>
                <p className="eyebrow">Task Flow</p>
                <h1>Your day, already sorted.</h1>
              </div>
              <p className="hero-copy">
                The agenda now handles today’s focus directly. The board stays for planning and workflow.
              </p>
            </div>

            {error && <div className="error-banner">{error}</div>}

            <div className="stat-grid stat-grid-compact">
              <article className="stat-card">
                <span className="stat-value">{stats.dueNow}</span>
                <span className="stat-label">Agenda</span>
              </article>
              <article className="stat-card">
                <span className="stat-value">{stats.blocked}</span>
                <span className="stat-label">Blocked</span>
              </article>
              <article className="stat-card">
                <span className="stat-value">{stats.done}</span>
                <span className="stat-label">Done</span>
              </article>
              <article className="stat-card">
                <span className="stat-value">{stats.total}</span>
                <span className="stat-label">Total</span>
              </article>
              <article className="stat-card">
                <span className="stat-value">{stats.inbox}</span>
                <span className="stat-label">Inbox</span>
              </article>
            </div>
          </section>

          <section className="panel capture-panel">
            <div className="section-heading section-heading-wide">
              <div>
                <p className="eyebrow">Capture Inbox</p>
                <h2>Review messages before they become tasks</h2>
              </div>
              <div className="board-header-actions">
                <span>Slack first. Email can feed the same inbox later.</span>
                <div className="capture-header-actions">
                  <button className="ghost-button" type="button" onClick={() => void handleCreateDemoSlackCapture()}>
                    Add sample Slack item
                  </button>
                  <button className="ghost-button" type="button" onClick={() => void handleCreateDemoEmailCapture()}>
                    Add sample email
                  </button>
                </div>
              </div>
            </div>

            <div className="capture-grid">
              {capturedItems.filter((item) => item.status === "new").length > 0 ? (
                capturedItems
                  .filter((item) => item.status === "new")
                  .map((item) => (
                    <article key={item.id} className={`capture-card ${item.sourceType}`}>
                      <div className="capture-card-top">
                        <span className={`capture-badge ${item.sourceType}`}>
                          {item.sourceType === "slack" ? "Slack" : "Email"}
                        </span>
                        <span className="capture-meta">{formatReceivedLabel(item.receivedAt)}</span>
                      </div>

                      <h3>{item.title}</h3>
                      {item.body && <p>{item.body}</p>}

                      <div className="capture-details">
                        {item.sender && <span>{item.sender}</span>}
                        {item.sourceLabel && <span>{item.sourceLabel}</span>}
                        {item.suggestedDueDate && <span>Suggested due {formatDueLabel(item.suggestedDueDate)}</span>}
                      </div>

                      {item.sourceUrl && (
                        <div className="link-list">
                          <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                            {item.sourceUrl}
                          </a>
                        </div>
                      )}

                      <div className="capture-actions">
                        <button className="primary-button" type="button" onClick={() => startCaptureReview(item)}>
                          Review as task
                        </button>
                        <button className="ghost-button compact" type="button" onClick={() => void handleDiscardCapture(item.id)}>
                          Discard
                        </button>
                      </div>
                    </article>
                  ))
              ) : (
                <div className="empty-state capture-empty">
                  <p>No captured items waiting for review.</p>
                  <span>Add a sample Slack item now. Email and real Slack ingestion can plug into this inbox next.</span>
                </div>
              )}
            </div>
          </section>

          <section className="panel today-panel">
            <div className="section-heading section-heading-wide">
              <div>
                <p className="eyebrow">Today</p>
                <h2>Generated daily agenda</h2>
              </div>
              <div className="board-header-actions">
                <span>
                  {promotedCount > 0
                    ? `${promotedCount} task(s) promoted into today`
                    : "Uses overdue, due today, recurring, and near-term tasks"}
                </span>
                <button className="ghost-button" type="button" onClick={() => void handleGenerateAgenda()}>
                  {isAgendaRefreshing ? "Refreshing..." : "Generate agenda"}
                </button>
              </div>
            </div>

            <div className="today-grid">
              {todayItems.length > 0 ? (
                todayItems.map((item) => (
                  <article key={`${item.sourceType}:${item.id}`} className={`today-card ${item.status}`}>
                    <div className="today-card-top">
                      <span className={`today-badge ${item.sourceType}`}>
                        {item.sourceType === "occurrence" ? "Recurring" : "Task"}
                      </span>
                      <span className="due-pill">{getTodayReason(item)}</span>
                    </div>

                    <h3>{item.title}</h3>
                    {item.details && <p>{item.details}</p>}

                    <div className="today-meta">
                      <span>Due: {formatDueLabel(item.dueDate)}</span>
                      <span>{formatReminderLabel(item.remindAt)}</span>
                      {item.isRecurring && <span>{RECURRENCE_LABELS[item.recurrenceRule]}</span>}
                    </div>

                    {item.links.length > 0 && (
                      <div className="link-list">
                        {item.links.map((link) => (
                          <a key={link} href={link} target="_blank" rel="noreferrer">
                            {link}
                          </a>
                        ))}
                      </div>
                    )}

                    <div className="today-actions">
                      <select
                        className={`status-select ${item.status}`}
                        value={item.status}
                        onChange={(event) =>
                          void handleTodayStatusChange(item, event.target.value as TaskStatus)
                        }
                      >
                        {STATUS_ORDER.map((status) => (
                          <option key={status} value={status}>
                            {STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>

                      <button
                        className="ghost-button compact"
                        type="button"
                        onClick={() => {
                          const sourceTask = tasks.find((task) => task.id === item.taskId);
                          if (sourceTask) {
                            startEdit(sourceTask);
                          }
                        }}
                      >
                        Open task
                      </button>
                      {item.sourceType === "occurrence" && (
                        <button className="ghost-button compact" type="button" onClick={() => void handleSkipTodayItem(item)}>
                          Skip today
                        </button>
                      )}
                      <button className="ghost-button compact" type="button" onClick={() => void handleSnoozeTodayItem(item)}>
                        Snooze
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state today-empty">
                  <p>No items scheduled for today.</p>
                  <span>Create a task or generate the agenda to populate this view.</span>
                </div>
              )}
            </div>
          </section>

          <section className="panel board-panel board-panel-top">
            <div className="section-heading section-heading-wide">
              <div>
                <p className="eyebrow">Workflow board</p>
                <h2>Task templates and one-off work</h2>
              </div>
              <div className="board-header-actions">
                <span>Recurring task templates stay here. Daily instances show in Today.</span>
                <button className="primary-button" type="button" onClick={openCreateModal}>
                  Create a task
                </button>
              </div>
            </div>

            <div className="board-grid">
              {STATUS_ORDER.map((status) => {
                const statusTasks = tasks.filter((task) => task.status === status);

                return (
                  <section
                    key={status}
                    className={`board-column ${status}`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggedTaskId) {
                        void moveTask(draggedTaskId, status);
                      }
                      setDraggedTaskId(null);
                    }}
                  >
                    <header>
                      <div className="column-title">
                        <span className="column-icon" aria-hidden="true">
                          {STATUS_ICONS[status]}
                        </span>
                        <h3>{STATUS_LABELS[status]}</h3>
                      </div>
                      <span>{statusTasks.length}</span>
                    </header>

                    <div className="column-cards">
                      {statusTasks.map((task) => (
                        <article
                          key={task.id}
                          className={`task-card ${status} ${getTaskTone(task)}`}
                          draggable
                          onDragStart={() => setDraggedTaskId(task.id)}
                          onDragEnd={() => setDraggedTaskId(null)}
                        >
                          <div className="task-card-top">
                            <span className="due-pill">{formatDueLabel(task.dueDate)}</span>
                            <button className="ghost-button compact" type="button" onClick={() => startEdit(task)}>
                              Edit
                            </button>
                          </div>

                          <h4>{task.title}</h4>
                          {task.details && <p>{task.details}</p>}

                          <div className="task-card-meta">
                            {task.isRecurring && <span className="meta-chip">{RECURRENCE_LABELS[task.recurrenceRule]}</span>}
                            {task.remindAt && <span className="meta-chip">{formatReminderLabel(task.remindAt)}</span>}
                            {task.plannedForDate && isToday(task.plannedForDate) && (
                              <span className="meta-chip">On today&apos;s agenda</span>
                            )}
                          </div>

                          {task.links.length > 0 && (
                            <div className="link-list">
                              {task.links.map((link) => (
                                <a key={link} href={link} target="_blank" rel="noreferrer">
                                  {link}
                                </a>
                              ))}
                            </div>
                          )}
                        </article>
                      ))}

                      {statusTasks.length === 0 && (
                        <div className="column-empty">Drop a task here or create one with this status.</div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
        </main>
      </div>

      {isModalOpen && (
        <TaskModal
          draft={draft}
          editingId={editingId}
          error={error}
          isSaving={isSaving}
          isDeleting={isDeleting}
          onArchive={editingId ? handleArchiveTask : null}
          onClose={closeModal}
          onDelete={editingId ? handleDeleteTask : null}
          onSubmit={handleSubmit}
          onDraftChange={(updater) => setDraft((current) => updater(current))}
        />
      )}
    </>
  );
}
