import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  createTaskPlaybook,
  createTaskTemplate,
  deleteTaskPlaybook,
  deleteTaskTemplate,
  disconnectOutlookCalendar,
  fetchInvite,
  fetchOutlookCalendarEvents,
  fetchOutlookCalendarStatus,
  fetchTaskPlaybooks,
  fetchTaskTemplates,
  fetchSession,
  getOutlookConnectUrl,
  type OutlookCalendarEvent,
  type OutlookCalendarStatus,
  type TaskPlaybook,
  type TaskTemplate,
  type WorkspaceInviteLookup,
  runTaskPlaybook,
} from "./api";
import { AgendaView } from "./features/agenda/AgendaView";
import { SideRail } from "./features/layout/SideRail";
import { InboxView } from "./features/inbox/InboxView";
import { NotificationsView } from "./features/notifications/NotificationsView";
import { AdminView } from "./features/admin/AdminView";
import { OneOnOnesView } from "./features/one-on-ones/OneOnOnesView";
import { TeamView } from "./features/team/TeamView";
import {
  AppView,
  VIEW_ICONS,
  VIEW_LABELS,
  buildAvailableViews,
  buildWorkspaceOptions,
  findTaskForTodayItem,
  getItemWorkspaceLabel,
} from "./features/app/app-shell";
import { LoadingShell } from "./features/app/LoadingShell";
import { useBrandTooltip } from "./features/app/useBrandTooltip";
import { useAppData, ALL_WORKSPACES_ID } from "./features/app/useAppData";
import { useAppViewModel } from "./features/app/useAppViewModel";
import { useFocusMode } from "./features/app/useFocusMode";
import { AuthCard } from "./features/auth/AuthCard";
import { useAuthActions } from "./features/auth/useAuthActions";
import { FocusView } from "./features/focus/FocusView";
import { useAdminActions } from "./features/admin/useAdminActions";
import { useInboxActions } from "./features/inbox/useInboxActions";
import { getTaskTone, getTodayParts, getTodayReason, isToday } from "./features/agenda/utils";
import {
  createDraftFromTemplate,
  IMPORTANCE_LABELS,
  RECURRENCE_LABELS,
  ROLE_LABELS,
  STATUS_ICONS,
  STATUS_LABELS,
  STATUS_ORDER,
} from "./features/tasks/config";
import { TaskModal } from "./features/tasks/TaskModal";
import { useNotificationActions } from "./features/notifications/useNotificationActions";
import { useTaskActions } from "./features/tasks/useTaskActions";
import { WorkflowHero } from "./features/workflow/WorkflowHero";
import { WorkflowView, type WorkflowFilter } from "./features/workflow/WorkflowView";
import { formatDueLabel, formatReminderLabel } from "./lib/formatters";

