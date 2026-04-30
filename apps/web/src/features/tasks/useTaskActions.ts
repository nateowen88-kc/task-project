import { FormEvent, useState } from "react";
import {
  acceptCapturedItem,
  AgendaResponse,
  AuthSession,
  CapturedItem,
  Notification,
  Task,
  TaskDetail,
  TaskDraft,
  TaskStatus,
  TodayItem,
  archiveTask,
  createTask,
  createTaskComment,
  deleteTask,
  fetchNotifications,
  fetchTaskDetail,
  fetchTasks,
  generateTodayAgenda,
  skipTodayItem,
  snoozeTodayItem,
  updateTask,
  updateTaskStatus,
  updateTodayItemStatus,
} from "../../api";
import { createDraftFromCapture, sortByDueDate, toDateTimeLocal } from "./drafts";
import { createEmptyDraft } from "./config";

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type UseTaskActionsOptions = {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  setAgenda: React.Dispatch<React.SetStateAction<AgendaResponse | null>>;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  refreshAppData: (
    nextSession?: AuthSession | null,
    requestedTargets?: {
      tasks?: boolean;
      workspaceMembers?: boolean;
      notifications?: boolean;
      capturedItems?: boolean;
      agenda?: boolean;
      adminUsers?: boolean;
      adminInvites?: boolean;
    },
  ) => Promise<void>;
  focusedItemKey: string | null;
  onAdvanceFocus: (item: TodayItem) => void;
  onError: (message: string | null) => void;
};

