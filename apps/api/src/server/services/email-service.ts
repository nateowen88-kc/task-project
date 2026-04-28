import { Resend } from "resend";

import { getAdminAppConfig } from "./app-config-service.js";
import {
  buildAccountSetupTemplate,
  buildPasswordRecoveryTemplate,
  buildWorkspaceInviteTemplate,
} from "./email-templates.js";

type EmailConfig = Awaited<ReturnType<typeof getAdminAppConfig>>;

function getConfiguredResend(config: EmailConfig) {
  const apiKey = config.resendApiKey.trim();
  if (!apiKey) {
    return null;
  }

  return new Resend(apiKey);
}

async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const config = await getAdminAppConfig();
  const resend = getConfiguredResend(config);
  const resendFrom = config.resendFromEmail.trim();
  const resendReplyTo = config.resendReplyToEmail.trim();

  if (!resend || !resendFrom) {
    return { sent: false as const, reason: "not-configured" as const };
  }

  const { data, error } = await resend.emails.send({
    from: resendFrom,
    to: [input.to],
    subject: input.subject,
    html: input.html,
    text: input.text,
    ...(resendReplyTo ? { replyTo: resendReplyTo } : {}),
  });

  if (error) {
    throw new Error(error.message || "Resend failed to send email.");
  }

  return {
    sent: true as const,
    id: data?.id ?? null,
  };
}

export async function isResendConfigured() {
  const config = await getAdminAppConfig();
  return Boolean(config.resendApiKey.trim() && config.resendFromEmail.trim());
}

export async function sendWorkspaceInviteEmail(input: {
  to: string;
  inviteUrl: string;
  workspaceName: string;
  inviterName: string;
  role: "admin" | "user";
}) {
  const template = buildWorkspaceInviteTemplate(input);
  return sendTransactionalEmail({
    to: input.to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

export async function sendAccountSetupEmail(input: {
  to: string;
  recipientName: string;
  workspaceName: string;
  setupUrl: string;
}) {
  const template = buildAccountSetupTemplate(input);
  return sendTransactionalEmail({
    to: input.to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

export async function sendPasswordRecoveryEmail(input: {
  to: string;
  recipientName: string;
  resetUrl: string;
}) {
  const template = buildPasswordRecoveryTemplate(input);
  return sendTransactionalEmail({
    to: input.to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}
