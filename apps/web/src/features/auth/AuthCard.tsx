import type { FormEvent } from "react";
import type { WorkspaceInviteLookup } from "../../api";

type AuthMode = "login" | "register";

type AuthCardProps = {
  error: string | null;
  isSubmitting: boolean;
  mode: AuthMode;
  inviteLookup: WorkspaceInviteLookup | null;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

function AuthCard({ error, isSubmitting, mode, inviteLookup, onModeChange, onSubmit }: AuthCardProps) {
  const invite = inviteLookup?.invite ?? null;

  return (
    <div className="auth-shell">
      <section className="panel auth-panel">
        <div className="auth-header">
          <div>
            <p className="eyebrow">TimeSmith Collaboration</p>
            <h1>
              {invite
                ? `Join ${invite.workspaceName ?? "workspace"}`
                : mode === "login"
                  ? "Sign in to your workspace"
                  : "Create your workspace"}
            </h1>
          </div>
          <p className="hero-copy">
            {invite
              ? `You were invited as ${invite.role === "admin" ? "an admin" : "a user"} for ${invite.workspaceName ?? "this workspace"}.`
              : "Collaboration starts with shared workspaces, scoped inboxes, and a daily agenda that belongs to the right team."}
          </p>
        </div>

        {!invite && (
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

        <form className="task-form auth-form" onSubmit={(event) => void onSubmit(event)}>
          {invite && <input type="hidden" name="inviteToken" value={invite.token} />}

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

          <label>
            Email
            <input
              name="email"
              type="email"
              placeholder="you@timesmith.test"
              defaultValue={invite?.email ?? ""}
              readOnly={Boolean(invite)}
              required
            />
          </label>

          <label>
            Password
            <input name="password" type="password" placeholder="At least 8 characters" minLength={8} required />
          </label>

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? invite
                ? "Joining..."
                : mode === "login"
                ? "Signing in..."
                : "Creating..."
              : invite
                ? "Join workspace"
                : mode === "login"
                ? "Sign in"
                : "Create workspace"}
          </button>
        </form>
      </section>
    </div>
  );
}

export type { AuthMode };
export { AuthCard };
