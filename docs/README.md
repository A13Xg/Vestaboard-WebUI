# Docs Index

Welcome to the Vestaboard WebUI developer documentation.

## Pages

| Document | Summary |
|---|---|
| [Architecture](architecture.md) | Request flow, authentication, data persistence, write-lock pattern, component organisation |
| [Workflows](workflows.md) | Workflow data model, schedule types, execution pipeline, runner API, heartbeat component |
| [Character Encoding](character-encoding.md) | Vestaboard character codes, colour tiles, board dimensions, utility functions |
| [Deployment](deployment.md) | Local dev, Vercel, Docker, environment variables, security checklist |
| [Adding Integrations](adding-integrations.md) | Step-by-step guide to adding a new workflow data provider |

## Quick Reference

### Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | Yes | Iron-session cookie encryption key |
| `ACCESS_CODE` | Yes | Login passphrase |
| `VESTABOARD_API_TOKEN` | Yes | Vestaboard RW API key |
| `CRON_SECRET` | Optional | Authorization token for workflow scheduler |

### Key Files

| File | Purpose |
|---|---|
| `lib/server-auth.ts` | `requireSession()` — use in every protected API route |
| `lib/vestaboard-server.ts` | Server-side Vestaboard proxy (board read/write) |
| `lib/board-utils.ts` | Character encoding, matrix helpers |
| `lib/workflow-store.ts` | Workflow CRUD + runner |
| `lib/workflow-scheduler.ts` | Next-run-at calculation |
| `lib/workflow-integrations.ts` | Data provider resolvers |
| `lib/client-logger.ts` | In-memory client log ring buffer |
| `config/constants.ts` | Board dimensions, colour map, route constants |
| `types/index.ts` | All TypeScript DTOs and domain interfaces |