export default function App() {
  const [error, setError] = useState<string | null>(null);
  const [outlookStatus, setOutlookStatus] = useState<OutlookCalendarStatus | null>(null);
  const [outlookEvents, setOutlookEvents] = useState<OutlookCalendarEvent[]>([]);
  const [isOutlookLoading, setIsOutlookLoading] = useState(false);
  const {
    session,
    adminUsers,
    hasLoadedAdminUsers,
    adminWorkspaces,
    hasLoadedAdminWorkspaces,
    adminInvites,
    hasLoadedAdminInvites,
    workspaceMembers,
    hasLoadedWorkspaceMembers,
    directReports,
    hasLoadedDirectReports,
    setDirectReports,
    tasks,
    hasLoadedTasks,
    setTasks,
    agenda,
    hasLoadedAgenda,
    setAgenda,
    capturedItems,
    hasLoadedCapturedItems,
    notifications,
    hasLoadedNotifications,
    setNotifications,
    isLoading,
    isWorkspaceSwitching,
    refreshAppData,
    applyAuthenticatedSession,
    clearSessionData,
    switchActiveWorkspace,
  } = useAppData({
    onError: useCallback((message: string) => setError(message), []),
  });
  const [activeView, setActiveView] = useState<AppView>("workflow");
  const [hideDoneInWorkflow, setHideDoneInWorkflow] = useState(false);
  const [workflowFilter, setWorkflowFilter] = useState<WorkflowFilter>("all");
  const [inviteLookup, setInviteLookup] = useState<WorkspaceInviteLookup | null>(null);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [taskPlaybooks, setTaskPlaybooks] = useState<TaskPlaybook[]>([]);
  const [hasLoadedWorkflowAssets, setHasLoadedWorkflowAssets] = useState(false);
  const [runningPlaybookId, setRunningPlaybookId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateDetails, setTemplateDetails] = useState("");
  const [templateDueDaysOffset, setTemplateDueDaysOffset] = useState("0");
  const [templateStatus, setTemplateStatus] = useState<keyof typeof STATUS_LABELS>("todo");
  const [templateImportance, setTemplateImportance] = useState<keyof typeof IMPORTANCE_LABELS>("medium");
  const [playbookName, setPlaybookName] = useState("");
  const [playbookDescription, setPlaybookDescription] = useState("");
  const [playbookItemsText, setPlaybookItemsText] = useState("");
  const [isTemplateSaving, setIsTemplateSaving] = useState(false);
  const [isPlaybookSaving, setIsPlaybookSaving] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [deletingPlaybookId, setDeletingPlaybookId] = useState<string | null>(null);

  const canManageUsers = Boolean(session?.permissions.canManageUsers);
  const canCreateWorkspaces = Boolean(session?.permissions.canCreateWorkspaces);
  const canPromoteToOwner = Boolean(session?.permissions.canPromoteToOwner);
  const canResetPasswords = Boolean(session?.permissions.canResetPasswords);
  const canAssignTasks = Boolean(session?.permissions.canAssignTasks);
  const isGodMode = Boolean(session?.user.isGodMode);
  const canSwitchWorkspace = (session?.workspaces.length ?? 0) > 1 || isGodMode;
  const isAllWorkspacesMode = session?.workspace.id === ALL_WORKSPACES_ID;
  const {
    isBrandTooltipVisible,
    brandTooltipPosition,
    brandMarkRef,
    showBrandTooltip,
    hideBrandTooltip,
  } = useBrandTooltip();

  const todayItems = agenda?.items ?? [];

  const {
    focusedItemKey,
    startFocus,
    exitFocusMode,
    moveToNextFocusItem,
  } = useFocusMode({
    setActiveView,
    onError: setError,
  });

  const {
    focusedItem,
    stats,
    doneWorkflowCount,
    sortedAgendaItems,
    nextFocusItem,
    focusNowItems,
    agendaSections,
    unreadNotificationsCount,
    railCounts,
  } = useAppViewModel({
    tasks,
    capturedItems,
    notifications,
    todayItems,
    focusedItemKey,
    isAllWorkspacesMode,
  });

  const {
    authMode,
    setAuthMode,
    authNotice,
    isAuthSubmitting,
    handleAuthSubmit,
    handleLogout,
  } = useAuthActions({
    applyAuthenticatedSession,
    clearSessionData,
    onError: setError,
    onAfterLogout: () => {
      resetAdminForm();
      closeModal();
    },
  });

  const {
    taskDetail,
    draft,
    setDraft,
    commentDraft,
    setCommentDraft,
    editingId,
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
  } = useTaskActions({
    tasks,
    setTasks,
    setAgenda,
    setNotifications,
    refreshAppData,
    focusedItemKey,
    onAdvanceFocus: (item) => moveToNextFocusItem(item, sortedAgendaItems),
    onError: setError,
  });

  const {
    adminForm,
    setAdminForm,
    inviteForm,
    setInviteForm,
    adminEditingUserId,
    isAdminSaving,
    isInviteSaving,
    isPasswordResettingUserId,
    inviteLink,
    revokingInviteId,
    workspaceForm,
    setWorkspaceForm,
    isWorkspaceSaving,
    createdWorkspace,
    updatingWorkspaceId,
    togglingWorkspaceId,
    appConfigForm,
    setAppConfigForm,
    hasLoadedAppConfig,
    isAppConfigSaving,
    resetAdminForm,
    resetInviteForm,
    resetWorkspaceForm,
    resetAppConfigForm,
    ensureAppConfigLoaded,
    startAdminEdit,
    handleResetUserPassword,
    handleAdminSubmit,
    handleInviteSubmit,
    handleRevokeInvite,
    handleWorkspaceSubmit,
    handleWorkspaceSettingsSubmit,
    handleWorkspaceStatusChange,
    handleAppConfigSubmit,
  } = useAdminActions({
    canManageUsers,
    canCreateWorkspaces,
    canPromoteToOwner,
    canResetPasswords,
    refreshAppData,
    refreshSession: async () => {
      const nextSession = await fetchSession();
      if (nextSession) {
        await applyAuthenticatedSession(nextSession);
      }
      return nextSession;
    },
    onError: setError,
    onNavigateAdmin: () => setActiveView("admin"),
  });

  const {
    handleDiscardCapture,
    handleCreateDemoSlackCapture,
  } = useInboxActions({
    refreshAppData,
    onError: setError,
  });

  const {
    handleMarkNotificationRead,
    handleMarkAllNotificationsRead,
    handleOpenNotification,
  } = useNotificationActions({
    tasks,
    setNotifications,
    onError: setError,
    onOpenTask: startEdit,
  });

  const promotedCount = agenda?.promotedTaskCount ?? 0;
  const todayBadge = getTodayParts();
  const availableViews = buildAvailableViews({
    focusedItem,
    canManageUsers,
  });
  const workspaceOptions = session
    ? buildWorkspaceOptions({ session, isGodMode })
    : [];
  const handleWorkspaceChange = useCallback(
    (nextWorkspaceId: string) => {
      void switchActiveWorkspace(nextWorkspaceId);
    },
    [switchActiveWorkspace],
  );
  const handleOpenAgendaTask = useCallback(
    (item: Parameters<typeof findTaskForTodayItem>[1]) => {
      const sourceTask = findTaskForTodayItem(tasks, item);

      if (sourceTask) {
        void startEdit(sourceTask);
      }
    },
    [tasks, startEdit],
  );
  const handleOpenOneOnOneTask = useCallback(
    (taskId: string) => {
      const sourceTask = tasks.find((task) => task.id === taskId);

      if (sourceTask) {
        void startEdit(sourceTask);
        return;
      }

      setError("Could not find that task in the current workspace.");
    },
    [tasks, startEdit],
  );

  const workflowTasks = tasks.filter((task) => {
    switch (workflowFilter) {
      case "assigned":
        return task.assigneeId === session?.user.id;
      case "created":
        return task.createdById === session?.user.id;
      case "unassigned":
        return task.assigneeId === null;
      case "one-on-ones":
        return task.isPrivate;
      default:
        return true;
    }
  });

  const activeTaskPermissions =
    editingId
      ? taskDetail?.task.permissions ?? tasks.find((task) => task.id === editingId)?.permissions ?? null
      : null;

  const loadWorkflowAssets = useCallback(async () => {
    const [templates, playbooks] = await Promise.all([fetchTaskTemplates(), fetchTaskPlaybooks()]);
    setTaskTemplates(templates);
    setTaskPlaybooks(playbooks);
    setHasLoadedWorkflowAssets(true);
  }, []);

  const formatCalendarEventRange = useCallback((event: OutlookCalendarEvent) => {
    if (event.isAllDay) {
      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        weekday: "short",
      }).format(new Date(event.startsAt));
    }

    const formatter = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });

    return `${formatter.format(new Date(event.startsAt))} - ${new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(event.endsAt))}`;
  }, []);

  useEffect(() => {
    if (!session || hasLoadedTasks) {
      return;
    }

    void refreshAppData(session, { tasks: true });
  }, [hasLoadedTasks, refreshAppData, session]);

  useEffect(() => {
    if (!session || activeView !== "agenda" || isAllWorkspacesMode || hasLoadedAgenda) {
      return;
    }

    void refreshAppData(session, { agenda: true });
  }, [activeView, hasLoadedAgenda, isAllWorkspacesMode, refreshAppData, session]);

  useEffect(() => {
    if (!session || activeView !== "agenda" || isAllWorkspacesMode) {
      return;
    }

    let isCancelled = false;

    async function loadOutlookCalendar() {
      try {
        setIsOutlookLoading(true);
        const status = await fetchOutlookCalendarStatus();
        if (isCancelled) {
          return;
        }

        setOutlookStatus(status);

        if (!status.isConnected) {
          setOutlookEvents([]);
          return;
        }

        const start = new Date();
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        const events = await fetchOutlookCalendarEvents(start.toISOString(), end.toISOString());

        if (!isCancelled) {
          setOutlookEvents(events);
        }
      } catch (calendarError) {
        if (!isCancelled) {
          setOutlookStatus(null);
          setOutlookEvents([]);
          setError(calendarError instanceof Error ? calendarError.message : "Could not load Outlook calendar.");
        }
      } finally {
        if (!isCancelled) {
          setIsOutlookLoading(false);
        }
      }
    }

    void loadOutlookCalendar();

    return () => {
      isCancelled = true;
    };
  }, [activeView, isAllWorkspacesMode, session]);

  useEffect(() => {
    if (!session || activeView !== "inbox" || hasLoadedCapturedItems) {
      return;
    }

    void refreshAppData(session, { capturedItems: true });
  }, [activeView, hasLoadedCapturedItems, refreshAppData, session]);

  useEffect(() => {
    if (!session || activeView !== "notifications" || hasLoadedNotifications) {
      return;
    }

    void refreshAppData(session, { notifications: true });
  }, [activeView, hasLoadedNotifications, refreshAppData, session]);

  useEffect(() => {
    if (!session || (activeView !== "one-on-ones" && activeView !== "team")) {
      return;
    }

    const needsReports = !hasLoadedDirectReports;

    if (!needsReports) {
      return;
    }

    void refreshAppData(session, {
      directReports: needsReports,
      tasks: false,
      agenda: false,
      notifications: false,
      capturedItems: false,
      adminUsers: false,
      adminInvites: false,
      adminWorkspaces: false,
    });
  }, [activeView, hasLoadedDirectReports, refreshAppData, session]);

  useEffect(() => {
    if (
      !session ||
      activeView !== "admin" ||
      ((!canManageUsers || (hasLoadedAdminUsers && hasLoadedAdminInvites)) &&
        (!canCreateWorkspaces || hasLoadedAdminWorkspaces))
    ) {
      return;
    }

    void refreshAppData(session, {
      adminUsers: canManageUsers,
      adminInvites: canManageUsers,
      adminWorkspaces: canCreateWorkspaces,
    });
  }, [
    activeView,
    canCreateWorkspaces,
    canManageUsers,
    hasLoadedAdminInvites,
    hasLoadedAdminUsers,
    hasLoadedAdminWorkspaces,
    refreshAppData,
    session,
  ]);

  useEffect(() => {
    if (
      !session ||
      !canCreateWorkspaces ||
      (activeView !== "admin" && activeView !== "one-on-ones" && activeView !== "team")
    ) {
      return;
    }

    void ensureAppConfigLoaded();
  }, [activeView, canCreateWorkspaces, ensureAppConfigLoaded, session]);

  useEffect(() => {
    if (
      !session ||
      isAllWorkspacesMode ||
      hasLoadedWorkflowAssets ||
      (activeView !== "workflow" && activeView !== "admin")
    ) {
      return;
    }

    void loadWorkflowAssets().catch((assetError) => {
      setError(assetError instanceof Error ? assetError.message : "Could not load task templates.");
    });
  }, [activeView, hasLoadedWorkflowAssets, isAllWorkspacesMode, loadWorkflowAssets, session]);

  useEffect(() => {
    if (!session || !isModalOpen || hasLoadedWorkspaceMembers) {
      return;
    }

    void refreshAppData(session, { workspaceMembers: true });
  }, [hasLoadedWorkspaceMembers, isModalOpen, refreshAppData, session]);

  useEffect(() => {
    setTaskTemplates([]);
    setTaskPlaybooks([]);
    setHasLoadedWorkflowAssets(false);
  }, [session?.workspace.id]);

  useEffect(() => {
    if (session) {
      const params = new URLSearchParams(window.location.search);
      const calendar = params.get("calendar");
      const calendarDetail = params.get("calendarDetail");
      if (calendar) {
        setActiveView("agenda");
        if (calendar === "error") {
          setError(calendarDetail ? `Outlook calendar connection failed: ${calendarDetail}.` : "Outlook calendar connection failed.");
        }
        params.delete("calendar");
        params.delete("calendarDetail");
        const nextQuery = params.toString();
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
        window.history.replaceState({}, "", nextUrl);
      }
      setInviteLookup(null);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite");
    if (!token) {
      setInviteLookup(null);
      return;
    }

    void fetchInvite(token)
      .then((result) => {
        setInviteLookup(result);
        setAuthMode("register");
      })
      .catch((inviteError) => {
        setInviteLookup(null);
        setError(inviteError instanceof Error ? inviteError.message : "Could not load invite.");
      });
  }, [session, setAuthMode]);

  if (isLoading) {
    return <LoadingShell />;
  }

  if (!session) {
    return (
      <AuthCard
        error={error}
        notice={authNotice}
        isSubmitting={isAuthSubmitting}
        mode={authMode}
        inviteLookup={inviteLookup}
        onModeChange={setAuthMode}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  function handleConnectOutlookCalendar() {
    window.location.assign(getOutlookConnectUrl());
  }

  async function handleDisconnectOutlookCalendar() {
    try {
      setIsOutlookLoading(true);
      await disconnectOutlookCalendar();
      setOutlookStatus((current) =>
        current
          ? {
              ...current,
              isConnected: false,
              accountEmail: null,
              expiresAt: null,
            }
          : null,
      );
      setOutlookEvents([]);
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : "Could not disconnect Outlook calendar.");
    } finally {
      setIsOutlookLoading(false);
    }
  }

  async function handleCreateTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setIsTemplateSaving(true);
      setError(null);
      const created = await createTaskTemplate({
        name: templateName,
        title: templateTitle,
        details: templateDetails,
        status: templateStatus,
        importance: templateImportance,
        dueDaysOffset: Number.parseInt(templateDueDaysOffset, 10) || 0,
        remindDaysOffset: null,
        isRecurring: false,
        recurrenceRule: "none",
        links: [],
      });
      setTaskTemplates((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setTemplateName("");
      setTemplateTitle("");
      setTemplateDetails("");
      setTemplateDueDaysOffset("0");
      setTemplateStatus("todo");
      setTemplateImportance("medium");
    } catch (templateError) {
      setError(templateError instanceof Error ? templateError.message : "Could not save template.");
    } finally {
      setIsTemplateSaving(false);
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    try {
      setDeletingTemplateId(templateId);
      setError(null);
      await deleteTaskTemplate(templateId);
      setTaskTemplates((current) => current.filter((template) => template.id !== templateId));
    } catch (templateError) {
      setError(templateError instanceof Error ? templateError.message : "Could not delete template.");
    } finally {
      setDeletingTemplateId(null);
    }
  }

  async function handleCreatePlaybook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setIsPlaybookSaving(true);
      setError(null);
      const items = playbookItemsText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => {
          const [titlePart, offsetPart] = line.split("|").map((part) => part.trim());
          return {
            title: titlePart,
            details: "",
            status: "todo" as const,
            importance: "medium" as const,
            dueDaysOffset: offsetPart ? Number.parseInt(offsetPart, 10) || index : index,
            remindDaysOffset: null,
            isRecurring: false,
            recurrenceRule: "none" as const,
            links: [],
          };
        });

      const created = await createTaskPlaybook({
        name: playbookName,
        description: playbookDescription,
        items,
      });
      setTaskPlaybooks((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setPlaybookName("");
      setPlaybookDescription("");
      setPlaybookItemsText("");
    } catch (playbookError) {
      setError(playbookError instanceof Error ? playbookError.message : "Could not save playbook.");
    } finally {
      setIsPlaybookSaving(false);
    }
  }

  async function handleDeletePlaybook(playbookId: string) {
    try {
      setDeletingPlaybookId(playbookId);
      setError(null);
      await deleteTaskPlaybook(playbookId);
      setTaskPlaybooks((current) => current.filter((playbook) => playbook.id !== playbookId));
    } catch (playbookError) {
      setError(playbookError instanceof Error ? playbookError.message : "Could not delete playbook.");
    } finally {
      setDeletingPlaybookId(null);
    }
  }

  async function handleRunPlaybook(playbook: TaskPlaybook) {
    try {
      setRunningPlaybookId(playbook.id);
      setError(null);
      await runTaskPlaybook(playbook.id);
      await refreshAppData(undefined, { tasks: true, agenda: true });
    } catch (playbookError) {
      setError(playbookError instanceof Error ? playbookError.message : "Could not run playbook.");
    } finally {
      setRunningPlaybookId(null);
    }
  }

  return (
    <>
      <div className="app-shell">
        <SideRail
          activeView={activeView}
          availableViews={availableViews}
          railCounts={railCounts}
          viewIcons={VIEW_ICONS}
          viewLabels={VIEW_LABELS}
          sessionWorkspaceName={session.workspace.name}
          sessionUserName={session.user.name}
          sessionWorkspaceId={session.workspace.id}
          sessionWorkspacesCount={session.workspaces.length}
          isGodMode={isGodMode}
          isBrandTooltipVisible={isBrandTooltipVisible}
          brandMarkRef={brandMarkRef}
          brandTooltipPosition={brandTooltipPosition}
          onShowBrandTooltip={showBrandTooltip}
          onHideBrandTooltip={hideBrandTooltip}
          onChangeView={setActiveView}
          onLogout={() => void handleLogout()}
        />

        <main className="workspace workspace-full">
          {activeView === "focus" && (
            <FocusView
              focusedItem={focusedItem}
              nextFocusItem={nextFocusItem}
              todayBadge={todayBadge}
              isAllWorkspacesMode={isAllWorkspacesMode}
              getItemWorkspaceLabel={getItemWorkspaceLabel}
              formatDueLabel={formatDueLabel}
              formatReminderLabel={formatReminderLabel}
              getTodayReason={getTodayReason}
              onExitFocus={exitFocusMode}
              onStatusChange={(item, status) => void handleTodayStatusChange(item, status)}
              onSkip={(item) => void handleSkipTodayItem(item)}
              onSnooze={(item) => void handleSnoozeTodayItem(item)}
            />
          )}
          {activeView === "workflow" && (
            <WorkflowHero
              error={error}
              isGodMode={isGodMode}
              isAllWorkspacesMode={isAllWorkspacesMode}
              canSwitchWorkspace={canSwitchWorkspace}
              isWorkspaceSwitching={isWorkspaceSwitching}
              workspaceId={session.workspace.id}
              workspaces={workspaceOptions}
              todayBadge={todayBadge}
              stats={stats}
              onChangeWorkspace={handleWorkspaceChange}
            />
          )}

          {activeView === "inbox" && (
            <InboxView
              capturedItems={capturedItems}
              isAllWorkspacesMode={isAllWorkspacesMode}
              todayBadge={todayBadge}
              getItemWorkspaceLabel={getItemWorkspaceLabel}
              onCreateDemoSlackCapture={() => void handleCreateDemoSlackCapture()}
              onStartCaptureReview={startCaptureReview}
              onDiscardCapture={(itemId) => void handleDiscardCapture(itemId)}
            />
          )}

          {activeView === "notifications" && (
            <NotificationsView
              notifications={notifications}
              unreadNotificationsCount={unreadNotificationsCount}
              todayBadge={todayBadge}
              onMarkAllRead={() => void handleMarkAllNotificationsRead()}
              onMarkRead={(id) => void handleMarkNotificationRead(id)}
              onOpenNotification={(notification) => void handleOpenNotification(notification)}
            />
          )}

          {activeView === "team" && (
            <TeamView
              directReports={directReports}
              setDirectReports={setDirectReports}
              directReportNameOptions={appConfigForm.directReportNameOptions}
              directReportRoleOptions={appConfigForm.directReportRoleOptions}
              todayBadge={todayBadge}
              onError={setError}
            />
          )}

          {activeView === "one-on-ones" && (
            <OneOnOnesView
              directReports={directReports}
              setDirectReports={setDirectReports}
              todayBadge={todayBadge}
              onError={setError}
              onOpenTask={handleOpenOneOnOneTask}
            />
          )}

          {activeView === "agenda" && (
            <AgendaView
              todayBadge={todayBadge}
              isAllWorkspacesMode={isAllWorkspacesMode}
              sortedAgendaItems={sortedAgendaItems}
              focusNowItems={focusNowItems}
              agendaSections={agendaSections}
              promotedCount={promotedCount}
              isAgendaRefreshing={isAgendaRefreshing}
              outlookStatus={outlookStatus}
              outlookEvents={outlookEvents}
              isOutlookLoading={isOutlookLoading}
              focusedItemKey={focusedItemKey}
              getItemWorkspaceLabel={getItemWorkspaceLabel}
              formatDueLabel={formatDueLabel}
              formatReminderLabel={formatReminderLabel}
              getTodayReason={getTodayReason}
              formatCalendarEventRange={formatCalendarEventRange}
              onConnectOutlookCalendar={handleConnectOutlookCalendar}
              onDisconnectOutlookCalendar={() => void handleDisconnectOutlookCalendar()}
              onGenerateAgenda={() => void handleGenerateAgenda()}
              onFocus={startFocus}
              onOpenTask={handleOpenAgendaTask}
              onStatusChange={(item, status) => void handleTodayStatusChange(item, status)}
              onSkip={(item) => void handleSkipTodayItem(item)}
              onSnooze={(item) => void handleSnoozeTodayItem(item)}
            />
          )}

          {activeView === "workflow" && (
            <WorkflowView
              tasks={workflowTasks}
              statusOrder={STATUS_ORDER}
              statusLabels={STATUS_LABELS}
              statusIcons={STATUS_ICONS}
              importanceLabels={IMPORTANCE_LABELS}
              recurrenceLabels={RECURRENCE_LABELS}
              hideDoneInWorkflow={hideDoneInWorkflow}
              doneWorkflowCount={doneWorkflowCount}
              isAllWorkspacesMode={isAllWorkspacesMode}
              getItemWorkspaceLabel={getItemWorkspaceLabel}
              formatDueLabel={formatDueLabel}
              formatReminderLabel={formatReminderLabel}
              getTaskTone={getTaskTone}
              isToday={(value) => Boolean(value && isToday(value))}
              workflowFilter={workflowFilter}
              taskTemplates={taskTemplates}
              taskPlaybooks={taskPlaybooks}
              runningPlaybookId={runningPlaybookId}
              onWorkflowFilterChange={setWorkflowFilter}
              onOpenCreate={openCreateModal}
              onUseTemplate={(template) => openCreateWithDraft(createDraftFromTemplate(template))}
              onRunPlaybook={(playbook) => void handleRunPlaybook(playbook)}
              onToggleHideDone={setHideDoneInWorkflow}
              onMoveTask={(taskId, status) => void moveTask(taskId, status)}
              onStartEdit={(task) => void startEdit(task)}
              draggedTaskId={draggedTaskId}
              setDraggedTaskId={setDraggedTaskId}
            />
          )}

          {activeView === "admin" && canManageUsers && (
            <AdminView
              adminUsers={adminUsers}
              adminWorkspaces={adminWorkspaces}
              adminInvites={adminInvites}
              adminForm={adminForm}
              inviteForm={inviteForm}
              adminEditingUserId={adminEditingUserId}
              isAdminSaving={isAdminSaving}
              isInviteSaving={isInviteSaving}
              canCreateWorkspaces={canCreateWorkspaces}
              canPromoteToOwner={canPromoteToOwner}
              canResetPasswords={canResetPasswords}
              isPasswordResettingUserId={isPasswordResettingUserId}
              inviteLink={inviteLink}
              revokingInviteId={revokingInviteId}
              workspaceForm={workspaceForm}
              isWorkspaceSaving={isWorkspaceSaving}
              createdWorkspace={createdWorkspace}
              updatingWorkspaceId={updatingWorkspaceId}
              togglingWorkspaceId={togglingWorkspaceId}
              appConfigForm={appConfigForm}
              hasLoadedAppConfig={hasLoadedAppConfig}
              isAppConfigSaving={isAppConfigSaving}
              taskTemplates={taskTemplates}
              taskPlaybooks={taskPlaybooks}
              templateName={templateName}
              templateTitle={templateTitle}
              templateDetails={templateDetails}
              templateDueDaysOffset={templateDueDaysOffset}
              templateStatus={templateStatus}
              templateImportance={templateImportance}
              playbookName={playbookName}
              playbookDescription={playbookDescription}
              playbookItemsText={playbookItemsText}
              isTemplateSaving={isTemplateSaving}
              isPlaybookSaving={isPlaybookSaving}
              deletingTemplateId={deletingTemplateId}
              deletingPlaybookId={deletingPlaybookId}
              roleLabels={ROLE_LABELS}
              todayBadge={todayBadge}
              workspaceName={session.workspace.name}
              onResetForm={resetAdminForm}
              onResetInviteForm={resetInviteForm}
              onResetWorkspaceForm={resetWorkspaceForm}
              onResetAppConfigForm={resetAppConfigForm}
              onStartEdit={startAdminEdit}
              onResetPassword={(user) => void handleResetUserPassword(user)}
              onAdminFormChange={(updater) => setAdminForm((current) => updater(current))}
              onInviteFormChange={(updater) => setInviteForm((current) => updater(current))}
              onWorkspaceFormChange={(updater) => setWorkspaceForm((current) => updater(current))}
              onAppConfigFormChange={(updater) => setAppConfigForm((current) => updater(current))}
              onTemplateNameChange={setTemplateName}
              onTemplateTitleChange={setTemplateTitle}
              onTemplateDetailsChange={setTemplateDetails}
              onTemplateDueDaysOffsetChange={setTemplateDueDaysOffset}
              onTemplateStatusChange={setTemplateStatus}
              onTemplateImportanceChange={setTemplateImportance}
              onPlaybookNameChange={setPlaybookName}
              onPlaybookDescriptionChange={setPlaybookDescription}
              onPlaybookItemsTextChange={setPlaybookItemsText}
              onSubmit={(event) => void handleAdminSubmit(event)}
              onInviteSubmit={(event) => void handleInviteSubmit(event)}
              onWorkspaceSubmit={(event) => void handleWorkspaceSubmit(event)}
              onAppConfigSubmit={(event) => void handleAppConfigSubmit(event)}
              onTemplateSubmit={(event) => void handleCreateTemplate(event)}
              onDeleteTemplate={(templateId) => void handleDeleteTemplate(templateId)}
              onPlaybookSubmit={(event) => void handleCreatePlaybook(event)}
              onDeletePlaybook={(playbookId) => void handleDeletePlaybook(playbookId)}
              onWorkspaceSettingsSubmit={(workspaceId, payload) => void handleWorkspaceSettingsSubmit(workspaceId, payload)}
              onWorkspaceStatusChange={(workspaceId, isActive) => void handleWorkspaceStatusChange(workspaceId, isActive)}
              onRevokeInvite={(inviteId) => void handleRevokeInvite(inviteId)}
            />
          )}
        </main>
      </div>

      {isModalOpen && (
        <TaskModal
          draft={draft}
          editingId={editingId}
          error={error}
          isSaving={isSaving}
          isDeleting={isDeleting}
          isDetailLoading={isDetailLoading}
          isCommentSaving={isCommentSaving}
          taskDetail={taskDetail}
          commentDraft={commentDraft}
          workspaceMembers={workspaceMembers}
          currentUserId={session.user.id}
          canAssignTasks={canAssignTasks}
          taskPermissions={activeTaskPermissions}
          onArchive={editingId ? handleArchiveTask : null}
          onClose={closeModal}
          onCommentDraftChange={setCommentDraft}
          onCommentSubmit={handleCommentSubmit}
          onDelete={editingId ? handleDeleteTask : null}
          onSubmit={handleSubmit}
          onDraftChange={(updater) => setDraft((current) => updater(current))}
        />
      )}
    </>
  );
}
