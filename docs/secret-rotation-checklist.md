# Secret Rotation Checklist

Rotate these secrets whenever they are pasted into logs, screenshots, shell history, support threads, or temporary config during deployment/debugging.

## Rotate in providers

1. Neon database password / connection string
2. Resend API key
3. Slack signing secret
4. Gemini API key or any other AI provider key in use
5. Any inbound email token or webhook secret

## Update platforms

1. Update local `.env`
2. Update Render environment variables
3. Update Vercel environment variables
4. Redeploy affected services

## Validate after rotation

1. Backend starts successfully
2. Frontend can still reach `https://api.timesmithhq.com`
3. Login works
4. Invite email works if enabled
5. Slack webhook verification works if enabled

## Notes

- Do not commit live secrets to the repo.
- Keep `.env.example` as placeholders only.
- Prefer rotating immediately after a production incident or debugging session that exposed credentials outside the normal secret managers.
