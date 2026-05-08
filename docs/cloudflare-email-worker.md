# Cloudflare inbound email worker

This worker receives email sent to `task@timesmithhq.com`, parses it, and posts it to TimeSmith.

## Required secrets

Set the same inbound token in both places:

1. Render:
```env
INBOUND_EMAIL_TOKEN=3c595877507ae092576d73a5682014d218814426e6e0f705ceb2052b3ec99ce0
```

2. Wrangler:
```bash
npx wrangler secret put INBOUND_EMAIL_TOKEN
```

## Worker files

- `cloudflare/email-worker/wrangler.jsonc`
- `cloudflare/email-worker/src/index.ts`
- `cloudflare/email-worker/package.json`

## Cloudflare build settings

If you connect this repo directly to Cloudflare, set:

- Root directory: `cloudflare/email-worker`

That prevents Cloudflare from installing the repo root package and running the app's Prisma `postinstall`.

## Cloudflare setup

1. Enable Email Routing for `timesmithhq.com`.
2. Create custom address:
   - `task@timesmithhq.com`
3. Bind that address to this Worker.
4. Deploy the worker with Wrangler.
