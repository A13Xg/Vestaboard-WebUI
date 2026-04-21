# Workflow System

Workflows send automated messages to the Vestaboard on a schedule, optionally pulling live data from external providers.

## Data Model

```ts
interface Workflow {
  id: string;               // "wf-<timestamp>-<random>"
  name: string;
  enabled: boolean;
  message: WorkflowMessage; // text template, alignment, style, colorInserts
  dataSource: WorkflowDataSource | null;
  schedule: WorkflowSchedule;
  nextRunAt: string | null; // ISO — null when disabled or one-time past
  lastRunAt: string | null;
  lastExecution: WorkflowRunResult | null;
  createdAt: string;
  updatedAt: string;
}
```

## Schedule Types

| `type` | Required fields | Description |
|---|---|---|
| `once` | `at` (ISO datetime) | Fires once at the given time, then `nextRunAt` becomes null |
| `daily` | `timeHHMM` (`HH:mm`) | Fires every day at the given time |
| `weekly` | `timeHHMM`, `daysOfWeek` | Fires on the listed weekdays (0=Sun … 6=Sat) |
| `cron` | `cron` string | Parses first two fields only: `minute hour * * *` |

> **Cron limitation:** Only minute and hour fields are evaluated. Day-of-month, month, and day-of-week fields are ignored. Use `daily` or `weekly` for day-based schedules.

### Next-Run Calculation

`lib/workflow-scheduler.ts` — `computeNextRunAt(schedule, now)`:
- Comparisons are always **minute-aligned** (seconds/ms stripped) to prevent double-firing.
- For `weekly`, up to 8 days ahead are scanned; falls back to +7 days if no match.
- For `cron`, iterates minute-by-minute up to 14 days ahead.

## Execution Pipeline

1. **Trigger** — either the heartbeat component polls the runner API, or an external scheduler calls `POST /api/workflows/runner` with the cron secret.
2. **Select due workflows** — `runDueWorkflows()` in `lib/workflow-store.ts` filters `enabled && nextRunAt <= now`.
3. **Resolve data source** — if a `dataSource` is set, `lib/workflow-integrations.ts` calls the external API.
4. **Render template** — `{variable}` placeholders in the message text are replaced with resolved values.
5. **Sanitise** — `boardSafe()` strips non-Vestaboard characters and normalises Unicode.
6. **Wrap for board output** — rendered text is converted into an exact Vestaboard matrix; Gemma responses hyphenate oversized words when they continue onto the next line.
7. **Validate** — `validateMessageText()` confirms the final rendered output fits the board and uses only supported characters.
8. **Send** — `sendMessageToVestaboard()` POSTs the exact matrix to the Vestaboard RW endpoint.
9. **Update store** — `lastRunAt`, `nextRunAt`, and `lastExecution` are written back to `data/workflows.json`.

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
- A valid **iron-session cookie** (browser UI calls)
- The `CRON_SECRET` value in the `X-Cron-Secret` header **or** `Authorization: Bearer <secret>`

### Vercel Cron

```json
// vercel.json
{
  "crons": [{ "path": "/api/workflows/runner", "schedule": "*/5 * * * *" }]
}
```

Set `CRON_SECRET` in Vercel project environment variables. Vercel Cron Jobs attach it automatically when configured.

## Heartbeat Component

`components/workflows/WorkflowRunnerHeartbeat.tsx` is a client-side React component that polls the runner API on a configurable interval when the Workflow Studio page is open. This provides in-browser scheduling without requiring an external cron service during development.

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
  "variables": { "tempDeg": "22", "location": "TOKYO JAPAN", ... },
  "providerLabel": "Weather"
}
```

## Integration Definitions

Integration metadata (labels, field definitions, default templates, available variables) is declared in `lib/workflow-integration-defs.ts`. The resolver logic lives in `lib/workflow-integrations.ts`.

### Gemma Workflow

The `gemma` provider uses `GEMMA_API_KEY` server-side to call Google's Gemma model through the Gemini API. The workflow stores a user-editable `prompt` in `WorkflowDataSource.config`, resolves the API response into `{response}`, and defaults the output template to `{response}` so the generated message can be sent directly to the board.

When Gemma returns a word that must be split across board rows, the workflow renderer inserts hyphens so the wrapped output stays readable on the Vestaboard.

See [Adding Integrations](adding-integrations.md) to extend the system.
