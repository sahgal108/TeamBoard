# Deploying TeamBoard

Three deployables, all free-tier friendly.

| Component | Where | Why |
| --- | --- | --- |
| Next.js app (`/`) | Vercel | route handlers + server components |
| PostgreSQL | Neon or Supabase | managed, free tier, connection pooling |
| Redis | Upstash | managed, free tier, TLS `rediss://` URL |
| `realtime/server.ts` | Railway, Fly.io or Render | long-lived WebSockets cannot run on Vercel's serverless functions |

## 1. Database

1. Create a Postgres project. Copy the **pooled** connection string as `DATABASE_URL` and, if the provider offers one, the direct string for migrations.
2. Run migrations and seed from your machine against production once:

   ```bash
   DATABASE_URL="postgresql://…" npx sequelize-cli db:migrate
   DATABASE_URL="postgresql://…" npm run db:seed
   ```

   Both the app and `sequelize-cli` (via `db/config.cjs`) read `DATABASE_URL`; nothing else to configure.

## 2. Redis

Create an Upstash database and copy the `rediss://…` URL as `REDIS_URL`. ioredis handles TLS from the scheme. Upstash free tier allows pub/sub, which the realtime relay needs.

## 3. Realtime relay

Deploy the repository to Railway (or Fly/Render) as a Node service:

- Build: `npm ci`
- Start: `npx tsx realtime/server.ts`
- Env: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` (must equal the app's), `NEXT_PUBLIC_APP_URL` (the Vercel URL, used as the CORS origin), `REALTIME_PORT` (the platform's `PORT`).

Note the public URL, e.g. `https://teamboard-realtime.up.railway.app`.

## 4. Next.js on Vercel

Import the repository. Framework preset: Next.js. Set environment variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | pooled Postgres URL |
| `REDIS_URL` | Upstash URL |
| `JWT_SECRET` | 64 hex chars; same value as the relay |
| `NEXT_PUBLIC_APP_URL` | `https://<your-app>.vercel.app` |
| `NEXT_PUBLIC_REALTIME_URL` | the relay URL from step 3 |
| `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS` | `true` for the portfolio demo, `false` otherwise |

No code-generation step is needed before `next build`.

## 5. Smoke test

```bash
curl https://<your-app>.vercel.app/api/health
curl https://<relay>/health
```

Both should report `ok: true`. Then run the demo script from the README.

## Operational notes

- **Cookies** are `Secure` in production (`NODE_ENV=production`), so the app must be served over HTTPS. Vercel does this by default.
- **JWT revocation.** Sessions are stateless; membership is re-verified on every request, so removing a user from a company locks them out immediately. Rotating `JWT_SECRET` signs everyone out.
- **Redis down** degrades to slower responses (every read has a DB fallback) and pauses real-time updates. Nothing errors.
- **Scaling the relay** horizontally works without changes: every instance subscribes to `project:*` on the same Redis, so each delivers to its own sockets.
