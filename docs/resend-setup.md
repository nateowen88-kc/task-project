# Resend Setup

1. Create a Resend account and API key.
2. Add a sending subdomain you control in Resend, for example `updates.yourdomain.com`.
3. Verify the domain in Resend by adding the DNS records Resend gives you.
4. Set these values in `.env`:

```env
RESEND_API_KEY="re_xxxxxxxxx"
RESEND_FROM_EMAIL="TimeSmith <hello@updates.yourdomain.com>"
RESEND_REPLY_TO_EMAIL="support@yourdomain.com"
```

5. Restart the TimeSmith server.

Behavior:
- Workspace invite creation will attempt to send an email through Resend.
- If Resend is not configured, invite creation still works and the admin UI still shows a copyable invite link.
