import { useEffect, useState } from "react";
import { AdminUser, AdminWorkspace, WorkspaceInvite, WorkspaceInviteRole, WorkspaceRole } from "../../api";
import { SectionHeader, SectionHeaderLead } from "../../components/layout/SectionHeader";
import { AppSelect } from "../../components/ui/AppSelect";
import { TodayCalendarBadge } from "../../components/ui/TodayCalendarBadge";
import { formatReceivedLabel } from "../../lib/formatters";
import type {
  AppConfigFormState,
  AdminFormState,
  InviteFormState,
  WorkspaceFormState,
  WorkspaceSettingsFormState,
} from "./useAdminActions";

type AdminViewProps = {
  adminUsers: AdminUser[];
  adminWorkspaces: AdminWorkspace[];
  adminInvites: WorkspaceInvite[];
  adminForm: AdminFormState;
  inviteForm: InviteFormState;
  adminEditingUserId: string | null;
  isAdminSaving: boolean;
  isInviteSaving: boolean;
  canCreateWorkspaces: boolean;
  canPromoteToOwner: boolean;
  canResetPasswords: boolean;
  isPasswordResettingUserId: string | null;
  inviteLink: string | null;
  revokingInviteId: string | null;
  workspaceForm: WorkspaceFormState;
  isWorkspaceSaving: boolean;
  createdWorkspace: AdminWorkspace | null;
  updatingWorkspaceId: string | null;
  togglingWorkspaceId: string | null;
  appConfigForm: AppConfigFormState;
  hasLoadedAppConfig: boolean;
  isAppConfigSaving: boolean;
  roleLabels: Record<WorkspaceRole, string>;
  todayBadge: { month: string; day: number; weekday: string };
  workspaceName: string;
  onResetForm: () => void;
  onResetInviteForm: () => void;
  onResetWorkspaceForm: () => void;
  onResetAppConfigForm: () => void;
  onStartEdit: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onAdminFormChange: (updater: (current: AdminFormState) => AdminFormState) => void;
  onInviteFormChange: (updater: (current: InviteFormState) => InviteFormState) => void;
  onWorkspaceFormChange: (updater: (current: WorkspaceFormState) => WorkspaceFormState) => void;
  onAppConfigFormChange: (updater: (current: AppConfigFormState) => AppConfigFormState) => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  onInviteSubmit: React.FormEventHandler<HTMLFormElement>;
  onWorkspaceSubmit: React.FormEventHandler<HTMLFormElement>;
  onAppConfigSubmit: React.FormEventHandler<HTMLFormElement>;
  onWorkspaceSettingsSubmit: (workspaceId: string, payload: WorkspaceSettingsFormState) => void;
  onWorkspaceStatusChange: (workspaceId: string, isActive: boolean) => void;
  onRevokeInvite: (inviteId: string) => void;
};

function buildWorkspaceDraft(workspace: AdminWorkspace): WorkspaceSettingsFormState {
  return {
    name: workspace.name,
    ownerUserId: workspace.ownerUserId,
    allowMemberTaskCreation: workspace.allowMemberTaskCreation,
  };
}

