# Architecture

## Request Flow

```
Browser
  │
  ├─ React Page / Client Component
  │     └─ lib/api-client.ts          (type-safe fetch wrapper, browser-side)
  │           └─ Next.js API Route    (server-side handler)
  │                 ├─ lib/server-auth.ts        → requireSession()
  │                 ├─ lib/vestaboard-server.ts  → Vestaboard RW API
  │                 └─ lib/workflow-store.ts / preset-store.ts / message-history.ts
  │
  └─ Vestaboard RW API  (https://rw.vestaboard.com/)
```

## Authentication

Iron Session stores a single `isAuthenticated` boolean in an encrypted, signed cookie. There are no user accounts — a single shared `ACCESS_CODE` environment variable acts as the passphrase.

- `lib/server-auth.ts` exports `requireSession()` — all protected API routes call this first.
- `app/api/auth/login/route.ts` validates the submitted code with a constant-time comparison (`timingSafeEqual`) that pads both strings to the same maximum length before XOR-comparing every character, preventing both timing attacks and length oracle leaks. A 400 ms artificial delay is applied on every failed attempt to slow brute-force attacks.
- On success, iron-session writes an encrypted, tamper-proof session cookie named `vestaboard_session`.

### Session Cookie Configuration (`config/session.ts`)

| Property | Value |
|---|---|
| `httpOnly` | `true` — JavaScript cannot read the cookie |
| `sameSite` | `lax` — sent on same-site requests and top-level GET navigations |
| `maxAge` | 86 400 s (24 hours) |
| `secure` | `true` when `NODE_ENV=production`; overridable via `SECURE_COOKIES=true\|false` |

The default is **fail-closed**: secure cookies are on in production and off in development. The local launchers (`run.sh` / `runWebApp.bat`) pass `SECURE_COOKIES=false` automatically so plain-HTTP localhost works without any configuration. HTTPS deployments (Vercel, Docker behind TLS) get secure cookies from the production default with no extra env var needed.

## Server-Side Proxy Pattern

The Vestaboard API token (`VESTABOARD_API_TOKEN`) lives only in server environment variables. The browser never sees it. Every board operation goes through a Next.js API route that adds the credential server-side and proxies the response back to the client.

```
Client → POST /api/vestaboard/send
           └─ route.ts validates session
           └─ lib/vestaboard-server.ts adds the API key header
           └─ POST https://rw.vestaboard.com/
```

## Data Persistence

Three local JSON files live under `data/` (auto-created on first write, gitignored):

| File | Purpose | Max entries |
|---|---|---|
| `data/presets.json` | Saved named message presets | Unlimited |
| `data/message-history.json` | Log of every sent message | 5,000 |
| `data/workflows.json` | Workflow automation configurations | Unlimited |
| `data/transition.json` | Current transition style + speed | Single object |

### Write-Lock Pattern

Next.js runs multiple concurrent requests. To prevent JSON file corruption, all writes are serialised via a `global.__*WriteQueue` promise chain. The global variable survives hot-reloads in dev mode and ensures writes are never interleaved. A `.catch(run)` on each chain entry ensures a failed write never permanently blocks future writes.

```ts
global.__workflowWriteQueue = (global.__workflowWriteQueue ?? Promise.resolve())
  .then(run)
  .catch(run); // failed predecessor never blocks the chain
await global.__workflowWriteQueue;
```

> **Vercel note:** Serverless functions have an ephemeral filesystem. Files written to `data/` will not persist across deployments or function restarts. See [Deployment](deployment.md) for production persistence options.

## Client-Side State

Pages use React hooks:
- `hooks/use-board-state.ts` — fetches and refreshes the live board display; auto-fetches once on mount with ref-based debounce to avoid duplicate requests.
- `hooks/use-toast.ts` — global toast notification queue.
- `hooks/use-board-model.ts` — reads and writes the selected board model from `localStorage`.
- `hooks/use-session.ts` — checks session validity client-side for route guards.

Client-side logging goes through `lib/client-logger.ts` — an in-memory ring buffer (500 entries) with a pub/sub listener pattern for live log viewers without React re-renders.

## Board Model Switching

Two board profiles are defined in `lib/board-model.ts`:

| Model | Rows | Cols | Total cells |
|---|---|---|---|
| `flagship` | 6 | 22 | 132 |
| `note` | 3 | 15 | 45 |

The selected model is persisted in `localStorage` via `BOARD_MODEL_STORAGE_KEY` and read client-side on load. Validation limits, matrix dimensions, and character counts are all derived automatically from the active profile.

## Component Organisation

```
components/
  board/       — BoardGrid (animated cell display), BoardCell, preview helpers
  dashboard/   — Board display card, presets grid, quick actions, history list, logs
  forms/       — ComposeDrawer (slide-in message composer), PresetEditor
  layout/      — AppShell utilities
  navigation/  — Sidebar, header
  overlays/    — Dialogs and drawers
  feedback/    — Toast queue, client log viewer
  workflows/   — WorkflowRunnerHeartbeat (client component, polls runner API)
  ui/          — Headless/primitive components (Button, Dialog, Toast, etc.)
```

The `app/(app)/compose/page.tsx` file is a thin re-export of the dashboard page. Both `/` and `/compose` share the same layout; the separate route exists for deep-linking purposes.
