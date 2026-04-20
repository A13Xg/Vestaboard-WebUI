# Architecture

## Request Flow

```
Browser
  │
  ├─ Page (React Server Component or Client Component)
  │     └─ lib/api-client.ts (fetch wrapper, browser-safe)
  │           └─ Next.js API Route Handler (server)
  │                 ├─ lib/server-auth.ts  → requireSession()
  │                 ├─ lib/vestaboard-server.ts  → Vestaboard RW API
  │                 └─ lib/workflow-store.ts / preset-store.ts / message-history.ts
  │
  └─ Vestaboard RW API  (https://rw.vestaboard.com/)
```

## Authentication

Iron Session stores a single `isAuthenticated` boolean in an encrypted, signed cookie. There are no user accounts — a single shared `ACCESS_CODE` env variable acts as the passphrase.

- `lib/server-auth.ts` exports `requireSession()` — all protected API routes call this first.
- The login route in `app/api/auth/login/route.ts` uses a constant-time string comparison to prevent timing attacks, plus an artificial 300 ms delay on failure to slow brute-force attempts.
- Session cookies use `httpOnly`, `secure`, and `sameSite: lax`.

## Server-Side Proxy Pattern

The Vestaboard API token (`VESTABOARD_API_TOKEN`) lives only in server environment variables. The browser never sees it. Every board operation goes through a Next.js API route that forwards the request server-side and proxies the response back to the client.

```
Client → POST /api/vestaboard/send
           └─ route.ts validates session
           └─ lib/vestaboard-server.ts adds the API key header
           └─ POST https://rw.vestaboard.com/
```

## Data Persistence

Three local JSON files live under `data/` (auto-created, gitignored):

| File | Purpose |
|---|---|
| `data/presets.json` | Saved named message presets |
| `data/message-history.json` | Log of every sent message (max 5 000) |
| `data/workflows.json` | Workflow automation configurations |

### Write-Lock Pattern

Next.js runs multiple concurrent requests. To prevent JSON file corruption, all writes are serialised via a `global.__*WriteQueue` promise chain. The global variable survives hot-reloads in dev mode and ensures writes are never interleaved.

```ts
global.__workflowWriteQueue = (global.__workflowWriteQueue ?? Promise.resolve())
  .then(run)
  .catch(run); // failed predecessor never blocks the chain
await global.__workflowWriteQueue;
```

## Client-Side State

Pages use React hooks:
- `hooks/use-board-state.ts` — fetches and refreshes the current board display; auto-fetches once on mount.
- `hooks/use-toast.ts` — global toast notification queue (no external library).

Client-side logging goes through `lib/client-logger.ts` — an in-memory ring buffer (500 entries) with a pub/sub listener pattern for live log viewers without React re-renders.

## Board Model Switching

Two board profiles exist (`flagship` 6×22, `note` 3×15) defined in `lib/board-model.ts`. The selected model is persisted in `localStorage` via `BOARD_MODEL_STORAGE_KEY` and read client-side on load. Validation limits are automatically derived from the active profile's `rows × cols`.

## Component Organisation

```
components/
  dashboard/   — Board display, presets grid, quick actions, history, logs
  forms/       — ComposeDrawer (slide-in message composer), PresetEditor
  layout/      — AppShell (sidebar nav, responsive layout)
  workflows/   — WorkflowRunnerHeartbeat (client component, fires runner API)
  ui/          — Headless/primitive components (Button, Dialog, Toast, etc.)
```

The `app/(app)/compose/page.tsx` file is a 3-line re-export of the dashboard page. Both `/` and `/compose` share identical layout; the separate route exists for deep-linking and future divergence.