export function useTaskActions({
  tasks,
  setTasks,
  setAgenda,
  setNotifications,
  refreshAppData,
  focusedItemKey,
  onAdvanceFocus,
  onError,
}: UseTaskActionsOptions) {
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
  const [draft, setDraft] = useState<TaskDraft>(createEmptyDraft());
  const [commentDraft, setCommentDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reviewCaptureId, setReviewCaptureId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isCommentSaving, setIsCommentSaving] = useState(false);
  const [isAgendaRefreshing, setIsAgendaRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  function closeModal() {
    setDraft(createEmptyDraft());
    setEditingId(null);
    setReviewCaptureId(null);
    setTaskDetail(null);
    setCommentDraft("");
    onError(null);
    setIsDeleting(false);
    setIsDetailLoading(false);
    setIsCommentSaving(false);
    setIsModalOpen(false);
  }

  function openCreateModal() {
    setDraft(createEmptyDraft());
    setEditingId(null);
    setReviewCaptureId(null);
    setTaskDetail(null);
    setCommentDraft("");
    onError(null);
    setIsModalOpen(true);
  }

  function openCreateWithDraft(nextDraft: TaskDraft) {
    setDraft(nextDraft);
    setEditingId(null);
    setReviewCaptureId(null);
    setTaskDetail(null);
    setCommentDraft("");
    onError(null);
    setIsModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    onError(null);

    try {
      let savedTask: Task | null = null;

      if (editingId) {
        savedTask = await updateTask(editingId, draft);
      } else if (reviewCaptureId) {
        await acceptCapturedItem(reviewCaptureId, draft);
      } else {
        savedTask = await createTask(draft);
      }

      if (savedTask) {
        setTasks((current) => {
          const existingIndex = current.findIndex((task) => task.id === savedTask!.id);
          if (existingIndex === -1) {
            return sortByDueDate([...current, savedTask!]);
          }

          const next = current.slice();
          next[existingIndex] = savedTask!;
          return sortByDueDate(next);
        });
      }

      await refreshAppData(undefined, {
        tasks: true,
        agenda: true,
      });
      closeModal();
    } catch (error) {
      onError(toErrorMessage(error, "Could not save task."));
    } finally {
      setIsSaving(false);
    }
  }

  async function startEdit(task: Task) {
    setEditingId(task.id);
    setReviewCaptureId(null);
    setDraft({
      title: task.title,
      details: task.details,
      links: task.links.join("\n"),
      dueDate: task.dueDate,
      remindAt: toDateTimeLocal(task.remindAt),
      status: task.status,
      assigneeId: task.assigneeId ?? "",
      isRecurring: task.isRecurring,
      recurrenceRule: task.recurrenceRule === "none" ? "daily" : task.recurrenceRule,
      importance: task.importance,
    });
    setTaskDetail(null);
    setCommentDraft("");
    onError(null);
    setIsModalOpen(true);

    try {
      setIsDetailLoading(true);
      const detail = await fetchTaskDetail(task.id);
      setTaskDetail(detail);
      if (detail) {
        setDraft({
          title: detail.task.title,
          details: detail.task.details,
          links: detail.task.links.join("\n"),
          dueDate: detail.task.dueDate,
          remindAt: toDateTimeLocal(detail.task.remindAt),
          status: detail.task.status,
          assigneeId: detail.task.assigneeId ?? "",
          isRecurring: detail.task.isRecurring,
          recurrenceRule: detail.task.recurrenceRule === "none" ? "daily" : detail.task.recurrenceRule,
          importance: detail.task.importance,
        });
      }
    } catch (error) {
      onError(toErrorMessage(error, "Could not load task discussion."));
    } finally {
      setIsDetailLoading(false);
    }
  }

  function startCaptureReview(item: CapturedItem) {
    setEditingId(null);
    setReviewCaptureId(item.id);
    setDraft(createDraftFromCapture(item));
    setTaskDetail(null);
    setCommentDraft("");
    onError(null);
    setIsModalOpen(true);
  }

  async function handleCommentSubmit() {
    if (!editingId || commentDraft.trim().length === 0) {
      return;
    }

    setIsCommentSaving(true);
    onError(null);

    try {
      const nextDetail = await createTaskComment(editingId, commentDraft);
      setTaskDetail(nextDetail);
      setCommentDraft("");

      try {
        setNotifications(await fetchNotifications());
      } catch {
        // Do not surface notification refresh failures as comment-save failures.
      }
    } catch (error) {
      onError(toErrorMessage(error, "Could not add comment."));
    } finally {
      setIsCommentSaving(false);
    }
  }

  async function moveTask(taskId: string, status: TaskStatus) {
    const existing = tasks.find((task) => task.id === taskId);
    if (!existing || existing.status === status) {
      return;
    }

    const previousTasks = tasks;
    const optimistic = sortByDueDate(tasks.map((task) => (task.id === taskId ? { ...task, status } : task)));
    setTasks(optimistic);
    onError(null);

    try {
      await updateTaskStatus(taskId, status);
      await refreshAppData(undefined, { tasks: true, agenda: true });
    } catch (error) {
      setTasks(previousTasks);
      onError(toErrorMessage(error, "Could not move task."));
    }
  }

  async function handleTodayStatusChange(item: TodayItem, status: TaskStatus) {
    if (item.status === status) {
      return;
    }

    onError(null);

    try {
      await updateTodayItemStatus(item.sourceType, item.id, status);
      await refreshAppData(undefined, { tasks: true, agenda: true });

      if (status === "done" && focusedItemKey === `${item.sourceType}:${item.id}`) {
        onAdvanceFocus(item);
      }
    } catch (error) {
      onError(toErrorMessage(error, "Could not update agenda item."));
    }
  }

  async function handleGenerateAgenda() {
    setIsAgendaRefreshing(true);
    onError(null);

    try {
      const nextAgenda = await generateTodayAgenda();
      const nextTasks = await fetchTasks();
      setAgenda(nextAgenda);
      setTasks(sortByDueDate(nextTasks));
    } catch (error) {
      onError(toErrorMessage(error, "Could not generate agenda."));
    } finally {
      setIsAgendaRefreshing(false);
    }
  }

  async function handleArchiveTask() {
    if (!editingId) {
      return;
    }

    setIsSaving(true);
    onError(null);

    try {
      await archiveTask(editingId);
      await refreshAppData(undefined, { tasks: true, agenda: true });
      closeModal();
    } catch (error) {
      onError(toErrorMessage(error, "Could not archive task."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteTask() {
    if (!editingId) {
      return;
    }

    setIsDeleting(true);
    onError(null);

    try {
      await deleteTask(editingId);
      await refreshAppData(undefined, { tasks: true, agenda: true });
      closeModal();
    } catch (error) {
      onError(toErrorMessage(error, "Could not delete task."));
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleSkipTodayItem(item: TodayItem) {
    onError(null);

    try {
      await skipTodayItem(item.sourceType, item.id);
      await refreshAppData(undefined, { tasks: true, agenda: true });

      if (focusedItemKey === `${item.sourceType}:${item.id}`) {
        onAdvanceFocus(item);
      }
    } catch (error) {
      onError(toErrorMessage(error, "Could not skip agenda item."));
    }
  }

  async function handleSnoozeTodayItem(item: TodayItem) {
    onError(null);

    try {
      await snoozeTodayItem(item.sourceType, item.id);
      await refreshAppData(undefined, { tasks: true, agenda: true });

      if (focusedItemKey === `${item.sourceType}:${item.id}`) {
        onAdvanceFocus(item);
      }
    } catch (error) {
      onError(toErrorMessage(error, "Could not snooze agenda item."));
    }
  }

  return {
    taskDetail,
    draft,
    setDraft,
    commentDraft,
    setCommentDraft,
    editingId,
    reviewCaptureId,
    draggedTaskId,
    setDraggedTaskId,
    isSaving,
    isDeleting,
    isDetailLoading,
    isCommentSaving,
    isAgendaRefreshing,
    isModalOpen,
    closeModal,
    openCreateModal,
    openCreateWithDraft,
    handleSubmit,
    startEdit,
    startCaptureReview,
    handleCommentSubmit,
    moveTask,
    handleTodayStatusChange,
    handleGenerateAgenda,
    handleArchiveTask,
    handleDeleteTask,
    handleSkipTodayItem,
    handleSnoozeTodayItem,
  };
}
