# Vestaboard WebUI

Production-oriented Next.js control panel for authenticated Vestaboard operations.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Framer Motion
- React Hook Form + Zod
- Lucide React
- Iron Session (secure cookie auth)

## Environment Variables

Create `.env.local` from `.env.local.example` and set:

- `SESSION_SECRET`: session cookie encryption secret
- `ACCESS_CODE`: server-validated login code
- `VESTABOARD_API_TOKEN`: Vestaboard read/write API key
- `CRON_SECRET`: secret for scheduled workflow runner authorization

## Local Commands

```bash
npm install
npm run dev
npm run build
npm run start
```

Windows batch helper:

```bat
.\build-and-live-test.bat
```

## Architecture Overview

- `app/(app)/*`: authenticated UI shell (dashboard, compose, workflows, settings)
- `app/login/*`: access-code login
- `app/api/auth/*`: login/logout/session server routes
- `app/api/vestaboard/*`: secure Vestaboard proxy routes
- `app/api/workflows/*`: CRUD + execution routes for automated workflows
- `components/*`: reusable UI/layout/feature components
- `lib/*`: server/client utilities, workflow scheduler/store, API wrappers
- `types/index.ts`: DTOs and domain interfaces

## Workflow Scheduling

The app supports creating and modifying automated workflows with schedule types:

- Once (`type: once`, ISO datetime)
- Daily (`type: daily`, `HH:mm`)
- Weekly (`type: weekly`, `HH:mm` + weekdays)
- Cron (`type: cron`, basic `minute hour * * *` support)

Key endpoints:

- `GET/POST /api/workflows`
- `GET/PATCH/DELETE /api/workflows/:id`
- `POST /api/workflows/runner`

`/api/workflows/runner` supports:

- Session-authenticated manual execution from UI
- Cron execution via `CRON_SECRET` (Bearer token or `x-cron-secret`)

## Vercel Scheduled Execution

`vercel.json` includes a cron schedule:

- `*/5 * * * *` -> `POST /api/workflows/runner`

Set `CRON_SECRET` in Vercel project environment variables for secure triggering.

## Current Integration Status

- `GET /api/vestaboard/current`: attempts live board fetch, falls back to mock safely
- `POST /api/vestaboard/send`: sends matrix payload server-side with API key
- `GET /api/vestaboard/connectivity`: checks API token connectivity

No secrets are exposed to client-side code.
