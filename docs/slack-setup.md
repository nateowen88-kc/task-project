# Slack Setup

Task Flow now supports Slack capture into the `Capture Inbox`.

## Environment

Add this to your local `.env`:

```bash
SLACK_SIGNING_SECRET="your-slack-signing-secret"
SLACK_DISABLE_SIGNATURE_VERIFICATION="false"
```

## Endpoints

Use these request URLs in your Slack app:

- Interactivity: `https://your-domain/api/integrations/slack/interactions`
- Slash command: `https://your-domain/api/integrations/slack/commands`

For local development, tunnel your app and point Slack at the public tunnel URL.

If you want to exercise the route locally with synthetic requests before wiring a real Slack app, set:

```bash
SLACK_DISABLE_SIGNATURE_VERIFICATION="true"
```

That bypass is intended for local development only. In normal operation, leave it `false`.

## Recommended Slack App Scope

Build the Slack app with:

1. A message shortcut or message action
   Label suggestion: `Save to Task Flow`
2. An optional slash command
   Command suggestion: `/taskflow-save`

This implementation does not require reading Slack history. It only accepts the payload Slack sends when the user explicitly invokes the action.

## Behavior

- Message actions create or refresh a `CapturedItem` in the inbox
- Dedupe uses `sourceType + externalId`
- Slash commands also create inbox items
- Inbox items still require review before becoming tasks

## Notes

- The current message-action route accepts any Slack `message_action` payload
- Source links are generated as Slack deep links when Slack provides team, channel, and message timestamp data
- If the signing secret is missing or invalid, Slack requests are rejected with `401`
