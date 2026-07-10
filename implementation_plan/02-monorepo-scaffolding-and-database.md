# Phase 02 — Monorepo Scaffolding and Database

**Status:** complete  
**Depends on:** Phase 01  
**Blocks:** Phase 03  
**Estimated duration:** 3–5 days

---

## Objectives

1. Scaffold a **pnpm monorepo** with Next.js web app, BullMQ worker, and shared packages.
2. Apply the full database schema from the data model spec (migrations, pgvector, RLS helpers).
3. Wire apps to Docker services from Phase 01 (Supabase, Redis).
4. Establish CI: lint, typecheck, migration validation.

---

## Prerequisites

- Phase 01 exit criteria met (Docker stack healthy).
- Node.js 20+ and pnpm 9+ installed.
- Supabase API reachable at `http://localhost:8000`.

---

## Canonical spec references

- [04-data-model.md](../docs/04-data-model.md) — full SQL schema
- [05-ai-and-rag.md](../docs/05-ai-and-rag.md) — `match_workspace_knowledge` RPC
- [adr/003-tiptap-editor.md](../docs/adr/003-tiptap-editor.md)
- [adr/004-embedding-model-768d.md](../docs/adr/004-embedding-model-768d.md)
- [18-non-functional-requirements.md](../docs/18-non-functional-requirements.md)

---

## Docker services touched

| Service | Usage |
|---------|-------|
| `supabase-db` | Run migrations |
| `supabase-kong` | API gateway for web/worker |
| `redis` | Worker queue connection test |

Web and worker run **on host** in dev (hot reload) via `pnpm dev`, connecting to Docker services. Optional: add `web` and `worker` services to `docker-compose.dev.yml` in later phases.

---

## Repository structure (created this phase)

```
rhodes-app/
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx
│   │       │   ├── page.tsx
│   │       │   └── api/health/route.ts
│   │       └── lib/
│   └── worker/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts              # BullMQ worker entry
│           └── queues/
├── packages/
│   ├── db/
│   │   ├── package.json
│   │   ├── migrations/
│   │   │   ├── 00001_extensions.sql
│   │   │   ├── 00002_core_tables.sql
│   │   │   ├── 00003_rls_policies.sql
│   │   │   ├── 00004_match_rpc.sql
│   │   │   └── 00005_seed_system_templates.sql
│   │   └── src/
│   │       ├── client.ts             # Supabase admin client (service role)
│   │       └── types.ts              # Generated DB types
│   ├── shared/
│   │   ├── package.json
│   │   └── src/
│   │       ├── schemas/              # Zod schemas
│   │       └── constants.ts
│   └── ai/
│       ├── package.json
│       └── src/
│           └── ollama.ts             # Stub client (full impl Phase 07)
├── supabase/
│   ├── config.toml
│   └── migrations/                   # Symlink or copy from packages/db/migrations
├── pnpm-workspace.yaml
├── package.json                      # Root scripts
├── turbo.json                        # Optional: turborepo
└── .github/workflows/ci.yml
```

---

## Step-by-step tasks

### 1. Initialize pnpm workspace

**`pnpm-workspace.yaml`:**
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Root `package.json` scripts:**
```json
{
  "scripts": {
    "dev": "pnpm --parallel -r dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "db:migrate": "node scripts/migrate.js",
    "db:seed": "node scripts/seed.js",
    "db:types": "supabase gen types typescript --local > packages/db/src/types.ts"
  }
}
```

### 2. Scaffold `apps/web` (Next.js 15)

```bash
cd apps
pnpm create next-app web --typescript --app --src-dir --no-tailwind
```

Add dependencies:
- `@supabase/supabase-js`, `@supabase/ssr`
- `zod`
- Workspace packages: `@rhodes/db`, `@rhodes/shared`

Create `/api/health` route:
```typescript
// apps/web/src/app/api/health/route.ts
export async function GET() {
  // ping supabase + redis
  return Response.json({ status: 'ok', supabase: true, redis: true });
}
```

Configure `next.config.ts` to transpile workspace packages.

**Domain (D-012):** set `basePath: '/app'` so the product mounts at `https://rhodes.quinsy.app/app`:

```typescript
// apps/web/next.config.ts
const nextConfig = {
  basePath: '/app',
};
```

Auth redirect URLs, `@supabase/ssr` cookie paths, and API routes all live under `/app/*`.

### 3. Scaffold `apps/worker`

```bash
mkdir -p apps/worker/src/queues
```

Dependencies: `bullmq`, `ioredis`, `@rhodes/db`, `@rhodes/shared`

**`apps/worker/src/index.ts`:**
```typescript
import { Worker } from 'bullmq';
import { connection } from './connection';

const heartbeat = new Worker('heartbeat', async () => {
  console.log('[worker] heartbeat', new Date().toISOString());
}, { connection });

console.log('[worker] started');
```

