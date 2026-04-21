# Vestaboard WebUI

Production-oriented Next.js control panel for authenticated Vestaboard operations.

> Full developer wiki: [`docs/`](docs/)

---

## Stack

| Layer | Library |
|---|---|
| Framework | Next.js 16 App Router + TypeScript |
| Styling | Tailwind CSS |
| Animation | Framer Motion |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |
| Auth | Iron Session (encrypted cookie) |

---

## Quick Start

```bash
cp .env.local.example .env.local   # fill in env vars (see below)
npm install
npm run dev
```

Windows batch helper (build + start):

```bat
.\build-and-live-test.bat
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SESSION_SECRET` | Yes | 32+ char secret for iron-session cookie encryption |
| `ACCESS_CODE` | Yes | Single-user passphrase for the login screen |
| `VESTABOARD_API_TOKEN` | Yes | Vestaboard RW (read/write) API key |
| `CRON_SECRET` | Optional | Bearer token for external workflow scheduler calls |
| `GEMMA_API_KEY` | Optional | Google AI Studio API key for Gemma-powered workflows |

Create `.env.local` from `.env.local.example` and populate all required values before running.

---

## Project Structure

```
app/
  (app)/               # Authenticated app shell (layout + pages)
    page.tsx           # Dashboard — board preview, presets, history
    compose/page.tsx   # /compose — re-exports dashboard page
    workflows/page.tsx # Workflow Studio
    settings/page.tsx  # Settings (connectivity, board model, transitions)
  login/               # Login page (access-code entry)
  quick-send/page.tsx  # /quick-send — minimal mobile-first send flow
  api/
    auth/              # login / logout / session check
    vestaboard/        # current, send, preview, transition, connectivity
    workflows/         # CRUD + runner + preview endpoints
    messages/          # Message history endpoint

components/
  dashboard/           # Board display, presets, quick actions, history cards
  forms/               # ComposeDrawer, PresetEditor
  layout/              # AppShell, navigation
  workflows/           # WorkflowRunnerHeartbeat client component
  ui/                  # Primitive UI components (button, dialog, toast, etc.)

lib/
  board-utils.ts       # Character code encoding/decoding, matrix helpers
  board-model.ts       # Board model definitions (flagship 6×22, note 3×15)
  vestaboard-server.ts # Server-side Vestaboard API proxy + send pipeline
  message-validation.ts # Text + matrix validation against board character set
  message-history.ts   # JSON-backed message history store (write-locked)
  workflow-store.ts    # JSON-backed workflow store (write-locked CRUD + runner)
  workflow-scheduler.ts # Next-run-at calculation and schedule summaries
  workflow-integrations.ts  # Data provider resolvers (weather, crypto, stocks…)
  workflow-integration-defs.ts # Integration metadata (labels, fields, templates)
  server-auth.ts       # requireSession() / getSession() iron-session helpers
  api-client.ts        # Type-safe browser-side API wrapper
  client-logger.ts     # In-memory ring-buffer log (500 entries, subscriber pattern)
  mock-data.ts         # Fallback data used when Vestaboard API is unavailable

hooks/
  use-board-state.ts   # Fetches + refreshes the live board display
  use-toast.ts         # Global toast notification system

config/
  index.ts / constants.ts  # Board dimensions, colour map, app routes, API routes
  session.ts           # Iron-session cookie config

types/index.ts         # All DTOs and domain interfaces

data/                  # Runtime JSON persistence (gitignored)
  presets.json
  message-history.json
  workflows.json
```

---

## Architecture Overview

### Authentication

All protected pages and API routes go through `lib/server-auth.ts`:
- `requireSession()` — use in every protected API route handler
- `getSession()` — use when you need the raw session object

The login flow validates `ACCESS_CODE` with a constant-time string comparison to prevent timing attacks, then sets an encrypted iron-session cookie.

### Board Communication

All Vestaboard API calls happen server-side via `lib/vestaboard-server.ts`. The browser never sees the API token. The client-side `lib/api-client.ts` calls the Next.js proxy routes which forward requests to the Vestaboard RW endpoint.

### Data Persistence

Three JSON files under `data/` (auto-created on first write, gitignored):

| File | Store | Max entries |
|---|---|---|
| `presets.json` | Named message presets | Unlimited |
| `message-history.json` | Sent message log | 5 000 |
| `workflows.json` | Workflow automation configs | Unlimited |

