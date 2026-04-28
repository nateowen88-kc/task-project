function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function button(href: string, label: string) {
  return `
    <p style="margin: 20px 0;">
      <a
        href="${escapeHtml(href)}"
        style="display: inline-block; background: #3A8DFF; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 600;"
      >
        ${escapeHtml(label)}
      </a>
    </p>
  `;
}

function shell(title: string, body: string) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1F2A33;">
      <h2 style="margin-bottom: 12px;">${escapeHtml(title)}</h2>
      ${body}
    </div>
  `;
}

export function buildWorkspaceInviteTemplate(input: {
  inviteUrl: string;
  workspaceName: string;
  inviterName: string;
  role: "admin" | "user";
}) {
  const roleLabel = input.role === "admin" ? "admin" : "user";
  const subject = `You're invited to join ${input.workspaceName} on TimeSmith`;
  const html = shell(
    `Join ${input.workspaceName} on TimeSmith`,
    `
      <p>${escapeHtml(input.inviterName)} invited you to join <strong>${escapeHtml(input.workspaceName)}</strong> as a ${roleLabel}.</p>
      ${button(input.inviteUrl, "Accept invite")}
      <p>If the button does not work, use this link:</p>
      <p><a href="${escapeHtml(input.inviteUrl)}">${escapeHtml(input.inviteUrl)}</a></p>
    `,
  );
  const text = [
    `Join ${input.workspaceName} on TimeSmith`,
    "",
    `${input.inviterName} invited you to join ${input.workspaceName} as a ${roleLabel}.`,
    "",
    `Accept invite: ${input.inviteUrl}`,
  ].join("\n");

  return { subject, html, text };
}

export function buildAccountSetupTemplate(input: {
  recipientName: string;
  workspaceName: string;
  setupUrl: string;
}) {
  const subject = `Your TimeSmith account for ${input.workspaceName} is ready`;
  const html = shell(
    `Your TimeSmith account for ${input.workspaceName} is ready`,
    `
      <p>${escapeHtml(input.recipientName)}, your account has been created for <strong>${escapeHtml(input.workspaceName)}</strong>.</p>
      <p>Set your password to finish access.</p>
      ${button(input.setupUrl, "Set password")}
      <p>If the button does not work, use this link:</p>
      <p><a href="${escapeHtml(input.setupUrl)}">${escapeHtml(input.setupUrl)}</a></p>
    `,
  );
  const text = [
    `Your TimeSmith account for ${input.workspaceName} is ready`,
    "",
    `${input.recipientName}, your account has been created for ${input.workspaceName}.`,
    "",
    `Set password: ${input.setupUrl}`,
  ].join("\n");

  return { subject, html, text };
}

export function buildPasswordRecoveryTemplate(input: {
  recipientName: string;
  resetUrl: string;
}) {
  const subject = "Reset your TimeSmith password";
  const html = shell(
    "Reset your TimeSmith password",
    `
      <p>${escapeHtml(input.recipientName)}, we received a request to reset your password.</p>
      ${button(input.resetUrl, "Reset password")}
      <p>If you did not request this, you can ignore the email.</p>
      <p>If the button does not work, use this link:</p>
      <p><a href="${escapeHtml(input.resetUrl)}">${escapeHtml(input.resetUrl)}</a></p>
    `,
  );
  const text = [
    "Reset your TimeSmith password",
    "",
    `${input.recipientName}, we received a request to reset your password.`,
    "",
    `Reset password: ${input.resetUrl}`,
  ].join("\n");

  return { subject, html, text };
}
