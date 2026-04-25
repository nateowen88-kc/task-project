TimeSmith production deployment should use:

- Frontend on Vercel: `https://www.timesmithhq.com`
- Backend on Render: `https://api.timesmithhq.com`
- Database on Neon

Reason:
- authenticated browser requests need shared-site cookies
- `www.timesmithhq.com` and `api.timesmithhq.com` are same-site
- `www.timesmithhq.com` and `your-service.onrender.com` are not

Render service setup:

1. Create a new Web Service from this repo.
2. Use these settings:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start`
3. Add environment variables:
   - `NODE_ENV=production`
   - `DATABASE_URL=postgresql://...`
   - `CORS_ORIGINS=https://www.timesmithhq.com,https://timesmithhq.com`
   - `SESSION_COOKIE_DOMAIN=.timesmithhq.com`
   - `RESEND_API_KEY=...`
   - `RESEND_FROM_EMAIL=...`
   - `RESEND_REPLY_TO_EMAIL=...`
   - `SLACK_SIGNING_SECRET=...`
   - `SLACK_DISABLE_SIGNATURE_VERIFICATION=false`
   - `EMAIL_INBOUND_TOKEN=...`
4. Add a custom domain on Render:
   - `api.timesmithhq.com`
5. In Cloudflare DNS, point `api.timesmithhq.com` to the Render target Render gives you.

Vercel frontend setup:

1. Add environment variable:
   - `VITE_API_BASE_URL=https://api.timesmithhq.com`
2. Redeploy the frontend.

Database migration:

Run against production Neon before using the backend:

```bash
npx prisma migrate deploy
```

Recommended checks after deployment:

1. `GET https://api.timesmithhq.com/api/auth/me`
   - should return `401` when signed out, not `404`
2. Sign in at `https://www.timesmithhq.com`
3. Verify:
   - tasks load
   - admin page loads
   - comments save
   - agenda status changes persist