Enqueue heartbeat job every 30s from a simple interval for dev verification.

### 4. Create database migrations

Split [`04-data-model.md`](../docs/04-data-model.md) into ordered migration files:

**`00001_extensions.sql`:**
```sql
create extension if not exists "uuid-ossp";
create extension if not exists vector;
```

**`00002_core_tables.sql`:** All tables:
- `workspaces`, `workspace_members`
- `documents`, `library_sources`, `library_source_chunks`
- `document_versions`, `metadata_schemas`, `templates`, `views`
- `profiles`, `workspace_invites`
- `subscriptions`, `webhook_events`

**`00003_rls_policies.sql`:**
```sql
-- Helper function
create or replace function is_workspace_member(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$ language sql security definer;

-- Enable RLS on all content tables
alter table documents enable row level security;
-- ... policies: SELECT/INSERT/UPDATE/DELETE for members only
```

**`00004_match_rpc.sql`:** `match_workspace_knowledge` function (768D vectors).

**`00005_seed_system_templates.sql`:** System templates (Blank, Meeting Minutes, Report, Product Spec).

### 5. Migration runner

**`scripts/migrate.js`:**
- Connect to Postgres via `DATABASE_URL` or Docker exec
- Apply migrations in order; track in `schema_migrations` table
- Fail fast on error

Alternative: use `supabase db push` if Supabase CLI is configured against local stack.

### 6. Seed script

**`scripts/seed.js`:**
- Create test user via Supabase Admin API (service role)
- Verify private workspace was auto-created (trigger added in Phase 03; for now seed manually)
- Insert one sample document with TipTap JSON structure

### 7. Generate TypeScript types

```bash
pnpm db:types
```

Commit generated `packages/db/src/types.ts` or regenerate in CI.

### 8. CI workflow

**`.github/workflows/ci.yml`:**
```yaml
on: [push, pull_request]
jobs:
  ci:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg15
        env:
          POSTGRES_PASSWORD: postgres
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm db:migrate
```

### 9. Add web + worker to `docker-compose.dev.yml` (optional)

For contributors who prefer all-in-Docker:
```yaml
web:
  build: ../apps/web
  volumes: ["../apps/web:/app"]
  ports: ["3000:3000"]
  depends_on: [supabase-kong, redis]
```

Defer full Dockerized app until Phase 03+ when env vars stabilize.

---

## Environment variables (this phase)

| Variable | Used by | Source |
|----------|---------|--------|
| `DATABASE_URL` | migrate script | `postgresql://postgres:PASSWORD@localhost:5432/postgres` |
| `SUPABASE_URL` | web, worker | Phase 01 `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | worker, migrate | Phase 01 `.env` |
| `NEXT_PUBLIC_SUPABASE_URL` | web client | Phase 01 `.env` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web client | Phase 01 `.env` |
| `REDIS_URL` | worker | `redis://localhost:6379` |

---

## Testing checklist

- [ ] `pnpm install` succeeds at repo root
- [ ] `pnpm db:migrate` applies all migrations without error
- [ ] `pnpm db:seed` creates test data
- [ ] `pnpm dev` starts web (port 3000) and worker concurrently
- [ ] `GET /api/health` returns `{ status: 'ok' }`
- [ ] Worker logs heartbeat every 30s
- [ ] `pnpm typecheck` and `pnpm lint` pass
- [ ] CI workflow passes on PR to `dev`
- [ ] pgvector extension exists: `SELECT * FROM pg_extension WHERE extname = 'vector'`
- [ ] HNSW indexes created on embedding columns

---

## Exit criteria

1. Monorepo structure exists with `apps/web`, `apps/worker`, `packages/db`, `packages/shared`, `packages/ai`.
2. All migrations from data model spec applied successfully.
3. `match_workspace_knowledge` RPC callable (test with dummy vector).
4. `/api/health` endpoint returns OK.
5. Worker connects to Redis and processes heartbeat jobs.
6. CI pipeline green on `dev` branch.

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Supabase local vs raw Postgres drift | Use same migration files for both paths |
| Generated types out of sync | Regenerate in CI; fail if diff |
| Monorepo import resolution | Configure `transpilePackages` in Next.js |
| Migration ordering bugs | Numeric prefixes; idempotent where possible |

---

## Deliverables

- pnpm monorepo with web + worker + packages
- SQL migrations (extensions → tables → RLS → RPC → seed)
- `scripts/migrate.js`, `scripts/seed.js`
- `/api/health` endpoint
- GitHub Actions CI workflow

**Merge:** PR `feature/phase-02-scaffold` → `dev` → `main` when exit criteria met.