All writes are serialised through a `global.__*WriteQueue` promise chain (write-lock pattern) to prevent concurrent writes corrupting the file under simultaneous requests.

### Character Encoding

Vestaboard uses a numeric character-code system (not ASCII):
- `0` = blank cell
- `1–26` = A–Z
- `27–35` = 1–9
- `36` = 0
- `37–60` = punctuation (see `board-utils.ts`)
- `63–71` = colour fill tiles (see `COLOR_MAP` in `config/constants.ts`)

`lib/board-utils.ts` provides `charToCode`, `codeToChar`, `textToMatrix`, and matrix helpers.

---

## Workflow Scheduling

Workflows are automated messages sent to the board on a schedule.

### Schedule Types

| Type | Config fields | Example |
|---|---|---|
| `once` | `at` (ISO datetime) | `"at": "2026-05-01T09:00:00Z"` |
| `daily` | `timeHHMM` | `"timeHHMM": "08:30"` |
| `weekly` | `timeHHMM`, `daysOfWeek` (0=Sun) | `"daysOfWeek": [1,3,5]` |
| `cron` | `cron` (`minute hour * * *`) | `"cron": "0 9 * * *"` |

> Note: Only the first two cron fields (minute + hour) are parsed. Day-of-month, month, and day-of-week cron fields are ignored.

### Data Sources (Integrations)

Each workflow can optionally pull live data from a provider and interpolate it into the message template using `{variableName}` placeholders.

| Provider | Variables | External API |
|---|---|---|
| `weather` | `{location}` `{tempDeg}` `{tempDegF}` `{condition}` `{conditionIconSymbol}` `{windKph}` | Open-Meteo (free, no key) |
| `crypto` | `{assetName}` `{price}` `{currency}` `{change24hPct}` | CoinGecko (free tier) |
| `stocks` | `{symbol}` `{open}` `{high}` `{low}` `{close}` `{volume}` | Stooq (free) |
| `news` | `{headline}` `{author}` `{points}` | Hacker News Algolia (free) |
| `quote` | `{quote}` `{author}` | DummyJSON (free) |
| `exchange-rates` | `{base}` `{target}` `{rate}` `{date}` | Frankfurter (free) |
| `time` | `{time}` `{date}` `{timezone}` `{timezoneLabel}` | Server system clock |
| `joke` | `{setup}` `{punchline}` `{type}` | Official Joke API (free) |
| `gemma` | `{response}` `{prompt}` `{model}` | Google Gemma via Gemini API (`GEMMA_API_KEY`) |

### API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/workflows` | List all workflows |
| POST | `/api/workflows` | Create a workflow |
| GET | `/api/workflows/:id` | Get one workflow |
| PATCH | `/api/workflows/:id` | Update a workflow |
| DELETE | `/api/workflows/:id` | Delete a workflow |
| POST | `/api/workflows/runner` | Run due or specific workflow |
| POST | `/api/workflows/preview` | Preview rendered output |

### Runner Authentication

`POST /api/workflows/runner` accepts two auth methods:
1. **Session cookie** (browser / UI)
2. **CRON_SECRET** via `X-Cron-Secret: <secret>` header or `Authorization: Bearer <secret>`

### Vercel Cron

`vercel.json` schedules `POST /api/workflows/runner` every 5 minutes:

```json
{
  "crons": [{ "path": "/api/workflows/runner", "schedule": "*/5 * * * *" }]
}
```

Set `CRON_SECRET` in Vercel environment variables and add it to the cron request header.

---

## Vestaboard API Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/vestaboard/current` | Fetch live board state (falls back to mock) |
| POST | `/api/vestaboard/send` | Send text or matrix to the board |
| POST | `/api/vestaboard/preview` | Generate a matrix preview from text |
| GET | `/api/vestaboard/transition` | Get current transition setting |
| PUT | `/api/vestaboard/transition` | Update transition setting |
| GET | `/api/vestaboard/connectivity` | Check API token connectivity |

No API keys or secrets are ever sent to the browser.

### Quick Send

`/quick-send` is a stripped-down authenticated mobile page that:
- shows the current board state
- exposes a single large **Send Message** CTA
- previews the draft before sending
- confirms the send by refetching the current board message and matching it to the just-sent matrix before showing success

---

## Further Reading

- [Architecture deep-dive](docs/architecture.md)
- [Workflow system](docs/workflows.md)
- [Character encoding](docs/character-encoding.md)
- [Deployment guide](docs/deployment.md)
- [Adding integrations](docs/adding-integrations.md)

