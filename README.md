# Rhodes

Rhodes is a Docker-first, self-hosted team second brain: documents, library ingestion, local AI (Ollama), and workspace collaboration — all running on your own infrastructure.

This repository contains product specs (`docs/`), a UI reference mock (`ui-mock/`), and an executable implementation plan (`implementation_plan/`). Application code lands in Phases 02+.

## Prerequisites

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Docker Desktop | 4 GB RAM allocated | 8 GB RAM allocated |
| System RAM | 16 GB | 32 GB |
| Disk | 40 GB free | 80 GB free (Ollama models) |
| Node.js | 20 LTS | 22 LTS |
| pnpm | 9.x | latest |
| Git | 2.x | latest |

## Quick start

```bash
git clone https://github.com/kallekormann/rhodes.git
cd rhodes
git checkout dev

cp docker/.env.example docker/.env
./scripts/generate-keys.sh --update-env

./scripts/dev-up.sh
./scripts/pull-models.sh

pnpm install
./scripts/sync-web-env.sh
pnpm db:migrate
pnpm db:seed
pnpm dev
```

App: http://localhost:3001/app — Health: http://localhost:3001/app/api/health

## Service URLs (local dev)

| Service | URL |
|---------|-----|
| Supabase API (Kong) | http://localhost:8000 |
| Supabase Studio | http://localhost:54323 |
| Mailpit (email capture) | http://localhost:8025 |
| Ollama | http://localhost:11434 |
| Postgres (direct, dev) | localhost:5433 |

## Scripts

| Script | Purpose |
|--------|---------|
| `./scripts/dev-up.sh` | Start full dev Docker stack |
| `./scripts/dev-down.sh` | Stop stack (`--prune` removes volumes) |
| `./scripts/dev-logs.sh` | Tail service logs |
| `./scripts/health-check.sh` | Verify all services are healthy |
| `./scripts/pull-models.sh` | Pull required Ollama models |
| `./scripts/generate-keys.sh` | Generate Supabase secrets and API keys |
| `./scripts/sync-web-env.sh` | Copy public Supabase vars into `apps/web/.env.local` |
| `pnpm library:reindex` | Re-ingest library sources (chunk metadata upgrade) |
| `pnpm documents:reindex` | Re-chunk workspace documents into `document_chunks` |
| `pnpm worker:dev` | Run BullMQ worker on the host (or use Compose `worker`) |

## Mac: native Ollama (optional)

Docker Ollama can be slow on Apple Silicon. For better performance, run Ollama natively and point the app at the host:

```bash
brew install ollama
ollama serve
```

Set in `docker/.env`:

```env
OLLAMA_HOST=http://host.docker.internal:11434
```

Then run `./scripts/pull-models.sh` from the host (default `OLLAMA_HOST` is `http://localhost:11434`).

## Branch strategy

| Branch | Purpose |
|--------|---------|
| `main` | Stable releases; VPS production deploys |
| `dev` | Integration branch |
| `feature/*` | Phase slices; PR → `dev` |

## Auth (dev)

Verification and password-reset emails are captured in [Mailpit](http://localhost:8025). GoTrue uses `SITE_URL=http://localhost:3001/app` — auth pages live under `/app/auth/*`.

Confirmation links go through **`/app/auth/confirm`** (not Kong `:8000`) so browser cookies from the Next.js app do not hit Kong’s header size limit. If an older email still points at `localhost:8000/auth/v1/verify`, change the host/path to `http://localhost:3001/app/auth/confirm` and keep the same `token` and `type` query params.

| Dev | VPS (Phase 13) |
|-----|----------------|
| `GOTRUE_SMTP_HOST=mailpit` | Resend or AWS SES EU |
| `GOTRUE_SMTP_PORT=1025` | `587` (TLS) |
| `GOTRUE_MAILER_AUTOCONFIRM=false` | `false` |

Run RLS integration test (requires Docker Postgres on port 5433):

```bash
pnpm db:migrate
pnpm db:test:rls
```


- [Implementation plan index](implementation_plan/00-README.md)
- [Product specs](docs/README.md)
- [UI mock reference](docs/26-ui-mock-reference.md)

## License

Proprietary — Quinsy / Kalle Kormann.
