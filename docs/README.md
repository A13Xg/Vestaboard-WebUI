# Developer Documentation

This directory contains technical documentation for the Vestaboard WebUI project.

## Contents

| Document | What's inside |
|---|---|
| [Architecture](architecture.md) | Request flow, authentication model, server-side proxy pattern, data persistence, write-lock pattern, component organisation |
| [Workflows](workflows.md) | Workflow data model, schedule types, execution pipeline, runner API, data providers, heartbeat component, verification harness |
| [Character Encoding](character-encoding.md) | Vestaboard numeric codes, colour fill tiles, board dimensions, matrix format, utility functions |
| [Deployment](deployment.md) | Local dev, production build, launcher scripts, Vercel, Docker, environment variables, security checklist |
| [Adding Integrations](adding-integrations.md) | Step-by-step guide to adding a new workflow data provider |

---

## Quick Reference

### Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | Yes | Iron-session cookie encryption key (32+ chars) |
| `ACCESS_CODE` | Yes | Login passphrase for the single-user access gate |
| `VESTABOARD_API_TOKEN` | Yes | Vestaboard RW API key |
| `CRON_SECRET` | Optional | Authorization token for the workflow runner endpoint |
| `GEMMA_API_KEY` | Optional | Google AI Studio key for Gemma-powered workflows |

### Key Source Files

| File | Purpose |
|---|---|
| `lib/server-auth.ts` | `requireSession()` — call first in every protected API route |
| `lib/vestaboard-server.ts` | Server-side Vestaboard proxy (board read/write/retry) |
| `lib/board-utils.ts` | Character encoding, matrix helpers, text-to-board pipeline |
| `lib/message-validation.ts` | Text and matrix validation against board character set |
| `lib/workflow-store.ts` | Workflow CRUD + execution runner (write-locked) |
| `lib/workflow-scheduler.ts` | Next-run-at calculation for all schedule types |
| `lib/workflow-integrations.ts` | Data provider resolvers (weather, crypto, stocks, …) |
| `lib/workflow-integration-defs.ts` | Integration metadata (labels, fields, default templates) |
| `lib/preset-store.ts` | Preset CRUD (write-locked) |
| `lib/message-history.ts` | Append-only message history store (write-locked) |
| `lib/transition-store.ts` | Transition style + speed persistence |
| `lib/gemma-server.ts` | Google Gemma API client with fallback model support |
| `lib/client-logger.ts` | In-memory ring-buffer log with pub/sub for live viewers |
| `config/constants.ts` | Board dimensions, colour map, route and API path constants |
| `types/index.ts` | All TypeScript DTOs and domain interfaces |

### npm Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with Turbopack hot-reload |
| `npm run build` | Production build + type-check |
| `npm run start` | Serve production build |
| `npm run startup:test` | Validate env vars and API connectivity |
| `npm run workflow:schedule:test` | End-to-end workflow scheduling verification |