export function AdminView({
  adminUsers,
  adminWorkspaces,
  adminInvites,
  adminForm,
  inviteForm,
  adminEditingUserId,
  isAdminSaving,
  isInviteSaving,
  canCreateWorkspaces,
  canPromoteToOwner,
  canResetPasswords,
  isPasswordResettingUserId,
  inviteLink,
  revokingInviteId,
  workspaceForm,
  isWorkspaceSaving,
  createdWorkspace,
  updatingWorkspaceId,
  togglingWorkspaceId,
  appConfigForm,
  hasLoadedAppConfig,
  isAppConfigSaving,
  roleLabels,
  todayBadge,
  workspaceName,
  onResetForm,
  onResetInviteForm,
  onResetWorkspaceForm,
  onResetAppConfigForm,
  onStartEdit,
  onResetPassword,
  onAdminFormChange,
  onInviteFormChange,
  onWorkspaceFormChange,
  onAppConfigFormChange,
  onSubmit,
  onInviteSubmit,
  onWorkspaceSubmit,
  onAppConfigSubmit,
  onWorkspaceSettingsSubmit,
  onWorkspaceStatusChange,
  onRevokeInvite,
}: AdminViewProps) {
  const [workspaceDrafts, setWorkspaceDrafts] = useState<Record<string, WorkspaceSettingsFormState>>({});

  useEffect(() => {
    setWorkspaceDrafts((current) => {
      const next: Record<string, WorkspaceSettingsFormState> = {};

      adminWorkspaces.forEach((workspace) => {
        next[workspace.id] = current[workspace.id] ?? buildWorkspaceDraft(workspace);
      });

      return next;
    });
  }, [adminWorkspaces]);

  return (
    <section className="panel admin-panel">
      <SectionHeader
        wide
        eyebrow="Workspace Admin"
        title="Create and Manage User Accounts"
        leading={<TodayCalendarBadge month={todayBadge.month} day={todayBadge.day} weekday={todayBadge.weekday} />}
        actions={
          <>
            <span>{workspaceName}</span>
            {adminEditingUserId && (
              <button className="ghost-button" type="button" onClick={onResetForm}>
                New user
              </button>
            )}
          </>
        }
      />

      <div className="admin-grid">
        <section className="admin-form-panel">
          <div className="section-heading">
            <SectionHeaderLead>
              <p className="eyebrow">{adminEditingUserId ? "Edit user" : "Add user"}</p>
              <h2>{adminEditingUserId ? "Update account" : "Create account"}</h2>
            </SectionHeaderLead>
          </div>

          <form className="task-form" onSubmit={onSubmit}>
            <label>
              Name
              <input
                value={adminForm.name}
                onChange={(event) => onAdminFormChange((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={adminForm.email}
                onChange={(event) => onAdminFormChange((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={adminForm.password}
                onChange={(event) => onAdminFormChange((current) => ({ ...current, password: event.target.value }))}
                placeholder={adminEditingUserId ? "Leave blank to keep current password" : "At least 8 characters"}
                minLength={adminEditingUserId ? undefined : 8}
                autoComplete="new-password"
                required={!adminEditingUserId}
              />
            </label>

            <label>
              Role
              <AppSelect
                ariaLabel="Workspace role"
                className="app-select"
                menuClassName="app-select-menu"
                value={adminForm.role}
                options={(["user", "admin", ...(canPromoteToOwner ? ["owner"] : [])] as WorkspaceRole[]).map((role) => ({
                  value: role,
                  label: roleLabels[role],
                }))}
                onChange={(nextRole) => onAdminFormChange((current) => ({ ...current, role: nextRole }))}
              />
            </label>

            <div className="admin-form-actions">
              <button className="ghost-button" type="button" onClick={onResetForm}>
                Clear
              </button>
              <button className="primary-button" type="submit" disabled={isAdminSaving}>
                {isAdminSaving ? "Saving..." : adminEditingUserId ? "Save user" : "Create user"}
              </button>
            </div>
          </form>

          <div className="admin-subsection">
            <div className="section-heading">
              <SectionHeaderLead>
                <p className="eyebrow">Invite members</p>
                <h2>Create invite link</h2>
              </SectionHeaderLead>
            </div>

            <form className="task-form" onSubmit={onInviteSubmit}>
              <label>
                Email
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(event) => onInviteFormChange((current) => ({ ...current, email: event.target.value }))}
                  required
                />
              </label>

              <label>
                Role
                <AppSelect
                  ariaLabel="Invite role"
                  className="app-select"
                  menuClassName="app-select-menu"
                  value={inviteForm.role}
                  options={(["user", "admin"] as WorkspaceInviteRole[]).map((role) => ({
                    value: role,
                    label: role === "admin" ? "Admin" : "User",
                  }))}
                  onChange={(nextRole) => onInviteFormChange((current) => ({ ...current, role: nextRole }))}
                />
              </label>

              {inviteLink && (
                <div className="detail-card">
                  <div className="detail-card-top">
                    <strong>Latest invite link</strong>
                    <button className="ghost-button compact" type="button" onClick={() => void navigator.clipboard.writeText(inviteLink)}>
                      Copy link
                    </button>
                  </div>
                  <p>{inviteLink}</p>
                </div>
              )}

              <div className="admin-form-actions">
                <button className="ghost-button" type="button" onClick={onResetInviteForm}>
                  Clear
                </button>
                <button className="primary-button" type="submit" disabled={isInviteSaving}>
                  {isInviteSaving ? "Creating..." : "Create invite"}
                </button>
              </div>
            </form>

            <div className="task-detail-list admin-compact-list" style={{ marginTop: "16px" }}>
              {adminInvites.length ? (
                adminInvites.map((invite) => (
                  <article key={invite.id} className="detail-card">
                    <div className="detail-card-top">
                      <strong>{invite.email}</strong>
                      <span>{invite.status}</span>
                    </div>
                    <p>
                      {invite.role === "admin" ? "Admin" : "User"} invite for {invite.workspaceName ?? workspaceName}
                    </p>
                    <div className="admin-user-actions">
                      <button className="ghost-button compact" type="button" onClick={() => void navigator.clipboard.writeText(invite.inviteUrl)}>
                        Copy link
                      </button>
                      {invite.status === "pending" && (
                        <button
                          className="ghost-button compact danger-button"
                          type="button"
                          disabled={revokingInviteId === invite.id}
                          onClick={() => onRevokeInvite(invite.id)}
                        >
                          {revokingInviteId === invite.id ? "Revoking..." : "Revoke"}
                        </button>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <div className="detail-empty">No invites yet.</div>
              )}
            </div>
          </div>
        </section>

        <section className="admin-form-panel admin-users-panel">
          <div className="section-heading">
            <SectionHeaderLead>
              <p className="eyebrow">Existing users</p>
              <h2>Workspace members</h2>
            </SectionHeaderLead>
          </div>

          <div className="admin-users-list">
            {adminUsers.length > 0 ? (
              adminUsers.map((user) => (
                <article key={user.id} className="admin-user-card">
                  <div className="admin-user-top">
                    <div>
                      <h3>{user.name}</h3>
                      <p>{user.email}</p>
                      <div className="admin-user-meta">
                        <span>Updated {formatReceivedLabel(user.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="admin-user-actions">
                      <span className={`role-badge ${user.role}`}>{roleLabels[user.role]}</span>
                      {canResetPasswords && (
                        <button
                          className="ghost-button compact"
                          type="button"
                          onClick={() => onResetPassword(user)}
                          disabled={isPasswordResettingUserId === user.id}
                        >
                          {isPasswordResettingUserId === user.id ? "Resetting..." : "Reset password"}
                        </button>
                      )}
                      <button
                        className="ghost-button compact"
                        type="button"
                        onClick={() => onStartEdit(user)}
                        disabled={user.role === "owner" && !canPromoteToOwner}
                      >
                        Edit user
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <p>No users yet.</p>
                <span>Create the first workspace member from the form.</span>
              </div>
            )}
          </div>
        </section>

        {canCreateWorkspaces && (
          <section className="admin-form-panel">
            <div className="section-heading">
              <SectionHeaderLead>
                <p className="eyebrow">God Mode</p>
                <h2>Create workspace</h2>
              </SectionHeaderLead>
            </div>

            <form className="task-form" onSubmit={onWorkspaceSubmit}>
              <label>
                Workspace name
                <input
                  value={workspaceForm.workspaceName}
                  onChange={(event) =>
                    onWorkspaceFormChange((current) => ({ ...current, workspaceName: event.target.value }))
                  }
                  required
                />
              </label>

              <label>
                Owner name
                <input
                  value={workspaceForm.ownerName}
                  onChange={(event) => onWorkspaceFormChange((current) => ({ ...current, ownerName: event.target.value }))}
                  required
                />
              </label>

              <label>
                Owner email
                <input
                  type="email"
                  value={workspaceForm.ownerEmail}
                  onChange={(event) =>
                    onWorkspaceFormChange((current) => ({ ...current, ownerEmail: event.target.value }))
                  }
                  required
                />
              </label>

              <label>
                Owner password
                <input
                  type="password"
                  value={workspaceForm.ownerPassword}
                  onChange={(event) =>
                    onWorkspaceFormChange((current) => ({ ...current, ownerPassword: event.target.value }))
                  }
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </label>

              {createdWorkspace && (
                <div className="detail-card">
                  <div className="detail-card-top">
                    <strong>{createdWorkspace.name}</strong>
                    <span>{createdWorkspace.slug}</span>
                  </div>
                  <p>
                    Owner: {createdWorkspace.ownerName} ({createdWorkspace.ownerEmail})
                  </p>
                </div>
              )}

              <div className="admin-form-actions">
                <button className="ghost-button" type="button" onClick={onResetWorkspaceForm}>
                  Clear
                </button>
                <button className="primary-button" type="submit" disabled={isWorkspaceSaving}>
                  {isWorkspaceSaving ? "Creating..." : "Create workspace"}
                </button>
              </div>
            </form>
          </section>
        )}

        {canCreateWorkspaces && (
          <section className="admin-form-panel">
            <div className="section-heading">
              <SectionHeaderLead>
                <p className="eyebrow">Workspace controls</p>
                <h2>Manage workspaces</h2>
              </SectionHeaderLead>
            </div>

            <div className="task-detail-list admin-detail-list admin-workspace-list">
              {adminWorkspaces.length ? (
                adminWorkspaces.map((workspace) => {
                  const draft = workspaceDrafts[workspace.id] ?? buildWorkspaceDraft(workspace);
                  const isActive = workspace.deactivatedAt === null;

                  return (
                    <article key={workspace.id} className="detail-card">
                      <div className="detail-card-top">
                        <strong>{workspace.name}</strong>
                        <span>{isActive ? "active" : "deactivated"}</span>
                      </div>

                      <p>
                        {workspace.slug} · {workspace.memberCount} member{workspace.memberCount === 1 ? "" : "s"}
                      </p>

                      <div className="task-form workspace-settings-grid">
                        <label>
                          Workspace name
                          <input
                            value={draft.name}
                            onChange={(event) =>
                              setWorkspaceDrafts((current) => ({
                                ...current,
                                [workspace.id]: {
                                  ...draft,
                                  name: event.target.value,
                                },
                              }))
                            }
                            required
                          />
                        </label>

                        <label>
                          Owner
                          <AppSelect
                            ariaLabel={`Owner for ${workspace.name}`}
                            className="app-select"
                            menuClassName="app-select-menu"
                            value={draft.ownerUserId}
                            options={workspace.members.map((member) => ({
                              value: member.userId,
                              label: `${member.name} (${roleLabels[member.role]})`,
                            }))}
                            onChange={(nextOwnerUserId) =>
                              setWorkspaceDrafts((current) => ({
                                ...current,
                                [workspace.id]: {
                                  ...draft,
                                  ownerUserId: nextOwnerUserId,
                                },
                              }))
                            }
                          />
                        </label>

                        <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <input
                            type="checkbox"
                            checked={draft.allowMemberTaskCreation}
                            onChange={(event) =>
                              setWorkspaceDrafts((current) => ({
                                ...current,
                                [workspace.id]: {
                                  ...draft,
                                  allowMemberTaskCreation: event.target.checked,
                                },
                              }))
                            }
                          />
                          Members can create tasks
                        </label>

                        <div className="admin-user-meta">
                          <span>Owner: {workspace.ownerName || "Unknown"} ({workspace.ownerEmail || "No email"})</span>
                          <span>Updated {formatReceivedLabel(workspace.updatedAt)}</span>
                        </div>

                        <div className="admin-form-actions">
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() =>
                              setWorkspaceDrafts((current) => ({
                                ...current,
                                [workspace.id]: buildWorkspaceDraft(workspace),
                              }))
                            }
                          >
                            Reset
                          </button>
                          <button
                            className="ghost-button"
                            type="button"
                            disabled={togglingWorkspaceId === workspace.id}
                            onClick={() => onWorkspaceStatusChange(workspace.id, !isActive)}
                          >
                            {togglingWorkspaceId === workspace.id
                              ? "Saving..."
                              : isActive
                                ? "Deactivate"
                                : "Reactivate"}
                          </button>
                          <button
                            className="primary-button"
                            type="button"
                            disabled={updatingWorkspaceId === workspace.id}
                            onClick={() => onWorkspaceSettingsSubmit(workspace.id, draft)}
                          >
                            {updatingWorkspaceId === workspace.id ? "Saving..." : "Save workspace"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="detail-empty">No workspaces available.</div>
              )}
            </div>
          </section>
        )}

        {canCreateWorkspaces && (
          <section className="admin-form-panel admin-form-panel-wide">
            <div className="section-heading">
              <SectionHeaderLead>
                <p className="eyebrow">Application config</p>
                <h2>Integration settings</h2>
              </SectionHeaderLead>
            </div>

            <form className="task-form" onSubmit={onAppConfigSubmit}>
              <label>
                App base URL
                <input
                  value={appConfigForm.appBaseUrl}
                  onChange={(event) => onAppConfigFormChange((current) => ({ ...current, appBaseUrl: event.target.value }))}
                  placeholder="https://www.timesmithhq.com"
                />
              </label>

              <label>
                Outlook client ID
                <input
                  value={appConfigForm.outlookClientId}
                  onChange={(event) => onAppConfigFormChange((current) => ({ ...current, outlookClientId: event.target.value }))}
                  autoComplete="off"
                />
              </label>

              <label>
                Outlook client secret
                <input
                  type="password"
                  value={appConfigForm.outlookClientSecret}
                  onChange={(event) =>
                    onAppConfigFormChange((current) => ({ ...current, outlookClientSecret: event.target.value }))
                  }
                  autoComplete="off"
                />
              </label>

              <label>
                Outlook tenant ID
                <input
                  value={appConfigForm.outlookTenantId}
                  onChange={(event) => onAppConfigFormChange((current) => ({ ...current, outlookTenantId: event.target.value }))}
                  placeholder="common"
                  autoComplete="off"
                />
              </label>

              <label>
                Slack signing secret
                <input
                  type="password"
                  value={appConfigForm.slackSigningSecret}
                  onChange={(event) => onAppConfigFormChange((current) => ({ ...current, slackSigningSecret: event.target.value }))}
                  autoComplete="off"
                />
              </label>

              <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={appConfigForm.slackDisableSignatureVerification}
                  onChange={(event) =>
                    onAppConfigFormChange((current) => ({
                      ...current,
                      slackDisableSignatureVerification: event.target.checked,
                    }))
                  }
                />
                Disable Slack signature verification
              </label>

              <div className="detail-card">
                <p>
                  Database URL, CORS, cookie domain, and platform runtime settings remain environment configuration.
                  This page manages app-level integrations and security settings.
                </p>
              </div>

              <div className="admin-form-actions">
                <button className="ghost-button" type="button" onClick={onResetAppConfigForm}>
                  Clear
                </button>
                <button className="primary-button" type="submit" disabled={isAppConfigSaving}>
                  {isAppConfigSaving ? "Saving..." : hasLoadedAppConfig ? "Save configuration" : "Save configuration"}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </section>
  );
}
