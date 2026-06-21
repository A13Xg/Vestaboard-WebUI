# Deployment Guide

## Prerequisites

- Node.js 20+
- A Vestaboard RW (read/write) API key

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in all required values:

```bash
cp .env.local.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `SESSION_SECRET` | Yes | 32+ character random string for cookie encryption |
| `ACCESS_CODE` | Yes | Passphrase for the login screen |
| `VESTABOARD_API_TOKEN` | Yes | Vestaboard RW API key |
| `CRON_SECRET` | Optional | Bearer token for external workflow scheduler calls |
| `GEMMA_API_KEY` | Optional | Google AI Studio key for Gemma-powered workflows |

### Generating Secrets

```bash
# SESSION_SECRET (Node.js)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# CRON_SECRET
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

---

## Local Development

```bash
npm install
npm run dev          # starts Next.js dev server with Turbopack at http://localhost:3000
```

Hot-reload is enabled. The dev server does not require a production build.

---

## Production Build

```bash
npm run build        # compiles and type-checks
npm run start        # serves the built app on port 3000
```

### Launcher Scripts

Two convenience scripts handle the full build-and-start cycle:

**macOS / Linux:**
```bash
chmod +x run.sh
./run.sh
```

**Windows:**
```bat
.\runWebApp.bat
```

Both scripts:
1. Install npm dependencies
2. Run the production build
3. Run startup tests *(advisory — failures print a warning but do not stop startup)*
4. Clear port 3000 if occupied
5. Start the production server

---

## Vercel Deployment

1. Push the repository to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Add all environment variables in the Vercel project settings.
4. Deploy.

If you plan to use the Gemma workflow integration, add `GEMMA_API_KEY` to the Vercel environment variables.

### Cron Jobs (Vercel)

`vercel.json` defines a cron job that fires `POST /api/workflows/runner` every 5 minutes:

```json
{
  "crons": [{ "path": "/api/workflows/runner", "schedule": "*/5 * * * *" }]
}
```

Set `CRON_SECRET` in Vercel project environment variables. Vercel Cron Jobs automatically attach it when configured.

---

## Data Persistence on Vercel

> **Important:** Vercel's serverless functions have an ephemeral filesystem. Files written to `data/` during a request will **not** persist across deployments or function restarts.

For production use on Vercel, replace the JSON file stores with a persistent data layer:
- [Vercel KV](https://vercel.com/docs/storage/vercel-kv) (Redis-compatible)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- Any external database or key-value store

The store modules are isolated in `lib/workflow-store.ts`, `lib/message-history.ts`, `lib/preset-store.ts`, and `lib/transition-store.ts` — swap the read/write functions to use your chosen backend.

---

## Docker

No Dockerfile is included, but a minimal setup:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Enable `output: 'standalone'` in `next.config.ts` for this to work.

Mount a persistent volume at `/app/data` so the JSON stores survive container restarts.

---

## Security Checklist

- [ ] `SESSION_SECRET` is at least 32 characters of random entropy
- [ ] `ACCESS_CODE` is strong and not reused elsewhere
- [ ] `CRON_SECRET` is set and rotated periodically
- [ ] `GEMMA_API_KEY` is scoped to the project in Google AI Studio
- [ ] HTTPS is enforced in production (Vercel handles this automatically)
- [ ] The `data/` directory is excluded from version control (`.gitignore`)
- [ ] No `.env.local` or secrets file is committed to the repository
- [ ] `AGENTS.md` / `CLAUDE.md` / agentic files are excluded from version control
