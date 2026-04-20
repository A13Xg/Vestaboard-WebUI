# Deployment Guide

## Prerequisites

- Node.js 20+
- A Vestaboard RW (read/write) API key

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in all required values:

```bash
SESSION_SECRET=<32+ random characters>
ACCESS_CODE=<your chosen passphrase>
VESTABOARD_API_TOKEN=<vestaboard rw api key>
CRON_SECRET=<random secret for workflow scheduling>
```

### Generating Secrets

```bash
# SESSION_SECRET (Node.js)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# CRON_SECRET
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

## Local Development

```bash
npm install
npm run dev          # starts Next.js dev server with Turbopack
```

The dev server runs at `http://localhost:3000`. Hot-reload is enabled.

## Production Build

```bash
npm run build        # compiles + type-checks
npm run start        # serves the built app
```

Windows batch helper (build + start in one command):

```bat
.\build-and-live-test.bat
```

## Vercel Deployment

1. Push the repository to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Add all environment variables in the Vercel project settings.
4. Deploy.

### Cron Jobs (Vercel)

`vercel.json` defines a cron job that fires `POST /api/workflows/runner` every 5 minutes:

```json
{
  "crons": [{ "path": "/api/workflows/runner", "schedule": "*/5 * * * *" }]
}
```

Vercel automatically sends a `Vercel-Cron-Job-Token` header — or you can configure `CRON_SECRET` yourself and verify it in the runner route.

## Data Persistence on Vercel

> **Important:** Vercel's serverless functions have an ephemeral filesystem. Files written to `data/` during a request will **not** persist across deployments or function instances.

For production use, replace the JSON file stores with a persistent data layer:
- [Vercel KV](https://vercel.com/docs/storage/vercel-kv) (Redis-compatible)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- Any external database or key-value store

The store modules are isolated in `lib/workflow-store.ts`, `lib/message-history.ts`, and `lib/preset-store.ts` — swap the read/write functions to use your chosen backend.

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

## Security Checklist

- [ ] `SESSION_SECRET` is at least 32 characters of random entropy
- [ ] `ACCESS_CODE` is strong and not reused elsewhere
- [ ] `CRON_SECRET` is set and rotated periodically
- [ ] HTTPS is enforced in production (Vercel does this automatically)
- [ ] The `data/` directory is excluded from version control (`.gitignore`)
- [ ] Environment variables are never committed to the repository
