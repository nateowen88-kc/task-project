import type { Task, TaskStatus } from "../../api";
import { SectionHeader } from "../../components/layout/SectionHeader";

export type WorkflowFilter = "all" | "assigned" | "created" | "unassigned";

type WorkflowViewProps = {
  tasks: Task[];
  statusOrder: TaskStatus[];
  statusLabels: Record<TaskStatus, string>;
  statusIcons: Record<TaskStatus, string>;
  importanceLabels: Record<Task["importance"], string>;
  recurrenceLabels: Record<Task["recurrenceRule"], string>;
  hideDoneInWorkflow: boolean;
  doneWorkflowCount: number;
  isAllWorkspacesMode: boolean;
  getItemWorkspaceLabel: (item: Task) => string | null;
  formatDueLabel: (value: string) => string;
  formatReminderLabel: (value: string | null) => string;
  getTaskTone: (task: Task) => string;
  isToday: (value: string | null | undefined) => boolean;
  workflowFilter: WorkflowFilter;
  onWorkflowFilterChange: (next: WorkflowFilter) => void;
  onOpenCreate: () => void;
  onToggleHideDone: (next: boolean) => void;
  onMoveTask: (taskId: string, status: TaskStatus) => void;
  onStartEdit: (task: Task) => void;
  draggedTaskId: string | null;
  setDraggedTaskId: (taskId: string | null) => void;
};

export function WorkflowView({
  tasks,
  statusOrder,
  statusLabels,
  statusIcons,
  importanceLabels,
  recurrenceLabels,
  hideDoneInWorkflow,
  doneWorkflowCount,
  isAllWorkspacesMode,
  getItemWorkspaceLabel,
  formatDueLabel,
  formatReminderLabel,
  getTaskTone,
  isToday,
  workflowFilter,
  onWorkflowFilterChange,
  onOpenCreate,
  onToggleHideDone,
  onMoveTask,
  onStartEdit,
  draggedTaskId,
  setDraggedTaskId,
}: WorkflowViewProps) {
  return (
    <section className="panel board-panel board-panel-top">
      <SectionHeader
        wide
        eyebrow="TimeSmith Workflow"
        title="Task templates and one-off work"
        actions={
          <>
            <span>Recurring task templates stay here. Daily instances show in Today.</span>
            <div className="capture-header-actions">
              <div className="view-toggle-group" role="tablist" aria-label="Workflow filter">
                {([
                  ["all", "All tasks"],
                  ["assigned", "Assigned to me"],
                  ["created", "Created by me"],
                  ["unassigned", "Unassigned"],
                ] as Array<[WorkflowFilter, string]>).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`ghost-button compact ${workflowFilter === value ? "active-filter" : ""}`}
                    onClick={() => onWorkflowFilterChange(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button className="primary-button" type="button" onClick={onOpenCreate}>
                Create a task
              </button>
            </div>
          </>
        }
      />

      <div className="board-grid">
        {statusOrder.map((status) => {
          const statusTasks = tasks.filter((task) => task.status === status && (!hideDoneInWorkflow || task.status !== "done"));

          return (
            <section
              key={status}
              className={`board-column ${status}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggedTaskId) {
                  onMoveTask(draggedTaskId, status);
                }
                setDraggedTaskId(null);
              }}
            >
              <header>
                <div className="column-title">
                  <span className="column-icon" aria-hidden="true">
                    {statusIcons[status]}
                  </span>
                  <h3>{statusLabels[status]}</h3>
                </div>
                <div className="capture-header-actions">
                  {status === "done" && (
                    <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <input type="checkbox" checked={hideDoneInWorkflow} onChange={(event) => onToggleHideDone(event.target.checked)} />
                      <span>Hide done</span>
                    </label>
                  )}
                  <span style={{ marginLeft: "auto" }}>{status === "done" ? doneWorkflowCount : statusTasks.length}</span>
                </div>
              </header>

              <div className="column-cards">
                {statusTasks.map((task) => (
                  <article
                    key={task.id}
                    className={`task-card ${status} ${getTaskTone(task)}`}
                    draggable={task.permissions.canChangeStatus}
                    onDragStart={() => {
                      if (task.permissions.canChangeStatus) {
                        setDraggedTaskId(task.id);
                      }
                    }}
                    onDragEnd={() => setDraggedTaskId(null)}
                  >
                    <div className="task-card-top">
                      <span className="due-pill">{formatDueLabel(task.dueDate)}</span>
                      <button className="ghost-button compact" type="button" onClick={() => onStartEdit(task)}>
                        {task.permissions.canEdit ? "Edit" : "Open"}
                      </button>
                    </div>

                    <h4>{task.title}</h4>
                    {isAllWorkspacesMode && getItemWorkspaceLabel(task) && (
                      <div className="task-card-meta" style={{ marginTop: "-0.1rem" }}>
                        <span className="meta-chip">{getItemWorkspaceLabel(task)}</span>
                      </div>
                    )}
                    {task.details && <p>{task.details}</p>}

                    <div className="task-card-meta">
                      <span className="meta-chip">Importance: {importanceLabels[task.importance]}</span>
                      <span className="meta-chip">Assignee: {task.assigneeName ?? "Unassigned"}</span>
                      {task.isRecurring && <span className="meta-chip">{recurrenceLabels[task.recurrenceRule]}</span>}
                      {task.remindAt && <span className="meta-chip">{formatReminderLabel(task.remindAt)}</span>}
                      {isToday(task.plannedForDate) && (
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
                  <div className="column-empty">
                    {status === "done" && hideDoneInWorkflow
                      ? "Done tasks are hidden by the current filter."
                      : "Drop a task here or create one with this status."}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
