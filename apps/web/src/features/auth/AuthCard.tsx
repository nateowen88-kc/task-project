import type { FormEvent } from "react";
import type { WorkspaceInviteLookup } from "../../api";

type AuthMode = "login" | "register" | "forgot-password" | "reset-password";

type AuthCardProps = {
  error: string | null;
  notice: string | null;
  isSubmitting: boolean;
  mode: AuthMode;
  inviteLookup: WorkspaceInviteLookup | null;
  resetToken: string | null;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

function AuthCard({ error, notice, isSubmitting, mode, inviteLookup, resetToken, onModeChange, onSubmit }: AuthCardProps) {
  const invite = inviteLookup?.invite ?? null;
  const isForgotFlow = mode === "forgot-password";
  const isResetFlow = mode === "reset-password" && Boolean(resetToken);

  return (
    <div className="auth-shell">
      <section className="panel auth-panel">
        <div className="auth-header">
          <div>
            <p className="eyebrow">TimeSmith Collaboration</p>
            <h1>
              {invite
                ? `Join ${invite.workspaceName ?? "workspace"}`
                : isForgotFlow
                  ? "Recover your password"
                : isResetFlow
                  ? "Set a new password"
                : mode === "login"
                  ? "Sign in to your workspace"
                  : "Create your workspace"}
            </h1>
          </div>
          <p className="hero-copy">
            {invite
              ? `You were invited as ${invite.role === "admin" ? "an admin" : "a user"} for ${invite.workspaceName ?? "this workspace"}.`
              : isForgotFlow
                ? "Enter your email address and the app will send a recovery link if that account exists."
              : isResetFlow
                ? "Choose a new password to finish account setup or recover access."
              : "Collaboration starts with shared workspaces, scoped inboxes, and a daily agenda that belongs to the right team."}
          </p>
        </div>

        {!invite && !isResetFlow && (
          <div className="auth-toggle">
            <button
              type="button"
              className={`auth-toggle-button ${mode === "login" ? "active" : ""}`}
              onClick={() => onModeChange("login")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`auth-toggle-button ${mode === "register" ? "active" : ""}`}
              onClick={() => onModeChange("register")}
            >
              Create workspace
            </button>
          </div>
        )}

        {error && <div className="error-banner">{error}</div>}
        {notice && <div className="detail-card"><p>{notice}</p></div>}

        <form className="task-form auth-form" onSubmit={(event) => void onSubmit(event)}>
          {invite && <input type="hidden" name="inviteToken" value={invite.token} />}
          {resetToken && <input type="hidden" name="resetToken" value={resetToken} />}

          {(mode === "register" || invite) && (
            <>
              <label>
                Name
                <input name="name" placeholder="Nathaniel" required />
              </label>
              {!invite && (
                <label>
                  Workspace name
                  <input name="workspaceName" placeholder="TimeSmith Product" required />
                </label>
              )}
            </>
          )}

          {!isResetFlow && (
            <label>
              Email
              <input
                name="email"
                type="email"
                placeholder="you@timesmith.test"
                autoComplete="username"
                defaultValue={invite?.email ?? ""}
                readOnly={Boolean(invite)}
                required
              />
            </label>
          )}

          {!isForgotFlow && (
            <label>
              Password
              <input
                name="password"
                type="password"
                placeholder="At least 8 characters"
                minLength={8}
                autoComplete={mode === "login" && !invite ? "current-password" : "new-password"}
                required
              />
            </label>
          )}

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? invite
                ? "Joining..."
                : isForgotFlow
                  ? "Sending..."
                : isResetFlow
                  ? "Saving..."
                : mode === "login"
                ? "Signing in..."
                : "Creating..."
              : invite
                ? "Join workspace"
                : isForgotFlow
                  ? "Send recovery email"
                : isResetFlow
                  ? "Save new password"
                : mode === "login"
                ? "Sign in"
                : "Create workspace"}
          </button>

          {!invite && !isResetFlow && (
            <button
              className="ghost-button"
              type="button"
              onClick={() => onModeChange(isForgotFlow ? "login" : "forgot-password")}
            >
              {isForgotFlow ? "Back to sign in" : "Forgot password?"}
            </button>
          )}
        </form>
      </section>
    </div>
  );
}

export type { AuthMode };
export { AuthCard };
