# 13 — Infrastructure (VPS)

**Status:** draft

## Context

Rhodes runs fully self-hosted on a VPS via Coolify. No GPU; CPU-only Ollama. Hetzner is the preferred provider for EU hosting and scaling.

## Decision

- **Provider:** Hetzner Cloud (EU, e.g. Falkenstein or Nuremberg)
- **Orchestration:** Coolify
- **No GPU** — quantized Ollama models only
- Scale via Rescale (CPU/RAM) + Volumes + Object Storage

## Specification

### Service stack

| Service | Image / Role |
|---------|--------------|
| Coolify | Orchestration, SSL, deploy |
| Next.js app | `web-app` — Rhodes frontend + API routes |
| Supabase (self-hosted) | Auth, Postgres, pgvector, Storage, Kong |
| Ollama | Embeddings + inference |
| Redis | BullMQ job queue |
| Worker | Node.js — ingestion, embed, email cron |
| Apache Tika | PDF/DOCX text extraction |
| Caddy / Traefik | TLS termination (via Coolify) |

### Docker network

All services on private `rhodes-network`. Only Caddy exposes 443 to public.

### Base system storage (no user data)

| Component | Disk |
|-----------|------|
| OS + Coolify | ~5 GB |
| Supabase stack | ~8–12 GB |
| Ollama models | ~6 GB |
| Redis, Tika, Worker, App | ~3 GB |
| Logs, Docker overhead | ~5 GB |
| **Total** | **~27–31 GB** |

### RAM requirements

| Tier | RAM | vCPU | Disk | Users |
|------|-----|------|------|-------|
| MVP | 16 GB | 4–8 | 160 GB | 1–50 |
| Growth | 32 GB | 8 | 240 GB | 50–300 |
| Scale | 48 GB | 16 | 500 GB + Volume | 300–1000 |

Ollama 8B Q4 (~5 GB) + Supabase (~4–8 GB) + OS/Redis/Worker (~4 GB) = plan for **16 GB minimum**, **32 GB comfortable**.

### ~1,000 users storage estimate

Assumptions: 30% active (300), average 200 MB library per active user.

| Data type | Estimate (1000 users) |
|-----------|----------------------|
| Documents + versions | ~40 GB |
| Library PDFs | ~80 GB |
| Embeddings (Postgres) | ~25 GB |
| Images / misc storage | ~10 GB |
| System | ~30 GB |
| **Total** | **~130–190 GB** |

Plan **250–500 GB** with headroom; attach Hetzner Volume for library at scale.

### Hetzner scaling

| Resource | How | Notes |
|----------|-----|-------|
| CPU + RAM | [Rescale](https://docs.hetzner.com/cloud/servers/faq/) | Power off → rescale → ~2–5 min downtime |
| Primary disk | Grow only | Cannot shrink; use "CPU/RAM only" option to preserve downgrade path |
| [Volumes](https://docs.hetzner.com/cloud/technical-details/faq/) | Attach up to 10 TB | Library files, backups |
| Object Storage | S3-compatible | Backups, cold archive |

**Scaling playbook:**
1. Start: CPX41 (8 vCPU, 16 GB, 240 GB) ~€28/mo
2. RAM pressure → Rescale to 32 GB
3. Disk pressure → attach Volume, move Supabase storage path
4. Library >200 GB → Object Storage for cold PDFs

### Ollama environment

```env
OLLAMA_HOST=http://ollama-core:11434
OLLAMA_MAX_LOADED_MODELS=1
OLLAMA_NUM_PARALLEL=2
```

### Monitoring

- Uptime Kuma — HTTP health checks
- Loki + Promtail or Coolify logs — aggregation
- Alerts: disk >80%, queue depth >100, Ollama OOM

### Backups

- Daily `pg_dump` → Hetzner Object Storage (restic)
- Weekly full Volume snapshot
- RPO: 24h; RTO: 4h (documented runbook)

## Open questions

- Dedicated VPS for Supabase at scale vs single node?
- Coolify vs raw Docker Compose for reproducibility?
- **Library originals on VPS:** managed S3-compatible vs volume-only — and BYO bucket for enterprise? See [27-library-file-storage-vps.md](27-library-file-storage-vps.md) (blocking before production cutover).

## Dependencies

- [05-ai-and-rag.md](05-ai-and-rag.md)
- [14-email-delivery.md](14-email-delivery.md)
- [15-security-and-privacy.md](15-security-and-privacy.md)
- [16-ingestion-pipeline.md](16-ingestion-pipeline.md)
- [adr/001-full-vps-self-hosted.md](adr/001-full-vps-self-hosted.md)
- [adr/002-ollama-cpu-only.md](adr/002-ollama-cpu-only.md)
