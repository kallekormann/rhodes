# Phase 01 — Repository and Development Environment

**Status:** complete  
**Depends on:** —  
**Blocks:** Phase 02  
**Estimated duration:** 2–3 days

---

## Objectives

1. Initialize the canonical Git repository at [github.com/kallekormann/rhodes](https://github.com/kallekormann/rhodes.git) with `main` and `dev` branches.
2. Stand up a **Docker Compose dev stack** that mirrors the production VPS topology.
3. Provide developer scripts and environment templates so any contributor can run the full stack with one command.
4. Establish the rule: **same containers locally and on VPS** — only env overlays change later.

---

## Prerequisites

- Docker Desktop installed and running (verified on this machine).
- Git configured with access to `kallekormann/rhodes`.
- 16 GB+ system RAM recommended (Ollama models are heavy).
- pnpm installed globally (`npm install -g pnpm`).

---

## Canonical spec references

- [13-infrastructure-vps.md](../docs/13-infrastructure-vps.md) — service stack
- [adr/001-full-vps-self-hosted.md](../docs/adr/001-full-vps-self-hosted.md)
- [adr/002-ollama-cpu-only.md](../docs/adr/002-ollama-cpu-only.md)
- [22-authentication-and-accounts.md](../docs/22-authentication-and-accounts.md) — GoTrue SMTP vars

---

## Docker services (dev stack)

| Service | Image | Ports (dev) | Purpose |
|---------|-------|-------------|---------|
| `supabase-db` | `supabase/postgres:15.x` (with pgvector) | 5432 (internal) | PostgreSQL + pgvector |
| `supabase-auth` | `supabase/gotrue` | — | Auth (GoTrue) |
| `supabase-rest` | `postgrest/postgrest` | — | REST API |
| `supabase-storage` | `supabase/storage-api` | — | File storage |
| `supabase-kong` | `kong:2.8` | 8000 → API gateway | Routes to auth/rest/storage |
| `supabase-studio` | `supabase/studio` | 54323 | Dev DB UI (dev only) |
| `redis` | `redis:7-alpine` | 6379 | BullMQ queue |
| `ollama` | `ollama/ollama` | 11434 | Embeddings + LLM |
| `tika` | `apache/tika:latest-full` | 9998 (internal) | PDF/DOCX extraction |
| `mailpit` | `axllent/mailpit` | 8025 (UI), 1025 (SMTP) | Email capture (dev) |

**Note:** Use the [official Supabase Docker setup](https://github.com/supabase/supabase/tree/master/docker) as the base. Extend with Redis, Ollama, Tika, Mailpit. Do not invent a custom Postgres-only stack — it would diverge from VPS.

**Mac Ollama option:** Set `OLLAMA_HOST=http://host.docker.internal:11434` if running Ollama natively on the host for better ARM performance. Document both modes in README.

---

## File checklist

```
rhodes-app/
├── docker/
│   ├── docker-compose.yml          # Base services (all environments)
│   ├── docker-compose.dev.yml      # Dev overrides: hot reload, Mailpit, Studio
│   ├── docker-compose.prod.yml     # Prod stub (filled in Phase 13)
│   ├── .env.example                # All env vars documented
│   └── volumes/                    # Named volumes (gitignored data)
├── scripts/
│   ├── dev-up.sh                   # Start full dev stack
│   ├── dev-down.sh                 # Stop and optionally prune
│   ├── dev-logs.sh                 # Tail all service logs
│   ├── pull-models.sh              # Pull Ollama models
│   └── health-check.sh             # Verify all services healthy
├── .gitignore
├── .dockerignore
├── README.md                       # Quick start, prerequisites
├── docs/                           # Copy from rhodes-app/docs
├── ui-mock/                        # Copy from rhodes-app/ui-mock
└── implementation_plan/            # Copy from rhodes-app/implementation_plan
```

---

## Step-by-step tasks

### 1. Initialize Git repository

```bash
# From quinsy-sites/rhodes-app (or fresh directory)
git init
git remote add origin https://github.com/kallekormann/rhodes.git
git checkout -b main
# Copy docs/, ui-mock/, implementation_plan/ into repo root
git add .
git commit -m "Initial commit: specs, ui-mock, implementation plan"
git push -u origin main
git checkout -b dev
git push -u origin dev
```

### 2. Create `docker/docker-compose.yml`

Base compose with:
- `rhodes-network` bridge network (all services)
- Supabase stack (db, auth, rest, storage, kong, realtime optional)
- Redis with persistence volume
- Ollama with model cache volume
- Tika (no public ports)
- Health checks on db, redis, ollama, kong

### 3. Create `docker/docker-compose.dev.yml`

Dev overrides:
- Expose Kong on `localhost:8000` (Supabase API)
- Expose Studio on `localhost:54323`
- Mailpit on `8025` / `1025`
- Ollama on `localhost:11434`
- `GOTRUE_SMTP_*` pointing to Mailpit
- `GOTRUE_MAILER_AUTOCONFIRM=false` (test real verify flow)

### 4. Create `docker/.env.example`

Document every variable with comments:

```env
# ── Supabase ──────────────────────────────────
POSTGRES_PASSWORD=
JWT_SECRET=
ANON_KEY=
SERVICE_ROLE_KEY=
SUPABASE_URL=http://localhost:8000
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ── App ───────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=
APP_URL=http://localhost:3001/app
NEXT_PUBLIC_APP_URL=http://localhost:3001/app
# Marketing dev server (Phase 14): http://localhost:3000

# ── Redis ─────────────────────────────────────
REDIS_URL=redis://redis:6379

# ── Ollama ────────────────────────────────────
OLLAMA_HOST=http://ollama:11434
# Mac native: OLLAMA_HOST=http://host.docker.internal:11434

# ── Tika ──────────────────────────────────────
TIKA_URL=http://tika:9998

# ── Email (dev: Mailpit) ──────────────────────
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
SMTP_FROM=dev@rhodes.local

# ── GoTrue (auth email) ───────────────────────
GOTRUE_SITE_URL=http://localhost:3001/app
GOTRUE_SMTP_HOST=mailpit
GOTRUE_SMTP_PORT=1025
GOTRUE_SMTP_ADMIN_EMAIL=auth@rhodes.local
GOTRUE_MAILER_AUTOCONFIRM=false

# ── Billing (Phase 11 — placeholders) ─────────
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_WEBHOOK_SECRET=

# ── Email relay (Phase 12 — placeholders) ─────
RESEND_API_KEY=
```

### 5. Create scripts

**`scripts/dev-up.sh`:**
```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../docker"
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
../scripts/health-check.sh
echo "Dev stack running. Mailpit: http://localhost:8025"
```

**`scripts/pull-models.sh`:**
```bash
#!/usr/bin/env bash
set -euo pipefail
OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
curl -s "$OLLAMA_HOST/api/pull" -d '{"name":"nomic-embed-text"}'
curl -s "$OLLAMA_HOST/api/pull" -d '{"name":"llama3.2:3b-instruct-q4_K_M"}'
echo "Models pulled."
```

**`scripts/health-check.sh`:**
- `curl -f $SUPABASE_URL/rest/v1/` (with anon key)
- `redis-cli ping`
- `curl -f $OLLAMA_HOST/api/tags`
- `curl -f http://localhost:9998/tika` (from inside network or via exec)

### 6. Write root `README.md`

Include:
- Project overview (one paragraph)
- Prerequisites table
- Quick start (`dev-up.sh`, `pull-models.sh`)
- Service URLs table
- Branch strategy (`dev` / `main`)
- Link to `implementation_plan/00-README.md`

### 7. Configure `.gitignore`

```
node_modules/
.env
docker/.env
docker/volumes/
*.log
.DS_Store
dist/
.next/
```

---

## Environment variables (this phase)

| Variable | Required | Default (dev) |
|----------|----------|---------------|
| `POSTGRES_PASSWORD` | Yes | generate random |
| `JWT_SECRET` | Yes | generate random 32+ chars |
| `ANON_KEY` / `SERVICE_ROLE_KEY` | Yes | generate via Supabase CLI or script |
| `OLLAMA_HOST` | Yes | `http://ollama:11434` |
| `REDIS_URL` | Yes | `redis://redis:6379` |

Use `openssl rand -base64 32` for secrets. Never commit `.env`.

---

## Testing checklist

- [ ] `docker compose up` starts all containers without restart loops
- [ ] `health-check.sh` exits 0
- [ ] Supabase Studio loads at `http://localhost:54323`
- [ ] Mailpit UI loads at `http://localhost:8025`
- [ ] `curl http://localhost:11434/api/tags` returns JSON after `pull-models.sh`
- [ ] Tika responds inside Docker network
- [ ] `git push origin main` and `git push origin dev` succeed
- [ ] Fresh clone + `dev-up.sh` works on a clean machine

---

## Exit criteria

1. Repository exists at `github.com/kallekormann/rhodes` with `main` and `dev` branches.
2. `docs/`, `ui-mock/`, `implementation_plan/` are in the repo.
3. `./scripts/dev-up.sh` brings up a healthy Docker stack.
4. `./scripts/pull-models.sh` downloads `nomic-embed-text` and `llama3.2:3b-instruct-q4_K_M`.
5. Mailpit captures test SMTP mail.
6. README documents the full quick-start flow.

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Supabase Docker stack complexity | Use official compose; pin image versions |
| Ollama slow on Mac Docker | Document native Ollama + `host.docker.internal` option |
| 16 GB RAM insufficient | Document minimum models; unload inference model when idle |
| JWT key generation confusion | Provide `scripts/generate-keys.sh` using Supabase CLI |

---

## Deliverables

- Git repo initialized and pushed
- `docker/` compose files (base + dev)
- `scripts/` dev tooling
- `docker/.env.example`
- Root `README.md`

**Merge:** PR `feature/phase-01-dev-env` → `dev` → `main` when exit criteria met.
