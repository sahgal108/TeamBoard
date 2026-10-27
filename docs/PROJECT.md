# TeamBoard — Project Documentation

TeamBoard is a multi-tenant project and team management application. A **company** (tenant) owns **teams**, teams own **projects**, and projects own **tasks**. Every user can belong to several companies with a different role in each, and everything they see or change is decided by that role plus their concrete relationship to the resource (project manager, team member, project member, assignee).

This document describes the product, the architecture, the data model, the security model, the API, the UI and the operational side of the project. For a quick start, see the [README](../README.md); for hosting, see [deploy.md](deploy.md).

---

## Table of contents

1. [Product overview](#1-product-overview)
2. [Tech stack](#2-tech-stack)
3. [Repository layout](#3-repository-layout)
4. [Architecture](#4-architecture)
5. [Data model](#5-data-model)
6. [Authentication and sessions](#6-authentication-and-sessions)
7. [Authorization](#7-authorization)
8. [Task workflow](#8-task-workflow)
9. [Activity log](#9-activity-log)
10. [Caching](#10-caching)
11. [Real-time updates](#11-real-time-updates)
12. [API reference](#12-api-reference)
13. [Validation and errors](#13-validation-and-errors)
14. [User interface](#14-user-interface)
15. [Design system](#15-design-system)
16. [Local development](#16-local-development)
17. [Database migrations and seed data](#17-database-migrations-and-seed-data)
18. [Configuration](#18-configuration)
19. [Deployment](#19-deployment)
20. [Conventions](#20-conventions)
21. [AI summaries](#21-ai-summaries)
22. [Scope and future work](#22-scope-and-future-work)

---

## 1. Product overview

### Hierarchy

```
Company (tenant)
 ├── Members (User + role in this company)
 └── Teams
      ├── Team members
      └── Projects  (key e.g. PAY, project manager, status)
           ├── Project members
           └── Tasks  (PAY-12, status, priority, assignee, due date)
                └── Comments
```

### Core capabilities

| Area | What users can do |
| --- | --- |
| Companies | Belong to several companies and switch between them from the sidebar |
| Teams | Create, rename, describe and delete teams; add and remove members |
| Projects | Create projects under a team with a short key (`PAY`), assign a project manager, set status (Planned, Active, Completed, Archived), manage project members |
| Tasks | Create tasks with human-readable keys (`PAY-12`), set priority and due date, assign, move across a Kanban board, edit, delete |
| Comments | Discuss a task in a threaded list on the task page |
| Activity | Company-wide or scoped audit feed of every change, with infinite "load more" |
| Dashboard | Role-aware counts, my open tasks, visible projects and recent activity |
| Search | One box (`Ctrl/⌘ K`) across projects, tasks and teams the user can see |
| Real-time | Boards update live in every open window when someone else changes a task |

### Roles

| Role | Visibility | Abilities |
| --- | --- | --- |
| **CEO** | Whole company | Everything |
| **Tech Lead** | Whole company | Everything |
| **Project Manager** | Projects they manage or are a member of | Manage those projects, their members and tasks; delete tasks in projects they manage |
| **Team Lead** | Projects of teams they belong to | Manage their team's members, and projects/tasks of their team |
| **Member** | Projects they are on, or that belong to a team they are in | Edit and move tasks assigned to them; comment |
| **Viewer** | Same as Member | Read only |

---

## 2. Tech stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | **Next.js 16** (App Router, Turbopack) | Server components for pages, route handlers for the API, `proxy.ts` for edge redirects |
| UI | **React 19**, **Ant Design 6**, `@ant-design/icons` | antd for every component; `@ant-design/nextjs-registry` for SSR styles |
| Styling | **Tailwind CSS v4** | Layout utilities only; all values come from the design tokens |
| Drag and drop | `@dnd-kit/core`, `@dnd-kit/sortable` | Kanban board |
| Database | **PostgreSQL 14+** | Single schema, tenant column on every tenant-owned table |
| ORM | **Sequelize 6** + `pg` | Typed models, `sequelize-cli` migrations |
| Cache / pub-sub | **Redis 6+** via `ioredis` | Cache-aside and real-time fan-out |
| Real-time | **Socket.IO 4** | Separate Node process |
| Validation | **Zod 4** | Every request body and query string |
| Auth | **jose** (HS256 JWT), **bcryptjs** | Stateless session in an HTTP-only cookie |
| IDs | `@paralleldrive/cuid2` | Collision-resistant string ids |
| Dates | `dayjs` | Formatting and antd date pickers |
| Language | TypeScript 5 | `npm run typecheck` |

Node **22.12+** is required (see `.nvmrc`).

---

## 3. Repository layout

```
app/
  (auth)/login/              Sign-in page
  (dashboard)/               Signed-in pages (shared layout with sidebar + top bar)
    dashboard/ teams/ projects/ tasks/ activity/ search/ settings/
  api/                       Route handlers (JSON API)
  layout.tsx                 Root layout: fonts, design tokens, antd provider
  globals.css                Tailwind theme mapped to design tokens
components/
  activity/ auth/ layout/ projects/ search/ tables/ tasks/ teams/ ui/ providers/
db/
  config.cjs                 sequelize-cli config (reads DATABASE_URL)
  migrations/                Migration files (run the SQL in db/sql/)
  sql/                       Raw schema SQL per migration
  seed.ts                    Demo data
hooks/
  use-project-realtime.ts    Socket.IO subscription for a board
lib/
  auth/                      JWT, cookies, password hashing, current user, company context, permissions
  authorization/             Tenant-scoped loaders and visibility rules
  db/                        Sequelize instance, models, enums, helpers
  redis/                     Client, cache helpers, key registry
  realtime/                  Event publisher
  design-system.ts           Design tokens (single source of truth)
  antd-theme.ts              antd theme built from the tokens
  errors.ts                  Error classes and the JSON error envelope
  with-auth.ts               Route handler wrappers
  task-transitions.ts        Task status state machine
realtime/server.ts           Standalone Socket.IO relay
services/                    Business logic, one file per domain
validations/                 Zod schemas
scripts/                     DB reset, benchmark, WSL setup
proxy.ts                     Cookie-based redirects
```

---

## 4. Architecture

```
Browser ──HTTP──▶ Next.js route handlers ──▶ services ──▶ Sequelize ──▶ PostgreSQL
   │                    │                       │  └──▶ Redis (cache-aside, exact-key DEL)
   │                    │                       └─────▶ Redis PUBLISH project:{id}
   └──WebSocket──▶ realtime/server.ts (Socket.IO) ◀── Redis PSUBSCRIBE project:*
```

### Request pipeline

Every tenant route handler follows the same six steps:

| # | Step | Where | Failure |
| --- | --- | --- | --- |
| 1 | Verify the session, load the user, prove a `CompanyMember` row exists for the active company | `lib/auth/get-company-context.ts` via `withAuth()` | 401 / 403 |
| 2 | Parse body and query with Zod | `validations/*` | 400 `VALIDATION` |
| 3 | Load the resource **with `companyId` in the WHERE clause** | `lib/authorization/*-access.ts` | 404 |
| 4 | Gather facts: project manager? team member? project member? assignee? | same | — |
| 5 | `can(ctx, action, facts)` | `lib/auth/permissions.ts` | 403 (404 if the resource is not visible at all) |
| 6 | `sequelize.transaction(t => mutation + recordActivity(t))` → `invalidate(keys)` → `publishProjectEvent()` | `services/*` | — |

Pages use the same loaders and services through `lib/page-guard.ts`, so a page and its API endpoint can never disagree about access.

### Layers

- **Route handlers** (`app/api`) are thin: parse, load, check, call a service, return JSON.
- **Services** (`services/*.service.ts`) own business rules and transactions. They never read the request.
- **Authorization** (`lib/authorization`) owns tenant-scoped loading and the SQL visibility predicates.
- **Policy** (`lib/auth/permissions.ts`) is a pure function with no I/O.
- **Models** (`lib/db/models.ts`) map onto the PostgreSQL tables.

---

## 5. Data model

All ids are cuid2 strings. Tables use PascalCase names and camelCase columns. Timestamps are stored as UTC.

### Tables

| Table | Key columns | Notes |
| --- | --- | --- |
| `Company` | `name`, `slug` (unique) | The tenant |
| `User` | `name`, `email` (unique), `passwordHash` | Global; not owned by a company |
| `CompanyMember` | `companyId`, `userId`, `role` | Unique `(companyId, userId)`; the role lives here |
| `Team` | `companyId`, `name`, `description` | Unique `(companyId, name)` |
| `TeamMember` | `teamId`, `userId` | Unique `(teamId, userId)` |
| `Project` | `companyId`, `teamId`, `name`, `key`, `status`, `projectManagerId`, `taskCounter` | Unique `(companyId, key)` |
| `ProjectMember` | `projectId`, `userId` | Unique `(projectId, userId)` |
| `Task` | `companyId`, `projectId`, `number`, `title`, `description`, `status`, `priority`, `assigneeId`, `createdById`, `dueDate` | Unique `(projectId, number)` |
| `Comment` | `companyId`, `taskId`, `userId`, `content` | |
| `Activity` | `companyId`, `userId`, `entityType`, `entityId`, `action`, `metadata` (JSONB), `projectId`, `teamId` | Append-only |

### Enums

| Enum | Values |
| --- | --- |
| `CompanyRole` | `CEO`, `TECH_LEAD`, `PROJECT_MANAGER`, `TEAM_LEAD`, `MEMBER`, `VIEWER` |
| `ProjectStatus` | `PLANNED`, `ACTIVE`, `COMPLETED`, `ARCHIVED` |
| `TaskStatus` | `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE` |
| `TaskPriority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` |

### Design decisions

- **Denormalized `companyId`** on `Task`, `Comment` and `Activity` keeps every tenant check a single-table predicate instead of a join chain.
- **Task keys** (`PAY-12`) come from `Project.taskCounter`, incremented with `UPDATE … RETURNING` inside the task-creation transaction, so concurrent creates never collide.
- **`Activity.projectId` / `teamId`** let scoped users read a filtered feed without joining through `entityId`.
- **Deletes cascade** from company → team → project → task → comment. Deleting a user who is a project manager or assignee sets that column to `NULL`.

### Indexes worth knowing

- `Task (projectId, status)` — board columns.
- `Task (assigneeId)` — "my tasks".
- `Activity (companyId, createdAt DESC)` and `Activity (companyId, projectId, createdAt DESC)` — feeds.

---

## 6. Authentication and sessions

- **Sign in:** `POST /api/auth/login` checks the bcrypt hash and issues an HS256 JWT signed with `JWT_SECRET`.
- **Cookie:** `ws_session`, `HttpOnly`, `SameSite=Lax`, `Secure` in production, 7-day lifetime.
- **Claims:** `sub` (user id) and `activeCompanyId`. The active company is only a hint; membership is re-checked against `CompanyMember` on every request.
- **Switch company:** `POST /api/auth/switch-company` verifies membership and re-issues the cookie.
- **Sign out:** `POST /api/auth/logout` clears the cookie.
- **Expired or orphaned session:** pages redirect to `GET /api/auth/expired`, which clears the cookie and sends the user to `/login?reason=expired` (or `no-company`). This prevents a redirect loop between `/login` and `/dashboard` when the cookie exists but is no longer valid.
- **Edge redirects:** `proxy.ts` only checks whether the cookie exists, to route `/` and protected paths. It never touches the database; real checks happen per request.

---

## 7. Authorization

### Tenant isolation

Every loader in `lib/authorization` queries with `companyId = ctx.company.id`. A resource in another company is therefore indistinguishable from one that does not exist: **cross-tenant and out-of-scope resources return 404, never 403.**

### Visibility rules (SQL)

`lib/authorization/visibility.ts` builds the predicates used for every list, count and search:

- **Full-access roles** (CEO, Tech Lead): `companyId = :company`.
- **Everyone else:** projects where the user is the project manager, **or** an explicit project member, **or** a member of the project's team. Tasks, comments and activity inherit visibility from their project.

The rules are expressed as escaped SQL subqueries, so visibility is enforced in the database query itself rather than by filtering in memory.

### Policy

`can(ctx, action, facts)` is a pure function over the caller's role and four facts:

| Fact | Meaning |
| --- | --- |
| `isTeamMember` | Caller belongs to the team (for a project: its team) |
| `isProjectMember` | Caller is an explicit project member |
| `isProjectManager` | Caller is the project's manager |
| `isAssignee` | Caller is the task's assignee |

| Action | Allowed for |
| --- | --- |
| `team:read` | Every company member |
| `team:create`, `team:delete` | CEO, Tech Lead |
| `team:update`, `team:manage_members` | CEO, Tech Lead, Team Lead of that team |
| `project:read`, `task:read` | Full access, or anyone who can see the project |
| `project:create`, `project:assign_pm`, `project:delete` | CEO, Tech Lead |
| `project:update`, `project:manage_members`, `task:create`, `task:assign` | Full access, the project's manager, a Team Lead on the project's team |
| `task:update_status`, `task:edit` | The above plus the task's assignee; never a Viewer |
| `task:delete` | Full access, the project's manager |
| `comment:create` | Anyone who can see the project, except Viewers |
| `activity:read_company` | CEO, Tech Lead |
| `ai:summarize` | Project summary: anyone who can see the project. Team summary: full access or members of that team. Company digest: CEO, Tech Lead |

The UI asks the same function which controls to show, so hidden buttons and server checks always agree. Crafting a request by hand still hits the server-side check.

---

## 8. Task workflow

Status changes follow a small state machine (`lib/task-transitions.ts`), shared by the service and the board:

```
TODO ──▶ IN_PROGRESS ──▶ IN_REVIEW ──▶ DONE
              ▲               │          │
              └─── sent back ─┘          │
                              ▲ reopened ┘
```

| From | Allowed to |
| --- | --- |
| `TODO` | `IN_PROGRESS` |
| `IN_PROGRESS` | `IN_REVIEW` |
| `IN_REVIEW` | `DONE`, `IN_PROGRESS` |
| `DONE` | `IN_REVIEW` |

The service rejects anything else with `400 INVALID_TRANSITION`. The board uses the same table to refuse an impossible drop before sending a request, and explains why.

---

## 9. Activity log

- Each mutation writes an `Activity` row **in the same transaction** as the change, so the log can never disagree with the data.
- `metadata` holds the details (old and new status, assignee, renamed fields).
- `lib/activity-text.ts` turns rows into sentences such as "Amit moved PAY-12 to In review".
- Feeds are keyset-paginated on `(createdAt, id)` with an opaque cursor, newest first, 20 per page (max 100).
- Full-access roles read the whole company; everyone else reads activity for projects and teams they can see, plus their own actions.

---

## 10. Caching

Redis is used as a **cache-aside** layer (`lib/redis/cache.ts`).

| Key | TTL | Contents |
| --- | --- | --- |
| `dashboard:{companyId}` | 60 s | Company-wide counts for full-access roles |
| `project:{projectId}:summary` | 120 s | Project header and stats |
| `ai:summary:{scope}:{id}:{period}` | 30 min / 6 h | AI summary, shared by everyone allowed to read it |
| `company:{companyId}` | 600 s | Company record |
| `member:{companyId}:{userId}` | 60 s | Membership lookup |

Rules:

- All keys are spelled out in one file, `lib/redis/keys.ts`, so a write can never miss an invalidation through a typo.
- Invalidation deletes **exact keys** after the transaction commits. `KEYS`/`SCAN` patterns are never used.
- Only data that is identical for everyone allowed to see it is cached. Role-scoped lists stay uncached, so a cache can never leak one user's scope to another.
- If Redis is down, reads fall through to PostgreSQL and the app gets slower, not broken.
- `GET /api/dashboard` and `GET /api/projects/:id` return an `x-cache: HIT|MISS` header.

---

## 11. Real-time updates

```
Service commits ─▶ PUBLISH project:{id} ─▶ realtime/server.ts ─▶ Socket.IO room project:{id} ─▶ browsers
```

1. **Token:** the board calls `GET /api/realtime/token`, which returns a JWT valid for 10 minutes.
2. **Connect:** the Socket.IO server verifies the token with the same secret. No valid token, no socket.
3. **Join:** the client emits `join` with a project id. The server loads the project tenant-scoped, gathers the same facts as the API and asks `can("project:read")`. It replies `joined` or `join:denied`.
4. **Relay:** the server pattern-subscribes to `project:*` and forwards each message to the matching room.

Events: `TASK_CREATED`, `TASK_UPDATED`, `TASK_STATUS_CHANGED`, `TASK_ASSIGNED`, `TASK_DELETED`, `COMMENT_ADDED`, `PROJECT_UPDATED`.

Publishing is fire-and-forget: a failed publish never fails a mutation that already committed. The relay exposes `GET /health` with client count and Redis status.

---

## 12. API reference

All endpoints return JSON. Successful responses use `{ data: … }`; errors use the envelope in [section 13](#13-validation-and-errors). Every endpoint except `auth/*` and `health` requires a session.

### Auth and account

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/login` | Sign in `{ email, password }` |
| POST | `/api/auth/logout` | Sign out |
| POST | `/api/auth/switch-company` | Change active company `{ companyId }` |
| GET | `/api/auth/expired` | Clear a stale cookie and redirect to sign-in |
| GET | `/api/me` | Current user, active company, role and memberships |
| GET | `/api/users` | People in the active company (for pickers) |
| GET | `/api/realtime/token` | Short-lived socket token |

### Teams

| Method | Path | Purpose | Permission |
| --- | --- | --- | --- |
| GET | `/api/teams` | List teams | `team:read` |
| POST | `/api/teams` | Create `{ name, description? }` | `team:create` |
| GET | `/api/teams/:id` | Team with members and visible projects | `team:read` |
| PATCH | `/api/teams/:id` | Update name/description | `team:update` |
| DELETE | `/api/teams/:id` | Delete team and its projects | `team:delete` |
| POST | `/api/teams/:id/members` | Add `{ userId }` | `team:manage_members` |
| DELETE | `/api/teams/:id/members/:userId` | Remove member | `team:manage_members` |

### Projects

| Method | Path | Purpose | Permission |
| --- | --- | --- | --- |
| GET | `/api/projects?teamId&status` | List visible projects | visibility |
| POST | `/api/projects` | Create `{ name, key, teamId, description?, projectManagerId?, status? }` | `project:create` |
| GET | `/api/projects/:id` | Summary plus the caller's permissions | `project:read` |
| PATCH | `/api/projects/:id` | Update name, description, status, manager | `project:update` / `project:assign_pm` |
| DELETE | `/api/projects/:id` | Delete project and tasks | `project:delete` |
| POST | `/api/projects/:id/members` | Add `{ userId }` | `project:manage_members` |
| DELETE | `/api/projects/:id/members/:userId` | Remove member | `project:manage_members` |

### Tasks and comments

| Method | Path | Purpose | Permission |
| --- | --- | --- | --- |
| GET | `/api/tasks?projectId&status&assigneeId&mine=1` | List visible tasks | visibility |
| POST | `/api/tasks` | Create `{ projectId, title, description?, priority?, assigneeId?, dueDate? }` | `task:create` |
| GET | `/api/tasks/:id` | Task detail | `task:read` |
| PATCH | `/api/tasks/:id` | Edit title, description, priority, due date | `task:edit` |
| DELETE | `/api/tasks/:id` | Delete | `task:delete` |
| PATCH | `/api/tasks/:id/status` | Move `{ status }` (state machine enforced) | `task:update_status` |
| PATCH | `/api/tasks/:id/assignee` | Assign `{ assigneeId \| null }` | `task:assign` |
| GET | `/api/tasks/:id/comments` | List comments | `task:read` |
| POST | `/api/tasks/:id/comments` | Add `{ content }` | `comment:create` |

### Other

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/dashboard` | Role-aware stats, my tasks, projects, recent activity |
| GET | `/api/activity?limit&cursor&projectId&teamId` | Paginated activity feed |
| GET | `/api/search?q=` | Projects (name or exact key), tasks (title or `KEY-n`), teams |
| GET | `/api/projects/:id/summary?period&refresh` | AI summary of a project ([21](#21-ai-summaries)) |
| GET | `/api/teams/:id/summary?period&refresh` | AI summary of a team |
| GET | `/api/summary?period&refresh` | AI company digest (leadership) |
| GET | `/api/health` | PostgreSQL and Redis connectivity |

---

## 13. Validation and errors

### Input limits

| Field | Rule |
| --- | --- |
| Email | Valid email, max 254, trimmed and lower-cased |
| Password | 8–200 characters |
| Team name / description | 2–60 / max 300 |
| Project name / description | 2–80 / max 1000 |
| Project key | 2–6 characters, `A–Z` and `0–9`, starting with a letter; upper-cased |
| Task title / description | 1–140 / max 4000 |
| Comment | 1–2000 |
| Due date | ISO date or datetime; `null` clears it |
| Search term | 1–100 |
| Page size | 1–100, default 20 |

PATCH bodies are partial but must contain at least one field.

### Error envelope

```json
{ "error": { "code": "VALIDATION", "message": "Invalid request", "details": { } } }
```

| Code | HTTP | When |
| --- | --- | --- |
| `UNAUTHORIZED` | 401 | No or invalid session |
| `FORBIDDEN` | 403 | Visible resource, action not allowed |
| `NOT_FOUND` | 404 | Missing, in another tenant, or out of scope |
| `VALIDATION` | 400 | Zod failure or unique-constraint conflict (duplicate team name, project key) |
| `INVALID_TRANSITION` | 400 | Disallowed task status move |
| `RATE_LIMITED` | 429 | AI request limit or company token budget reached; `details.retryAfterSeconds` |
| `AI_DISABLED` | 503 | No `GEMINI_API_KEY` configured |
| `AI_UNAVAILABLE` | 503 | Every model failed or timed out, or AI limits cannot be checked because Redis is down |
| `INTERNAL` | 500 | Anything unexpected (logged server-side) |

---

## 14. User interface

### Layout

A fixed dark sidebar (company switcher, navigation, user and sign-out) and a top bar with the search box. Content pages share a `PageHeader` with title, subtitle and actions.

### Navigation

| Item | Page |
| --- | --- |
| Dashboard | Stats, my open tasks, projects, recent activity |
| Teams | Table of teams → team detail with members panel and projects |
| Projects | Table of visible projects → project detail with **Board** and **Activity** tabs |
| Tasks / My tasks | Filterable task table (status, project, assignee); scoped roles see "My tasks" |
| Activity | Full feed with load more |
| Settings | Account, companies, and a matrix of what the current role allows |

### Key screens

- **Sign-in:** split layout with a product panel and the form; when demo accounts are enabled, each one fills the form in a click.
- **Kanban board:** four columns, drag and drop between allowed states, cards show key, title, priority, assignee and due date (overdue in red, due soon in amber). Updates live from other users.
- **Task detail:** details panel, edit dialog (when allowed), assignee and status controls, comment thread and a timeline of the task's activity.
- **Dialogs:** create team, project and task in antd modals with inline validation and server error display.
- **Empty, loading and error states:** skeletons while loading, empty states with guidance, a shared error boundary and a 404 page.

---

## 15. Design system

`lib/design-system.ts` is the **single source of truth** for every visual value. Nothing in a component may use a raw colour, font size, spacing value, radius or shadow.

| Group | Contents |
| --- | --- |
| `color` | Brand (`#0b7a5c`), neutrals, sidebar, feedback, task status, priority, avatar palette |
| `font` | Families (display, sans, mono), sizes 11–40 px, weights, line heights, letter spacing |
| `textStyle` | Presets: `caption`, `sectionLabel`, `columnLabel` |
| `space` | 4 px grid |
| `radius` | `sm` 4, `md` 8, `lg` 12, `full` |
| `shadow` | `card`, `raised` |
| `avatarSize` | `xs` 20, `sm` 24, `md` 28, `lg` 44 |
| `layout` | Sidebar width, header height, page padding, content widths, column widths |
| `zIndex` | Layering |

How it is wired:

1. **Ant Design** — `lib/antd-theme.ts` builds the antd theme (tokens and component overrides) from these values.
2. **Tailwind** — the root layout renders `cssVariables()` as `--ds-*` CSS variables; `app/globals.css` clears Tailwind's default scales and maps its theme onto those variables. Classes like `text-sm`, `p-4`, `rounded-md`, `bg-surface` therefore resolve to tokens.
3. **Inline styles** — components import tokens directly (`space[3]`, `color.neutral.border`).

To change the look of the app, change a value in `lib/design-system.ts`.

---

## 16. Local development

### Requirements

- Node 22.12+
- PostgreSQL 14+ and Redis 6+ on localhost (Docker, native, or WSL)

### Steps

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

In a second terminal, for live board updates:

```bash
npm run dev:realtime
```

Open http://localhost:3000.

### Services

- **Docker:** `docker compose up -d` starts PostgreSQL and Redis.
- **WSL Ubuntu:** `sudo bash scripts/setup-postgres-wsl.sh` installs and configures both. WSL stops when idle, so keep a WSL terminal open while developing, or the app will fail to reach the database.

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server on :3000 |
| `npm run dev:realtime` | Socket.IO relay on :4000 with reload |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:migrate:undo` | Revert the last migration |
| `npm run db:seed` | Load demo data (truncates first) |
| `npm run db:reset` | Drop, migrate and seed |
| `node scripts/bench-dashboard.mjs <url> <n>` | Dashboard cache benchmark |

### Demo accounts

Password for all: `Password123!`

| Email | Role | Scope |
| --- | --- | --- |
| ceo@acme.test | CEO | All of Acme |
| cto@acme.test | Tech Lead | All of Acme |
| pm@acme.test | Project Manager | Payment Service |
| lead@acme.test | Team Lead | Engineering |
| dev1@acme.test | Member | Payment Service |
| dev2@acme.test | Member | User Platform |
| viewer@acme.test | Viewer | Payment Service, read only |
| ceo@globex.test | CEO | Globex Corp (separate tenant) |

---

## 17. Database migrations and seed data

- Migrations live in `db/migrations/*.cjs` and execute the SQL files in `db/sql/`. `.sequelizerc` points `sequelize-cli` at the `db` folder, and `db/config.cjs` reads `DATABASE_URL`.
- Applied migrations are tracked in the `SequelizeMeta` table.
- To add a change: write `db/sql/<timestamp>-<name>.sql`, add a matching migration file that runs it (with a `down` that reverses it), update `lib/db/models.ts`, then run `npm run db:migrate`.
- `db/seed.ts` creates two companies (Acme Technologies with 3 teams, 3 projects and 18 tasks; Globex Corp as a separate tenant), memberships, comments and activity.

---

## 18. Configuration

| Variable | Required | Example | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | `postgresql://user:pass@127.0.0.1:5432/db` | PostgreSQL connection |
| `REDIS_URL` | Yes | `redis://127.0.0.1:6379` | Cache and pub/sub |
| `JWT_SECRET` | Yes | 64 hex characters | Signs session and socket tokens (min 32 chars) |
| `NEXT_PUBLIC_APP_URL` | Yes | `http://localhost:3000` | App origin; allowed CORS origin for sockets |
| `NEXT_PUBLIC_REALTIME_URL` | Yes | `http://localhost:4000` | Where the browser connects for live updates |
| `REALTIME_PORT` | No | `4000` | Port for the Socket.IO relay |
| `GEMINI_API_KEY` | No | from Google AI Studio | Enables AI summaries; without it the AI UI is hidden |
| `AI_MODEL` | No | `gemini-flash-lite-latest` | First model tried |
| `AI_FALLBACK_MODELS` | No | `gemini-flash-latest` | Comma-separated; tried when a model is retired, rate limited or overloaded |
| `AI_USER_HOURLY_LIMIT` | No | `20` | Model calls per user per hour |
| `AI_DAILY_TOKEN_BUDGET` | No | `200000` | Tokens per company per UTC day |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 19. Deployment

Summary (details in [deploy.md](deploy.md)):

| Piece | Where |
| --- | --- |
| Next.js app | Vercel or any Node host |
| PostgreSQL | Managed (Neon, Supabase, RDS) |
| Redis | Managed (Upstash, Redis Cloud, ElastiCache) |
| Socket.IO relay | Small always-on service (Fly.io, Render, Railway, a VM). It cannot run on serverless |

Checklist:

1. Set all environment variables on both the app and the relay (same `JWT_SECRET`, same `REDIS_URL`).
2. Run `npm run db:migrate` against the production database.
3. Point `NEXT_PUBLIC_REALTIME_URL` at the relay and `NEXT_PUBLIC_APP_URL` at the app.
4. Check `GET /api/health` and the relay's `GET /health`.

---

## 20. Conventions

- **No raw design values** in components; use `lib/design-system.ts`.
- **Ant Design first** for UI; Tailwind for layout only. antd components exposed to server components go through `components/ui/antd.tsx`.
- **Thin route handlers**; business logic in services; access in `lib/authorization`; policy in `can()`.
- **Every tenant query includes `companyId`.**
- **Every mutation** writes activity in the same transaction, invalidates exact cache keys and publishes a project event.
- **New cache keys and channels** are added only in `lib/redis/keys.ts`.
- **Validation** with Zod at the edge of every handler.
- **Errors** thrown as `AppError` subclasses; never return ad-hoc error shapes.

---

## 21. AI summaries

A standup summary of what was done, what is in progress and what looks blocked, for a project (Summary tab), a team (team page) or the whole company (dashboard digest). Periods: last 24 hours or last 7 days.

**The data decides, the model only writes.** `services/summary.service.ts` builds the three lists in SQL:

| List | Source |
| --- | --- |
| Done | `TASK_STATUS_CHANGED` activity to `DONE` in the period, for tasks still done |
| In progress | Tasks in progress or in review, minus anything listed as blocked |
| Looks blocked | Not done and any of: overdue; in review with no change for 2+ days; urgent with no change for 3+ days; a comment in the period containing "blocked", "blocker", "waiting on/for" or "stuck" |

The model receives those lists and returns a headline plus one note per task key. Notes for keys that are not in the lists are dropped, so a summary can never show a task that does not exist or that the reader may not see. If nothing happened, no model is called.

**Who sees what.** A summary is cached once per scope and period and shared by every reader, which is safe only because `ai:summarize` admits people who can see *every* project in the scope. A PM outside a team sees only some of its projects, so they get no team summary.

**Pieces:**

- `lib/ai/provider.ts`: the `AIProvider` interface, `untrusted()` for wrapping user-written text as data, and the prompt rule that text inside it is never instructions.
- `lib/ai/gemini.ts`: Gemini over REST with a JSON schema generated from the zod schema; the reply is validated again with zod. Models are tried in order on 404/429/5xx/timeout.
- `lib/ai/usage.ts`: per-user hourly limit and per-company daily token budget in Redis. These fail closed: if Redis is down, AI pauses rather than running unmetered.
- Cache: `ai:summary:{scope}:{id}:{period}`, 30 minutes for a day and 6 hours for a week. Not cleared on task changes, since each regeneration costs tokens; Regenerate (`?refresh=1`) forces a new one.

**API:** `GET /api/projects/:id/summary`, `GET /api/teams/:id/summary`, `GET /api/summary` (company), each with `?period=day|week` and optional `refresh=1`.

---

## 22. Scope and future work

Deliberately out of scope: sprints, time tracking, file attachments, chat, calendar and email integrations, full-text search engines, message brokers, microservices.

Natural next steps, each a straightforward extension of the existing pipeline:

- Invitations and user management inside a company
- Notifications (in-app, then email) driven by the activity log
- Task labels, subtasks and ordering within a column
- Full-text search on PostgreSQL (`tsvector`)
- Rate limiting on sign-in
- Automated test suite and CI
