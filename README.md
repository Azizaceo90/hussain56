# Ops Hub

A single-app team operations dashboard: time tracking, contracts (e-sign),
payroll & expenses, with custom cookie-session auth and role-gated access.

## Stack
- Next.js 14 (App Router) + TypeScript, React 18, Tailwind CSS
- Prisma ORM + PostgreSQL (Neon recommended)
- Custom HMAC cookie-session auth, bcrypt passwords (no external provider)
- nodemailer (Gmail app password) — graceful no-op when unconfigured
- pdf-lib + pdfjs-dist for contract rendering & stamping

## Deploy on Vercel (Hobby-friendly)

1. **Create a Postgres DB** (Neon). Copy the **pooled** connection string.
2. **Connect this repo to a Vercel project.** Vercel uses `vercel.json`:
   - Build command: `prisma generate && prisma db push --accept-data-loss && next build`
   - One daily cron (`0 12 * * *`) — Hobby rejects sub-daily crons.
3. **Set env vars** in Vercel → Settings → Environment Variables:
   | Var | Required | Notes |
   |-----|----------|-------|
   | `DATABASE_URL` | ✅ | Neon pooled connection string |
   | `AUTH_SECRET` | ✅ | `openssl rand -hex 32` |
   | `GMAIL_USER` | optional | Gmail address for outbound email |
   | `GMAIL_APP_PASSWORD` | optional | Gmail app password; unset = emails logged, not sent |
   | `CRON_SECRET` | optional | Protects the daily cron endpoint |
   | `APP_URL` | optional | Base URL used in emailed links |
   | `ADZUNA_APP_ID` | optional | Job search (Adzuna) — free at developer.adzuna.com |
   | `ADZUNA_APP_KEY` | optional | Job search (Adzuna) |
4. **Deploy.** `prisma db push` applies the schema on every deploy. New columns
   are kept nullable so pushes never block.
5. **Create the first admin** (one-time). After the first deploy, POST to
   `/api/seed` — it only works while there are zero users:
   ```bash
   curl -X POST https://YOUR_APP/api/seed \
     -H 'Content-Type: application/json' \
     -d '{"name":"Admin","email":"you@example.com","password":"choose-a-password"}'
   ```
   Then sign in at `/login` and invite your team from the **Team** page.

> Connecting the repo to Vercel and setting env vars happens in the Vercel
> dashboard with your account — it can't be done from this repo alone.

## Local development
```bash
cp .env.example .env   # fill DATABASE_URL + AUTH_SECRET
npm install
npx prisma db push
npm run dev
```

## Jobs (Adzuna)
The **Jobs** page pulls remote medical-coding roles from the Adzuna API.
1. Get free credentials at https://developer.adzuna.com and set `ADZUNA_APP_ID`
   + `ADZUNA_APP_KEY` in Vercel, then redeploy.
2. As an admin, open **Jobs → Sync 1000 roles** to pull the latest listings
   (posted within 30 days). Everyone can browse/search the stored results.
3. The daily cron (`/api/cron/mail-sync`, `0 12 * * *`) refreshes them
   automatically.

## Roles
- **admin** — sees everything; can invite/edit/delete users, impersonate
  employees, approve timesheets, issue contracts, run payroll, manage expenses.
- **employee** — sees only their own data.

## Architecture notes
- **Generic REST layer**: `POST /api/[resource]`, `PATCH|DELETE /api/[resource]/[id]`
  backed by a `RESOURCES` map (`lib/resources.ts`). Per-resource write **policies**
  are enforced server-side — the UI is never trusted.
- **`/api/bootstrap`** returns all role-scoped data; the `useData` context store
  (`components/DataProvider.tsx`) holds it with `add/update/remove/refreshData()`.
- App HTML routes send `Cache-Control: no-store` (`next.config.js`) so users
  never get a stale shell after a deploy.
- Calendar/wall-clock times are built with `Date.UTC` + explicit IANA zones
  (`lib/dates.ts`) to avoid Vercel's UTC-server shift.
