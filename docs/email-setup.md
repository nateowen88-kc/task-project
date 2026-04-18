# Email Setup

Task Flow supports email capture into the same `Capture Inbox` used by Slack.

## Environment

Add this to your local `.env`:

```bash
EMAIL_INBOUND_TOKEN="your-email-inbound-token"
```

## Inbound Endpoint

Send `POST` requests to:

`https://your-domain/api/integrations/email/inbound`

Include:

- Header:
  - `Authorization: Bearer <EMAIL_INBOUND_TOKEN>`
- JSON body:

```json
{
  "token": "your-email-inbound-token",
  "subject": "Client follow-up on Q2 launch plan",
  "text": "Can you break this into tasks and reply by Friday?",
  "from": "jordan@example.com",
  "to": "founder@taskflow.app",
  "messageId": "<provider-message-id>",
  "receivedAt": "2026-04-17T22:15:00.000Z",
  "sourceUrl": "https://mail.example.com/message/123"
}
```

You can authenticate with either:

- `Authorization: Bearer <EMAIL_INBOUND_TOKEN>`
- `X-Email-Inbound-Token: <EMAIL_INBOUND_TOKEN>`
- `token` in the JSON body

## Behavior

- Emails create or refresh a `CapturedItem`
- Dedupe uses `sourceType + externalId`
- For email, `externalId` should be the provider message ID when available
- Inbox items still require review before they become tasks

## Suggested Integration Pattern

Use an email provider or forwarding service that can POST inbound mail to a webhook.

Good fit:

1. Forward incoming mail to a provider endpoint
2. Transform the provider payload into the JSON shape above
3. POST it to Task Flow with the bearer token

## Local Testing

You can test the inbox path from the app UI using `Add sample email` in the `Capture Inbox`.
