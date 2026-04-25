import { useCallback, useEffect, useState } from "react";
import { fetchInvite, fetchSession, type WorkspaceInviteLookup } from "./api";
import { AgendaView } from "./features/agenda/AgendaView";
import { SideRail } from "./features/layout/SideRail";
import { InboxView } from "./features/inbox/InboxView";
import { NotificationsView } from "./features/notifications/NotificationsView";
import { AdminView } from "./features/admin/AdminView";
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
    resetAdminForm,
    resetInviteForm,
    resetWorkspaceForm,
    startAdminEdit,
    handleResetUserPassword,
    handleAdminSubmit,
    handleInviteSubmit,
    handleRevokeInvite,
    handleWorkspaceSubmit,
    handleWorkspaceSettingsSubmit,
    handleWorkspaceStatusChange,
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
    handleCreateDemoEmailCapture,
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

  const workflowTasks = tasks.filter((task) => {
    switch (workflowFilter) {
      case "assigned":
        return task.assigneeId === session?.user.id;
      case "created":
        return task.createdById === session?.user.id;
      case "unassigned":
        return task.assigneeId === null;
      default:
        return true;
    }
  });

  const activeTaskPermissions =
    editingId
      ? taskDetail?.task.permissions ?? tasks.find((task) => task.id === editingId)?.permissions ?? null
      : null;

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
    if (!session || !isModalOpen || hasLoadedWorkspaceMembers) {
      return;
    }

    void refreshAppData(session, { workspaceMembers: true });
  }, [hasLoadedWorkspaceMembers, isModalOpen, refreshAppData, session]);

  useEffect(() => {
    if (session) {
      setInviteLookup(null);
      return;
    }

    const token = new URLSearchParams(window.location.search).get("invite");
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
        isSubmitting={isAuthSubmitting}
        mode={authMode}
        inviteLookup={inviteLookup}
        onModeChange={setAuthMode}
        onSubmit={handleAuthSubmit}
      />
    );
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
              onCreateDemoEmailCapture={() => void handleCreateDemoEmailCapture()}
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

          {activeView === "agenda" && (
            <AgendaView
              todayBadge={todayBadge}
              isAllWorkspacesMode={isAllWorkspacesMode}
              sortedAgendaItems={sortedAgendaItems}
              focusNowItems={focusNowItems}
              agendaSections={agendaSections}
              promotedCount={promotedCount}
              isAgendaRefreshing={isAgendaRefreshing}
              focusedItemKey={focusedItemKey}
              getItemWorkspaceLabel={getItemWorkspaceLabel}
              formatDueLabel={formatDueLabel}
              formatReminderLabel={formatReminderLabel}
              getTodayReason={getTodayReason}
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
              onWorkflowFilterChange={setWorkflowFilter}
              onOpenCreate={openCreateModal}
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
              roleLabels={ROLE_LABELS}
              todayBadge={todayBadge}
              workspaceName={session.workspace.name}
              onResetForm={resetAdminForm}
              onResetInviteForm={resetInviteForm}
              onResetWorkspaceForm={resetWorkspaceForm}
              onStartEdit={startAdminEdit}
              onResetPassword={(user) => void handleResetUserPassword(user)}
              onAdminFormChange={(updater) => setAdminForm((current) => updater(current))}
              onInviteFormChange={(updater) => setInviteForm((current) => updater(current))}
              onWorkspaceFormChange={(updater) => setWorkspaceForm((current) => updater(current))}
              onSubmit={(event) => void handleAdminSubmit(event)}
              onInviteSubmit={(event) => void handleInviteSubmit(event)}
              onWorkspaceSubmit={(event) => void handleWorkspaceSubmit(event)}
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
