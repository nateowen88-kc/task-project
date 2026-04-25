## Vercel Deploy

This repo is set up for Vercel in a split deployment shape:

- the frontend is built from `apps/web`
- Vercel serves the static frontend from `apps/web/dist`
- the backend runs separately on Render at `https://api.timesmithhq.com`

### Important constraint

Vercel should not host the API for this repo anymore. The frontend should call the Render backend through `VITE_API_BASE_URL`.

### Project settings

Vercel should detect this as a Vite project.

The repo includes:

- `vercel.json`
- `apps/web/index.html`
- `apps/web/vite.config.ts`

So:

- frontend routes are served as SPA routes
- API requests go to Render through `https://api.timesmithhq.com`

### Environment variables

Set these in Vercel:

```env
VITE_API_BASE_URL=https://api.timesmithhq.com
```

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
3. Add `VITE_API_BASE_URL=https://api.timesmithhq.com`
4. Deploy
5. Add domains and update DNS

### Notes

- Local scripts like `npm run dev` and `npm run dev:https-proxy` are only for local development.
- Local certs in `certs/` are not used on Vercel.
- Vercel terminates TLS for the public domain.
- Database and server runtime concerns belong to the Render deployment, not Vercel.
