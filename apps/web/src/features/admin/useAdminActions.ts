import { FormEvent, useState } from "react";
import {
  AdminUser,
  WorkspaceInviteRole,
  WorkspaceRole,
  createAdminUser,
  createWorkspaceInvite,
  resetAdminUserPassword,
  revokeWorkspaceInvite,
  updateAdminUser,
} from "../../api";

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export type AdminFormState = {
  name: string;
  email: string;
  password: string;
  role: WorkspaceRole;
};

export type InviteFormState = {
  email: string;
  role: WorkspaceInviteRole;
};

function createEmptyAdminForm(): AdminFormState {
  return {
    name: "",
    email: "",
    password: "",
    role: "user",
  };
}

function createEmptyInviteForm(): InviteFormState {
  return {
    email: "",
    role: "user",
  };
}

type UseAdminActionsOptions = {
  canManageUsers: boolean;
  canPromoteToOwner: boolean;
  canResetPasswords: boolean;
  refreshAppData: () => Promise<void>;
  onError: (message: string | null) => void;
  onNavigateAdmin: () => void;
};

export function useAdminActions({
  canManageUsers,
  canPromoteToOwner,
  canResetPasswords,
  refreshAppData,
  onError,
  onNavigateAdmin,
}: UseAdminActionsOptions) {
  const [adminForm, setAdminForm] = useState<AdminFormState>(createEmptyAdminForm());
  const [adminEditingUserId, setAdminEditingUserId] = useState<string | null>(null);
  const [isAdminSaving, setIsAdminSaving] = useState(false);
  const [isPasswordResettingUserId, setIsPasswordResettingUserId] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState<InviteFormState>(createEmptyInviteForm());
  const [isInviteSaving, setIsInviteSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);

  function resetAdminForm() {
    setAdminForm(createEmptyAdminForm());
    setAdminEditingUserId(null);
  }

  function resetInviteForm() {
    setInviteForm(createEmptyInviteForm());
    setInviteLink(null);
  }

  function startAdminEdit(user: AdminUser) {
    setAdminEditingUserId(user.id);
    setAdminForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
    });
    onNavigateAdmin();
    onError(null);
  }

  async function handleResetUserPassword(user: AdminUser) {
    if (!canResetPasswords) {
      onError("You do not have permission to reset passwords.");
      return;
    }

    try {
      setIsPasswordResettingUserId(user.id);
      onError(null);
      const result = await resetAdminUserPassword(user.id);
      window.alert(`Temporary password for ${user.email}: ${result.password}`);
    } catch (error) {
      onError(toErrorMessage(error, "Could not reset password."));
    } finally {
      setIsPasswordResettingUserId(null);
    }
  }

  async function handleAdminSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAdminSaving(true);
    onError(null);

    try {
      if (!canPromoteToOwner && adminForm.role === "owner") {
        throw new Error("Only owners can assign the owner role.");
      }

      if (adminEditingUserId) {
        await updateAdminUser(adminEditingUserId, {
          name: adminForm.name,
          email: adminForm.email,
          password: adminForm.password || undefined,
          role: adminForm.role,
        });
      } else {
        await createAdminUser({
          name: adminForm.name,
          email: adminForm.email,
          password: adminForm.password,
          role: adminForm.role,
        });
      }

      if (canManageUsers) {
        await refreshAppData();
      }
      resetAdminForm();
    } catch (error) {
      onError(toErrorMessage(error, "Could not save user."));
    } finally {
      setIsAdminSaving(false);
    }
  }

  async function handleInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsInviteSaving(true);
    onError(null);

    try {
      const invite = await createWorkspaceInvite(inviteForm);
      setInviteLink(invite.inviteUrl);
      if (canManageUsers) {
        await refreshAppData();
      }
      setInviteForm(createEmptyInviteForm());
    } catch (error) {
      onError(toErrorMessage(error, "Could not create invite."));
    } finally {
      setIsInviteSaving(false);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    try {
      setRevokingInviteId(inviteId);
      onError(null);
      await revokeWorkspaceInvite(inviteId);
      if (canManageUsers) {
        await refreshAppData();
      }
    } catch (error) {
      onError(toErrorMessage(error, "Could not revoke invite."));
    } finally {
      setRevokingInviteId(null);
    }
  }

  return {
    adminForm,
    setAdminForm,
    adminEditingUserId,
    isAdminSaving,
    isPasswordResettingUserId,
    inviteForm,
    setInviteForm,
    isInviteSaving,
    inviteLink,
    revokingInviteId,
    resetAdminForm,
    resetInviteForm,
    startAdminEdit,
    handleResetUserPassword,
    handleAdminSubmit,
    handleInviteSubmit,
    handleRevokeInvite,
  };
}
