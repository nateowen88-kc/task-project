import PostalMime from "postal-mime";

interface Env {
  TIMESMITH_WEBHOOK_URL: string;
  INBOUND_EMAIL_TOKEN: string;
}

export default {
  async email(message: ForwardableEmailMessage, env: Env) {
    const allowList = new Set([
      "nateowen88@gmail.com",
      "coworker@example.com",
    ]);

    const sender = message.from.trim().toLowerCase();
    if (!allowList.has(sender)) {
      message.setReject("Address not allowed");
      return;
    }

    const parsed = await PostalMime.parse(message.raw);

    const response = await fetch(env.TIMESMITH_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-inbound-email-token": env.INBOUND_EMAIL_TOKEN,
      },
      body: JSON.stringify({
        subject: parsed.subject || "(no subject)",
        text: parsed.text || "",
        html: parsed.html || "",
        from: message.from,
        to: message.to,
        messageId: parsed.messageId || message.headers.get("message-id") || "",
      }),
    });

    if (!response.ok) {
      console.error("TimeSmith inbound email failed", response.status);
      message.setReject("Failed to process message");
    }
  },
};
