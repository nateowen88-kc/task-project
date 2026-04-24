## Vercel Deploy

This repo is set up for Vercel in a split deployment shape:

- the frontend is built by Vite into `dist`
- Vercel serves the static frontend from `dist`
- the Express API is exposed as Vercel Functions under `api/`

### Important constraint

Do not use `localhost:5432` as the production database URL.

Vercel cannot connect to your laptop's local Postgres in production. You need a hosted Postgres database for deployed environments.

Use a real hosted database such as:

- Neon
- Supabase
- Railway Postgres
- Render Postgres
- AWS RDS

### Project settings

Vercel should detect this as a Vite project.

The repo includes:

- `vercel.json`
- `api/index.ts`
- `api/[...path].ts`

So:

- frontend routes are served as SPA routes
- `/api/*` is handled by the Express app

### Environment variables

Set these in Vercel:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
CORS_ORIGINS=https://www.timesmithhq.com,https://timesmithhq.com
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=TimeSmith <hello@updates.timesmithhq.com>
RESEND_REPLY_TO_EMAIL=support@timesmithhq.com
SLACK_SIGNING_SECRET=...
SLACK_DISABLE_SIGNATURE_VERIFICATION=false
EMAIL_INBOUND_TOKEN=...
```

### Database migrations

Run migrations against the hosted production database before cutting over:

```bash
npx prisma migrate deploy
```

You can do this:

- from your machine with the production `DATABASE_URL`
- or from CI before promoting the deployment

Do not rely on a local database for production.

### Domain setup

In Vercel:

1. Create/import the project from GitHub
2. Add `www.timesmithhq.com`
3. Add `timesmithhq.com`
4. Make `www.timesmithhq.com` the primary domain
5. Redirect apex `timesmithhq.com` to `www.timesmithhq.com`

Then add the DNS records Vercel gives you at your DNS provider.

### Deployment flow

1. Push to GitHub
2. Import project into Vercel
3. Add production env vars
4. Point `DATABASE_URL` to a hosted Postgres database
5. Run `npx prisma migrate deploy`
6. Deploy
7. Add domains and update DNS

### Notes

- Local scripts like `npm run dev` and `npm run dev:https-proxy` are only for local development.
- Local certs in `certs/` are not used on Vercel.
- Vercel terminates TLS for the public domain.
