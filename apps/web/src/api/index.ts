export * from "./types";
export * from "./auth";
export * from "./admin";
export * from "./tasks";
export * from "./agenda";
export * from "./captured-items";
export * from "./notifications";
export * from "./outlook";

import {
  GOD_USER_EMAIL,
  GOD_USER_PASSWORD,
  GOD_WORKSPACE_ID,
  type AuthSession,
} from "./types";

function isGodSession(session: AuthSession | null) {
  return session?.workspace.id === GOD_WORKSPACE_ID;
}

function isGodCredentials(email: string, password: string) {
  return email.trim().toLowerCase() === GOD_USER_EMAIL && password === GOD_USER_PASSWORD;
}

export { isGodCredentials, isGodSession };
