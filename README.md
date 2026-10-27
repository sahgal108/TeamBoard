# TeamBoard

Multi-tenant project and team management: **companies** contain **teams**, teams contain **projects**, projects contain **tasks**. Hierarchical role-based and resource-level authorization is enforced in the query layer on every request, with Redis cache-aside, an append-only activity log written in the same transaction as each change, and real-time project boards over Socket.IO.

> The interesting problem is not task management. It is that every mutation flows through one pipeline that resolves the resource *inside the caller's tenant*, checks role and membership, mutates and logs atomically, invalidates cache and fans out an event.

## Stack

Next.js 16 (App Router, `proxy.ts`) · React 19 · TypeScript · Tailwind v4 · Ant Design 6 · Sequelize 6 + PostgreSQL · Redis (ioredis) · Socket.IO · Zod · jose

## Architecture

```
Browser ──HTTP──▶ Next.js route handlers ──▶ services ──▶ Sequelize ──▶ PostgreSQL
   │                    │                       │  └──▶ Redis (cache-aside, exact-key DEL)
   │                    │                       └─────▶ Redis PUBLISH project:{id}
   └──WebSocket──▶ realtime/server.ts (Socket.IO) ◀── Redis PSUBSCRIBE project:*
                        └── verifies the same JWT, re-checks project access before joining a room
```

### The request pipeline (every route handler)

| Step | Where | Failure |
| --- | --- | --- |
| 1. Session → user → **prove `CompanyMember`** for the active company | `lib/auth/get-company-context.ts` | 401 / 403 |
| 2. Zod-parse body and query | `validations/*` | 400 `VALIDATION` |
| 3. Load the resource **with `companyId` inside the query** | `lib/authorization/*-access.ts` | 404 |
| 4. Gather facts: PM? team member? project member? assignee? | same | — |
| 5. `can(ctx, action, facts)` — pure function, 19 actions | `lib/auth/permissions.ts` | 403 (or 404 if the resource is not visible at all) |
| 6. Service: `sequelize.transaction(t => mutation + recordActivity(t))` → `invalidate(keys)` → `publishProjectEvent` | `services/*` | — |

**Cross-tenant and out-of-scope resources are 404, never 403.** A project the caller cannot see looks exactly like one that does not exist, whether it belongs to another company or sits outside their scope in this one.

### Roles

| Role | Sees | Can |
| --- | --- | --- |
| CEO, Tech Lead | everything in the company | everything, including creating teams/projects and assigning PMs |
| Project Manager | projects they manage or are on | manage those projects, their members and tasks |
| Team Lead | their team's projects | manage the team's members, and tasks in the team's projects |
| Member | projects they are on or share a team with | move and edit tasks assigned to them, comment |
| Viewer | same visibility as Member | nothing; read only |

Denormalized `companyId` on `Task` and `Comment` keeps every tenant check a single-table predicate. `Activity` carries `projectId`/`teamId` so scoped users get a scoped feed without joining through `entityId`.

## Local setup

Requirements: Node 22.12+ (`.nvmrc`), PostgreSQL and Redis on localhost.

```bash
cp .env.example .env          # set JWT_SECRET (64 hex chars)
npm install
npm run db:migrate             # sequelize-cli; or npm run db:reset (drop + migrate + seed)
npm run db:seed                # Acme Technologies + Globex Corp demo data
npm run dev                    # http://localhost:3000
npm run dev:realtime           # Socket.IO relay on :4000, separate terminal
```

Postgres and Redis can come from `docker compose up -d`, or natively: `sudo bash scripts/setup-postgres-wsl.sh` installs and configures both on WSL Ubuntu (this project was built against PostgreSQL 14 and Redis 6 that way).

`GET /api/health` reports Postgres and Redis connectivity.

### Demo accounts

All use the password `Password123!`.

| Email | Role | Scope |
| --- | --- | --- |
| ceo@acme.test | CEO | everything in Acme |
| cto@acme.test | Tech Lead | everything in Acme |
| pm@acme.test | Project Manager | Payment Service |
| lead@acme.test | Team Lead | Engineering (Payment Service, User Platform) |
| dev1@acme.test | Member | Payment Service tasks assigned to them |
| dev2@acme.test | Member | User Platform |
| viewer@acme.test | Viewer | Payment Service, read only |
| ceo@globex.test | CEO of **Globex Corp** | a different tenant entirely |

## Demo script

1. **CEO** signs in: dashboard shows 3 teams, 3 projects, 18 tasks, company-wide activity.
2. **PM (Neha)** signs in: only Payment Service is listed. Opening User Platform's URL renders the 404 page.
3. **Developer (Amit)** opens the Payment Service board and drags his task from In progress to In review. Dragging it straight to Done is refused by the state machine. Assign and delete controls are hidden, and a hand-crafted `PATCH /api/tasks/:id/assignee` returns 403.
4. **Viewer** sees the board without drag handles; `PATCH /status` returns 403.
5. **Tenant isolation:** as Acme's CEO, `GET /api/projects/<globex-project-id>` returns 404.
6. **Real-time:** two windows (Amit and Neha) on the same board. Amit moves a card; Neha's board updates without a refresh. Path: DB transaction → Activity row → `PUBLISH project:{id}` → Socket.IO room.
7. **Cache:** call `/api/dashboard` twice and watch the `x-cache` header go `MISS` → `HIT`; change a task; next call is `MISS`.
8. **AI summary** (needs `GEMINI_API_KEY`): open a project's Summary tab for done / in progress / looks blocked. The lists come from SQL; the model only writes the wording, so it cannot invent or leak a task. As the PM, the Engineering team page has no team summary, because she cannot see all of that team's projects.
9. **Task breakdown** (needs `GEMINI_API_KEY`): as the PM, open PAY-8 and click **Break down with AI**. Edit or untick the suggestions, then create them; they get the next project numbers and link back to PAY-8. As a Member the buttons are absent and `POST /api/tasks/:id/breakdown` returns 403.

## Cache benchmark

`node scripts/bench-dashboard.mjs http://localhost:3000 40`, local PostgreSQL 14 and Redis 6 in WSL, Next dev server:

| `GET /api/dashboard` | p50 | p95 |
| --- | --- | --- |
| cold (Redis MISS → 8 Postgres counts) | 24.0 ms | 34.0 ms |
| warm (Redis HIT) | 18.0 ms | 24.8 ms |

The gain is deliberately modest: only the company-wide counts are cached because they are identical for every leader. The role-specific project list and activity feed stay uncached so a cache can never show one user another user's scope. Against a remote database (Neon, Supabase) the same eight round trips cost far more, and the saving grows accordingly.

## Deployment

Full project documentation: [docs/PROJECT.md](docs/PROJECT.md). Hosting: [docs/deploy.md](docs/deploy.md): Vercel for the Next.js app, a managed Postgres and Redis, and the Socket.IO relay as a small always-on service (it cannot run on serverless).

## Out of scope, by design

Sprints, time tracking, file storage, chat, calendar or email integrations, Elasticsearch, Kafka, microservices. Each would be a straightforward extension of the same pipeline.
