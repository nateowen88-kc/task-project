import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM_EMAIL;
const resendReplyTo = process.env.RESEND_REPLY_TO_EMAIL;

const resend = resendApiKey ? new Resend(resendApiKey) : null;

export function isResendConfigured() {
  return Boolean(resend && resendFrom);
}

export async function sendWorkspaceInviteEmail(input: {
  to: string;
  inviteUrl: string;
  workspaceName: string;
  inviterName: string;
  role: "admin" | "user";
}) {
  if (!resend || !resendFrom) {
    return { sent: false as const };
  }

  const roleLabel = input.role === "admin" ? "admin" : "user";
  const subject = `You're invited to join ${input.workspaceName} on TimeSmith`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1F2A33;">
      <h2 style="margin-bottom: 12px;">Join ${input.workspaceName} on TimeSmith</h2>
      <p>${escapeHtml(input.inviterName)} invited you to join <strong>${escapeHtml(input.workspaceName)}</strong> as a ${roleLabel}.</p>
      <p style="margin: 20px 0;">
        <a
          href="${escapeAttribute(input.inviteUrl)}"
          style="display: inline-block; background: #3A8DFF; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 600;"
        >
          Accept invite
        </a>
      </p>
      <p>If the button does not work, use this link:</p>
      <p><a href="${escapeAttribute(input.inviteUrl)}">${escapeHtml(input.inviteUrl)}</a></p>
    </div>
  `;

  const text = [
    `Join ${input.workspaceName} on TimeSmith`,
    "",
    `${input.inviterName} invited you to join ${input.workspaceName} as a ${roleLabel}.`,
    "",
    `Accept invite: ${input.inviteUrl}`,
  ].join("\n");

  const { data, error } = await resend.emails.send({
    from: resendFrom,
    to: [input.to],
    subject,
    html,
    text,
    ...(resendReplyTo ? { replyTo: resendReplyTo } : {}),
  });

  if (error) {
    throw new Error(error.message || "Resend failed to send invite email.");
  }

  return {
    sent: true as const,
    id: data?.id ?? null,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}
