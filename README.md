# 💸 Spendly-Plus — Liquid-Glass Expense Tracker

A beautiful, interactive expense tracker with an Apple / iOS-style **liquid glass**
UI. Log daily, monthly and yearly expenses, visualise them with live donut, trend
and bar charts, and keep everything private behind a **passphrase**. Built with
Next.js and ready to deploy to **Vercel** in minutes.

![Spendly-Plus landing page](docs/landing.png)

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
| Framework   | Next.js 16 (App Router) + React 19 |
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
> ever needs the **API base URL** (your deployed site).

## 📦 Build a native app (APK / iOS) with Capacitor

Prefer a real installable binary over "Add to Home screen"? The project ships with
[Capacitor](https://capacitorjs.com). The native shell loads your **deployed HTTPS
site** (via `server.url`), so the app always runs the same code as the web app and
updates the instant you deploy — no app-store re-submission, and **no database
credentials on the device** (only your public site URL).

> The PWA install route still works exactly as before; Capacitor is just an
> additional, more "app-like" distribution option.

### Prerequisites

- **Android:** a JDK **21** + the Android SDK. No Android Studio required — `make setup-android` installs both via Homebrew (see below).
- **iOS:** macOS with the full **Xcode** app (Capacitor 8 uses Swift Package Manager — no CocoaPods needed). Command Line Tools alone are not enough.

### Easiest: `make` (no Android Studio needed)

A `Makefile` wraps the whole flow so you can build an APK from the terminal — you
only need the SDK, not the Android Studio GUI:

Set your deployment URL once in `.env`:

```bash
CAP_SERVER_URL="https://your-app.vercel.app"
```

Then:

```bash
make doctor            # see what's installed/missing
make setup-android     # one-time: JDK 21 + Android SDK via Homebrew (no sudo)
make android           # build the debug APK (reads CAP_SERVER_URL from .env)
#   → android/app/build/outputs/apk/debug/spendly-plus.apk
```

You can also pass it inline instead of using `.env`:
`make android CAP_SERVER_URL=https://your-app.vercel.app`.

Other targets: `make android-release`, `make ios` (needs full Xcode), `make sync`,
`make clean`. iOS still requires the full **Xcode** app (Command Line Tools alone
can't build an iOS app).

### Manual (Android Studio / Xcode GUI)

The `android/` and `ios/` native projects are already generated. Always pass your
deployment URL via `CAP_SERVER_URL` so the shell knows what to load:

```bash
# 1. Point the shell at your live site and sync the config into the native projects
CAP_SERVER_URL="https://your-app.vercel.app" npm run cap:sync

# 2a. Android — opens Android Studio; then Run ▶ or Build → Build APK / Bundle
CAP_SERVER_URL="https://your-app.vercel.app" npm run cap:android

# 2b. iOS — opens Xcode; pick a device/simulator and Run, or Archive for the App Store
CAP_SERVER_URL="https://your-app.vercel.app" npm run cap:ios
```

- **APK:** in Android Studio → **Build → Build Bundle(s)/APK(s) → Build APK(s)**.
  The `.apk` lands in `android/app/build/outputs/apk/`.
- **iOS app:** in Xcode → select a signing team → **Product → Archive** (or Run on a
  simulator/device).

If you ever need to regenerate a platform from scratch: `npm run cap:add:android`
or `npm run cap:add:ios`.

> **How it works:** `capacitor.config.ts` reads `CAP_SERVER_URL` at sync time. If it
> isn't set, the app falls back to a small bundled splash screen (`native/www`) that
> reminds you to configure the URL. Because the shell simply renders your deployed
> site, cookie-based sessions, charts, and offline caching all behave identically to
> the browser.

### 📥 Download the APK (GitHub Releases + CI)

The footer of the site has a **“Android app”** download button that points to:

```
https://github.com/Rakitic07/ExpenseApp/releases/latest/download/spendly-plus.apk
```

That asset is produced automatically by the GitHub Actions workflow
[`.github/workflows/android-release.yml`](.github/workflows/android-release.yml):

- **Push a version tag** (`git tag v1.0.0 && git push origin v1.0.0`) → builds
  `spendly-plus.apk` and publishes a Release for that tag.
- **Or run it manually** from the repo's **Actions → Build Android APK & Release →
  Run workflow** → updates a rolling `android-latest` Release.

The workflow uses the public `CAP_SERVER_URL` (`https://spendly-plus.vercel.app/`) by
default; override it by adding a repo **variable** named `CAP_SERVER_URL`. The APK is a
debug-signed build (installable via sideloading); for Play Store distribution, sign a
release build with your own keystore.

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
capacitor.config.ts # native shell config (loads deployed site via CAP_SERVER_URL)
native/www/         # offline splash bundled into the native app
android/ · ios/     # generated Capacitor native projects (APK / Xcode)
```

## 📝 Notes

- No secrets are committed — `.env` is git-ignored. Configure them in Vercel.
- Currency is selectable per space (defaults to INR `₹`) via the picker in the header; add more options in `src/lib/currency.tsx`.
