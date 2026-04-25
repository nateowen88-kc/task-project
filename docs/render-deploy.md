## Render Deploy

TimeSmith should run on Render as the backend service only:

- Vercel serves the frontend from `apps/web/dist`
- Render runs the Node API from `server-dist/apps/api/server/index.js`
- the frontend should call Render through `https://api.timesmithhq.com`

### 1. Create the database

Create a managed Postgres database on Render and copy its connection string into:

- `DATABASE_URL`

### 2. Create the web service

Create a Render web service from this GitHub repo.

Use:

- Build command: `npm install && npm run build:api`
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
npm run prisma:migrate:deploy
```

You can do this either:

- as a one-off shell command in Render
- or as a predeploy step in your release process

### 5. Add the backend custom domain

In Render, add:

- `api.timesmithhq.com`

### 6. Update DNS

Use the DNS values Render gives you for `api.timesmithhq.com`.

Do not point the public domain at your local machine.

### Notes

- Local-only scripts such as `npm run dev` and `npm run dev:https-proxy` are not used in production.
- Local certs in `certs/` are only for `timesmith.test`.
- In production, TLS should be terminated by Render.
- Vercel should have `VITE_API_BASE_URL=https://api.timesmithhq.com`.
