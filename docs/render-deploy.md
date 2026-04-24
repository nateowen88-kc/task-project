## Render Deploy

TimeSmith is already set up to run as a single Node web service in production:

- Vite builds the frontend into `dist`
- the Express server serves the built frontend from `dist`
- the production entrypoint is `server-dist/server/index.js`

### 1. Create the database

Create a managed Postgres database on Render and copy its connection string into:

- `DATABASE_URL`

### 2. Create the web service

Create a Render web service from this GitHub repo.

Use:

- Build command: `npm install && npm run build`
- Start command: `npm run start`

### 3. Configure environment variables

Minimum required variables:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
CORS_ORIGINS=https://www.timesmithhq.com,https://timesmithhq.com
```

Optional integration variables:

```env
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=TimeSmith <hello@updates.timesmithhq.com>
RESEND_REPLY_TO_EMAIL=support@timesmithhq.com
SLACK_SIGNING_SECRET=...
SLACK_DISABLE_SIGNATURE_VERIFICATION=false
EMAIL_INBOUND_TOKEN=...
```

### 4. Run migrations

After the database is attached, run:

```bash
npx prisma migrate deploy
```

You can do this either:

- as a one-off shell command in Render
- or as a predeploy step in your release process

### 5. Add the custom domain

In Render, add:

- `www.timesmithhq.com`

Optionally also add:

- `timesmithhq.com`

Recommended setup:

- primary app host: `www.timesmithhq.com`
- redirect apex `timesmithhq.com` to `www.timesmithhq.com`

### 6. Update DNS

Use the DNS values Render gives you for the custom domain.

Do not point the public domain at your local machine.

### Notes

- Local-only scripts such as `npm run dev` and `npm run dev:https-proxy` are not used in production.
- Local certs in `certs/` are only for `timesmith.test`.
- In production, TLS should be terminated by Render.
