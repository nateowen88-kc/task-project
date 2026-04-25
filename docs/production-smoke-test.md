# Production Smoke Test

Run this checklist after any deployment that touches auth, routing, database access, task workflows, or admin flows.

## Frontend

1. Open `https://www.timesmithhq.com`
2. Confirm the app shell loads as HTML, not a JSON API response
3. Confirm browser console does not show mixed-content errors
4. Confirm the login form renders without blocked CSP errors for the expected production scripts

## Backend

1. Open `https://api.timesmithhq.com/api/auth/me`
2. Confirm signed-out response is `401`
3. Confirm the response is JSON, not an HTML error page

## Authentication

1. Sign in with a known valid account
2. Refresh the page
3. Confirm the session persists
4. Sign out
5. Confirm the app returns to the login screen cleanly

## Tasks

1. Load the task page
2. Create a task
3. Edit a task
4. Add a comment
5. Drag a task to a new workflow status
6. Change task status from the agenda dropdown
7. Refresh and confirm the changes persisted

## Admin

1. Open the admin page
2. Load users
3. Load invites
4. Create an invite
5. Reset a password
6. Confirm workspace members load

## Integrations

1. If Resend is enabled, create an invite and confirm email delivery
2. If Slack is enabled, confirm the webhook endpoint returns a valid response

## DNS / Hosting

1. `timesmithhq.com` redirects to `https://www.timesmithhq.com`
2. `www.timesmithhq.com` serves the frontend
3. `api.timesmithhq.com` serves the backend

## Database

1. Confirm the backend is using the expected Neon database
2. Confirm at least one known user exists in the production database
