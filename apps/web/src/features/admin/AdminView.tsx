import { AdminUser, WorkspaceInvite, WorkspaceInviteRole, WorkspaceRole } from "../../api";
import { SectionHeader, SectionHeaderLead } from "../../components/layout/SectionHeader";
import { AppSelect } from "../../components/ui/AppSelect";
import { TodayCalendarBadge } from "../../components/ui/TodayCalendarBadge";
import { formatReceivedLabel } from "../../lib/formatters";
import type { AdminFormState, InviteFormState } from "./useAdminActions";

type AdminViewProps = {
  adminUsers: AdminUser[];
  adminInvites: WorkspaceInvite[];
  adminForm: AdminFormState;
  inviteForm: InviteFormState;
  adminEditingUserId: string | null;
  isAdminSaving: boolean;
  isInviteSaving: boolean;
  canPromoteToOwner: boolean;
  canResetPasswords: boolean;
  isPasswordResettingUserId: string | null;
  inviteLink: string | null;
  revokingInviteId: string | null;
  roleLabels: Record<WorkspaceRole, string>;
  todayBadge: { month: string; day: number; weekday: string };
  workspaceName: string;
  onResetForm: () => void;
  onResetInviteForm: () => void;
  onStartEdit: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onAdminFormChange: (updater: (current: AdminFormState) => AdminFormState) => void;
  onInviteFormChange: (updater: (current: InviteFormState) => InviteFormState) => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  onInviteSubmit: React.FormEventHandler<HTMLFormElement>;
  onRevokeInvite: (inviteId: string) => void;
};

export function AdminView({
  adminUsers,
  adminInvites,
  adminForm,
  inviteForm,
  adminEditingUserId,
  isAdminSaving,
  isInviteSaving,
  canPromoteToOwner,
  canResetPasswords,
  isPasswordResettingUserId,
  inviteLink,
  revokingInviteId,
  roleLabels,
  todayBadge,
  workspaceName,
  onResetForm,
  onResetInviteForm,
  onStartEdit,
  onResetPassword,
  onAdminFormChange,
  onInviteFormChange,
  onSubmit,
  onInviteSubmit,
  onRevokeInvite,
}: AdminViewProps) {
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
        <section className="admin-users">
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
        </section>

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
        </section>

        <section className="admin-form-panel">
          <div className="section-heading">
            <SectionHeaderLead>
              <p className="eyebrow">Workspace invites</p>
              <h2>Invite members by link</h2>
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

          <div className="task-detail-list" style={{ marginTop: "16px" }}>
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
        </section>
      </div>
    </section>
  );
}
