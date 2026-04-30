import { FormEvent, useState } from "react";
import { acceptInvite, AuthSession, login, logout, register } from "../../api";
import type { AuthMode } from "./AuthCard";

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type UseAuthActionsOptions = {
  applyAuthenticatedSession: (session: AuthSession) => Promise<AuthSession>;
  clearSessionData: () => void;
  onError: (message: string | null) => void;
  onAfterLogout: () => void;
};

export function useAuthActions({
  applyAuthenticatedSession,
  clearSessionData,
  onError,
  onAfterLogout,
}: UseAuthActionsOptions) {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setIsAuthSubmitting(true);
    onError(null);
    setAuthNotice(null);

    try {
      const nextSession =
        formData.get("inviteToken")
          ? await acceptInvite({
              token: String(formData.get("inviteToken") ?? ""),
              name: String(formData.get("name") ?? ""),
              email: String(formData.get("email") ?? ""),
              password: String(formData.get("password") ?? ""),
            })
          : authMode === "login"
          ? await login({
              email: String(formData.get("email") ?? ""),
              password: String(formData.get("password") ?? ""),
            })
          : await register({
              name: String(formData.get("name") ?? ""),
              email: String(formData.get("email") ?? ""),
              password: String(formData.get("password") ?? ""),
              workspaceName: String(formData.get("workspaceName") ?? ""),
            });

      if (nextSession) {
        await applyAuthenticatedSession(nextSession);
      }
    } catch (error) {
      onError(toErrorMessage(error, "Could not authenticate."));
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    onError(null);

    try {
      await logout();
      clearSessionData();
      onAfterLogout();
      setAuthNotice(null);
    } catch (error) {
      onError(toErrorMessage(error, "Could not sign out."));
    }
  }

  return {
    authMode,
    setAuthMode,
    authNotice,
    isAuthSubmitting,
    handleAuthSubmit,
    handleLogout,
  };
}
