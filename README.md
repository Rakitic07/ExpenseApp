# 💸 Spendly-Plus — Liquid-Glass Expense Tracker

A beautiful, interactive expense tracker with an Apple / iOS-style **liquid glass**
UI. Log daily, monthly and yearly expenses, visualise them with live donut, trend
and bar charts, and keep everything private behind a **passphrase**. Built with
Next.js and ready to deploy to **Vercel** in minutes.

## ✨ Features

- **Liquid-glass UI** — frosted panels, animated gradient blobs, spring-based sheets.
- **Passphrase spaces** — anyone can visit; create a space name + passphrase to keep
  your expenses private and come back to them anytime. Passphrases are hashed with
  bcrypt (never stored in plain text).
- **Rich charts** — category donut, "who paid" split, daily bars, monthly trend area,
  and yearly totals. Switch between **Month / Year / All-time** views.
- **Fast entry** — add / edit / delete expenses through a friendly bottom-sheet form
  with category chips (not a spreadsheet!).
- **Small database** — a serverless Postgres via Prisma.

## 🧱 Tech stack

| Concern     | Choice                          |
| ----------- | ------------------------------- |
| Framework   | Next.js 14 (App Router) + React |
| Styling     | Tailwind CSS (glassmorphism)    |
| Charts      | Recharts                        |
| Animation   | Framer Motion                   |
| Database    | Prisma — SQLite (local dev) · PostgreSQL (production) |
| Auth        | Passphrase + bcrypt + signed JWT cookie (`jose`) |
| Validation  | Zod                             |

## 🚀 Deploy to Vercel (recommended)

1. **Create a Postgres database (free).**
   - In the [Vercel dashboard](https://vercel.com) → your project → **Storage** →
     **Create Database** → **Postgres** (Neon-powered). Or create one at
     [neon.tech](https://neon.tech).
   - Copy the **connection string** (looks like
     `postgresql://user:pass@host/db?sslmode=require`).

2. **Push this folder to a GitHub repo**, then **Import** it into Vercel
   (New Project → Import).

3. **Set Environment Variables** (Project → Settings → Environment Variables), for
   Production **and** Preview:

   | Name           | Value                                                            |
   | -------------- | ---------------------------------------------------------------- |
   | `DATABASE_URL` | your Postgres connection string                                  |
   | `AUTH_SECRET`  | a long random string (see below)                                 |

   Generate a secret:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

4. **Create the tables** once (from your machine, with `DATABASE_URL` set in `.env`):

   ```bash
   npm install
   npm run db:push
   ```

5. **Deploy.** Vercel runs `npm run build` (which also runs `prisma generate`).
   Open the URL and you're live. 🎉

## 💻 Run locally (zero-setup SQLite)

Local development uses a tiny **SQLite** file (`prisma/dev.db`) — **no database
server and no account needed**. Production still uses Postgres (see above).

```bash
# 1. install deps
npm install

# 2. configure env — only AUTH_SECRET is required locally
cp .env.example .env
#   generate a secret:
#   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 3. create the local SQLite tables (run once)
npm run db:push:local

# 4. start the dev server
npm run dev
# open http://localhost:3000
```

> How it works: `npm run dev` first runs `predev`, which generates the Prisma
> client from `prisma/schema.sqlite.prisma` (SQLite). The production `build`
> uses `prisma/schema.prisma` (PostgreSQL). The two schema files contain the
> same models — keep them in sync if you change the data model.
>
> `prisma/dev.db` is git-ignored, so your local data never gets committed.

## 🔐 How privacy works

- A **space** is one person's/household's private ledger, identified by a name and
  protected by a passphrase.
- On **Create**, the passphrase is hashed with bcrypt (cost 12) and stored; a signed,
  HttpOnly session cookie is issued.
- On **Unlock**, the passphrase is verified against the hash. Errors are generic
  (`Incorrect space name or passphrase`) to avoid leaking which spaces exist.
- All expense reads/writes are scoped to the session's space, so you can only ever
  see and edit your own data.

## 📱 Install on your phone (PWA)

Spendly-Plus is a **Progressive Web App**, so you can install it like a native app —
no separate Android build and no database credentials on the device. The app
talks only to the deployed HTTPS API, which owns Prisma + Postgres, so anything
you add on your phone syncs to the exact same database as the web app.

**Android (Chrome):** open your deployed URL → menu (⋮) → **Add to Home screen**
/ **Install app**.

**iOS (Safari):** open the URL → Share → **Add to Home Screen**.

Once installed it launches full-screen with its own icon and works offline for
the app shell (data still needs a connection to sync).

> **Security note:** never put your `DATABASE_URL` in a mobile/client config —
> it would be extractable from the app and expose your database. The client only
> ever needs the **API base URL** (your deployed site). If you later build a
> native client, point it at `NEXT_PUBLIC_API_BASE_URL=https://your-app.vercel.app`
> and authenticate via the existing `/api/auth` + `/api/expenses` endpoints.

## 🗂️ Project structure

```
src/
  app/
    api/            # route handlers (auth + expenses CRUD)
    layout.tsx
    manifest.ts     # PWA web app manifest
    page.tsx
    globals.css
  components/       # UI (Dashboard, charts, forms, auth, SW register)
  lib/              # prisma, auth, analytics, validation, helpers
public/
  sw.js             # service worker (app-shell caching; never caches API)
  icons/            # PWA icons (192/512/maskable)
prisma/
  schema.prisma     # Ledger + Expense models
```

## 📝 Notes

- No secrets are committed — `.env` is git-ignored. Configure them in Vercel.
- Currency is selectable per space (defaults to INR `₹`) via the picker in the header; add more options in `src/lib/currency.tsx`.
