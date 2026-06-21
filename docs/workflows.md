# Workflow System

Workflows send automated messages to the Vestaboard on a schedule, optionally pulling live data from external providers and interpolating it into the message template.

## Data Model

```ts
interface Workflow {
  id: string;                          // "wf-<timestamp>-<random>"
  name: string;
  enabled: boolean;
  message: WorkflowMessage;            // text template, alignment, style, colorInserts
  dataSource: WorkflowDataSource | null;
  dataSources: WorkflowDataSource[];   // multi-source support
  schedule: WorkflowSchedule;
  nextRunAt: string | null;            // ISO — null when disabled or one-time past
  lastRunAt: string | null;
  lastExecution: WorkflowExecutionRecord | null;
  createdAt: string;
  updatedAt: string;
}
```

---

## Schedule Types

| `type` | Required fields | Description |
|---|---|---|
| `once` | `at` (ISO datetime) | Fires once at the given time, then `nextRunAt` becomes `null` |
| `daily` | `timeHHMM` (`HH:mm`) | Fires every day at the given wall-clock time |
| `weekly` | `timeHHMM`, `daysOfWeek` | Fires on the listed weekdays (0 = Sun … 6 = Sat) |
| `cron` | `cron` string | Parses first two fields only: `minute hour * * *` |

> **Cron limitation:** Only minute and hour fields are evaluated. Day-of-month, month, and day-of-week cron fields are ignored. Use `daily` or `weekly` for day-based schedules.

### Next-Run Calculation (`lib/workflow-scheduler.ts`)

- All comparisons are **minute-aligned** (seconds and milliseconds are stripped) to prevent double-firing within the same minute.
- For `weekly`, up to 8 days ahead are scanned; falls back to +7 days if no matching weekday is found.
- For `cron`, iterates minute-by-minute up to 14 days ahead to find the next match.

---

## Execution Pipeline

1. **Trigger** — the heartbeat component polls the runner API on a configurable interval, or an external cron calls `POST /api/workflows/runner` with the cron secret.
2. **Select due workflows** — `runDueWorkflows()` in `lib/workflow-store.ts` filters `enabled && nextRunAt <= now`.
3. **Resolve data sources** — if `dataSource` or `dataSources` are configured, `lib/workflow-integrations.ts` calls the external APIs. Only providers whose variables are actually referenced in the template are fetched.
4. **Render template** — `{variable}` placeholders in the message text are replaced with resolved values. Color tokens like `{R}` are passed through unchanged for the matrix builder.
5. **Build matrix** — the rendered text is word-wrapped and converted into an exact Vestaboard character-code matrix; color tokens become fill-tile codes.
6. **Send** — `sendMessageToVestaboard()` POSTs the matrix to the Vestaboard RW endpoint, retrying up to 3 times on rate-limit responses.
7. **Update store** — `lastRunAt`, `nextRunAt`, and `lastExecution` are written back to `data/workflows.json` inside the write-lock.

---

## Runner API

`POST /api/workflows/runner`

### Request body

```json
// Run all overdue enabled workflows
{ "mode": "due" }

// Run one specific workflow immediately (bypasses schedule check)
{ "mode": "single", "workflowId": "wf-..." }
```

### Authentication

Accepts either:
- A valid **iron-session cookie** (set by the login flow, used by browser UI calls)
- The `CRON_SECRET` value in the `X-Cron-Secret` header **or** `Authorization: Bearer <secret>`

### Health check

`GET /api/workflows/runner` — returns `200 OK` if the runner is reachable and authenticated.

### Vercel Cron

```json
// vercel.json
{
  "crons": [{ "path": "/api/workflows/runner", "schedule": "*/5 * * * *" }]
}
```

Set `CRON_SECRET` in Vercel project environment variables. Vercel Cron Jobs attach it automatically when configured.

---

## Heartbeat Component

`components/workflows/WorkflowRunnerHeartbeat.tsx` is a client-side React component that polls the runner API on a configurable interval when the Workflow Studio page is open. This provides in-browser scheduling without requiring an external cron service during local development.

---

## Preview API

`POST /api/workflows/preview` — resolves the data source and renders the template without sending to the board. Used by the Workflow Studio live preview card.

```json
// Request
{
  "messageText": "{tempDeg}C IN {location}",
  "dataSource": { "providerId": "weather", "config": { "location": "Tokyo" } }
}

// Response
{
  "renderedText": "22C IN TOKYO JAPAN",
  "renderedMatrix": [[...]],
  "variables": { "tempDeg": "22", "location": "TOKYO JAPAN", ... },
  "providerLabel": "Weather"
}
```

---

## Data Providers

| Provider | Variables | External API |
|---|---|---|
| `weather` | `{location}` `{tempDeg}` `{tempDegF}` `{condition}` `{conditionIconSymbol}` `{windKph}` | Open-Meteo (free, no key) |
| `crypto` | `{assetName}` `{assetId}` `{price}` `{currency}` `{change24hPct}` | CoinGecko (free tier) |
| `stocks` | `{symbol}` `{date}` `{time}` `{open}` `{high}` `{low}` `{close}` `{volume}` | Stooq (free) |
| `news` | `{headline}` `{author}` `{points}` `{query}` `{url}` | Hacker News Algolia (free) |
| `quote` | `{quote}` `{author}` | DummyJSON (free) |
| `exchange-rates` | `{base}` `{target}` `{rate}` `{date}` | Frankfurter (free) |
| `time` | `{time}` `{date}` `{hour}` `{min}` `{sec}` `{month}` `{day}` `{year}` `{weekDay}` `{monthWord}` `{timezone}` `{timezoneLabel}` `{location}` `{locale}` | Server system clock |
| `joke` | `{setup}` `{punchline}` `{type}` | Official Joke API (free) |
| `gemma` | `{response}` `{prompt}` `{model}` `{content}` `{temperature}` | Google Gemma via Gemini API (`GEMMA_API_KEY`) |

Providers referenced in a template but not configured on the workflow are skipped. Multiple providers can be enabled on a single workflow.

### Gemma Workflow

The `gemma` provider uses `GEMMA_API_KEY` server-side to call Google's Gemma model through the Gemini API. The workflow stores a user-editable `prompt` in `WorkflowDataSource.config`, resolves the API response into `{response}`, and defaults the output template to `{response}` so the generated message can be sent directly to the board.

When Gemma returns a word that must be split across board rows, the renderer inserts hyphens so the wrapped output stays readable on the Vestaboard.

---

## Integration Definitions

Integration metadata (labels, field definitions, default templates, available variables) is declared in `lib/workflow-integration-defs.ts`. Resolver logic lives in `lib/workflow-integrations.ts`.

See [Adding Integrations](adding-integrations.md) to extend the system with a new provider.

---

## Verification Harness

`npm run workflow:schedule:test` runs an end-to-end scheduling verification against a running local app instance.

It verifies:
1. Runner auth rejection without credentials
2. Unattended runner access with `CRON_SECRET`
3. Browser-session / heartbeat-style due execution
4. `once`, `daily`, `weekly`, and `cron` schedule advancement
5. Preview fitting across representative providers
6. Scheduled execution for representative workflow categories

**Requirements:**
- The app must already be running locally (`npm run dev` or `npm run start`)
- `.env.local` must contain `ACCESS_CODE` and `CRON_SECRET`
- External provider APIs must be reachable

The harness creates temporary workflows through the real API, waits for due times, confirms workflow state and history updates, then deletes the temporary workflows on cleanup.
