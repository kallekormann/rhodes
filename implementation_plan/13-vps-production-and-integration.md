# Phase 13 — VPS Production and Integration Testing

**Status:** planned  
**Depends on:** Phases 09–12 **and Phase 12b** (topology profiles)  
**Blocks:** — (V1 release)  
**Estimated duration:** 5–7 days

---

## Objectives

1. Deploy Rhodes to **Hetzner VPS** via **Coolify** using the same Docker images as local dev.
2. Choose **deployment topology** from Phase 12b: monolith (one server) or distributed (app + data + storage).
3. Configure **production overlays**: TLS, Resend/SES, LemonSqueezy live webhooks, secrets.
3. Run **full integration test checklist**: auth, billing, email, backend hand-in-hand.
4. Establish **backups, monitoring, and runbooks**.
5. Tag `main` as **v1.0.0-rc1** when staging passes.

---

## Prerequisites

- Phases 01–12 exit criteria met on `dev` branch.
- **Phase 12b exit criteria met** — Compose profiles and `RHODES_TOPOLOGY` documented; distributed smoke test passed (or consciously deferred with monolith-only V1 deploy documented in runbook).
- `main` merged with all features.
- Domain: **`rhodes.quinsy.app`** (D-012, validated launch). Optional **`rhodes.app`** if acquired later (O-018) — env-driven URLs, no code change required.
- LemonSqueezy live store configured.
- Resend or AWS SES EU account with DNS access.
- Hetzner Cloud account.

---

## Canonical spec references

- [13-infrastructure-vps.md](../docs/13-infrastructure-vps.md)
- [12b-distributed-docker-topology.md](12b-distributed-docker-topology.md)
- [18-non-functional-requirements.md](../docs/18-non-functional-requirements.md)
- [14-email-delivery.md](../docs/14-email-delivery.md)
- [15-security-and-privacy.md](../docs/15-security-and-privacy.md)
- [adr/001-full-vps-self-hosted.md](../docs/adr/001-full-vps-self-hosted.md)

---

## Target infrastructure

| Resource | Spec |
|----------|------|
| Provider | Hetzner Cloud EU (Falkenstein or Nuremberg) |
| Instance | CPX41 — 8 vCPU, 16 GB RAM, 240 GB disk (~€28/mo) |
| Orchestration | Coolify |
| TLS | Caddy via Coolify |
| Backups | Daily `pg_dump` + restic → Hetzner Object Storage |
| Monitoring | Uptime Kuma + disk/queue/Ollama alerts |

---

## File checklist

```
docker/
├── docker-compose.prod.yml         # Production overrides (complete)
├── Caddyfile                       # If not managed by Coolify
└── .env.production.example

docs/
└── runbooks/
    ├── deploy.md
    ├── rollback.md
    ├── rescale.md
    ├── backup-restore.md
    └── incident-ollama-oom.md

scripts/
├── deploy-prod.sh
├── backup-db.sh
└── integration-test.sh             # Smoke test script
```

---

## Step-by-step tasks

### 1. Provision Hetzner VPS

1. Create CPX41 in EU region
2. Install Coolify (official script)
3. Attach firewall: allow 22 (SSH), 80, 443; deny all else
4. Optional: attach Volume if library storage anticipated early

### 2. Coolify project setup

**First decision:** `RHODES_TOPOLOGY=monolith` (single CPX41) or `distributed` (see [12b-distributed-docker-topology.md](12b-distributed-docker-topology.md)).

Create Coolify project `rhodes` with services:

| Service | Source | Notes |
|---------|--------|-------|
| `marketing` | GitHub `kallekormann/rhodes` branch `main`, `apps/marketing` Dockerfile | `https://rhodes.quinsy.app/` — see [14-marketing-website.md](14-marketing-website.md) |
| `web` | Same repo, `apps/web` Dockerfile | `https://rhodes.quinsy.app/app` (`basePath: '/app'`) — **app role** |
| `worker` | Same repo, `apps/worker` Dockerfile | Internal only — **app role** |
| `supabase` | Docker compose stack from repo `docker/` — **data role** (Postgres, Auth, Kong, …) | Private network; or separate Coolify host in distributed mode |
| `ollama` | `ollama/ollama` | **data role** (with Supabase); `OLLAMA_HOST` points here from app/worker |
| `storage` | Compose profile `storage` from Phase 12b | Private network; dedicated host when library &gt;100 GB |
| `redis` | Redis 7 | **app role** (with web/worker) |
| `tika` | `apache/tika:latest-full` | **app role** |

**Network:** All services on `rhodes-network`. Only Caddy exposes 443.

### 3. Production Docker overlay

**`docker-compose.prod.yml`:**
```yaml
services:
  web:
    environment:
      - NODE_ENV=production
      - APP_URL=https://rhodes.quinsy.app/app
    restart: unless-stopped
  ollama:
    environment:
      - OLLAMA_MAX_LOADED_MODELS=1
      - OLLAMA_NUM_PARALLEL=2
  # No Mailpit — remove or disable
  # No Supabase Studio — remove
```

### 4. Environment secrets (Coolify)

Set via Coolify UI (never in git):

```env
# Supabase
POSTGRES_PASSWORD=<strong>
JWT_SECRET=<strong>
SUPABASE_SERVICE_ROLE_KEY=<strong>
NEXT_PUBLIC_SUPABASE_URL=https://rhodes.quinsy.app/supabase  # Kong path via Caddy, or internal
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>

# App
APP_URL=https://rhodes.quinsy.app/app

# Email (Resend example)
RESEND_API_KEY=re_live_...
GOTRUE_SMTP_HOST=smtp.resend.com
GOTRUE_SMTP_PASS=re_live_...
GOTRUE_SMTP_ADMIN_EMAIL=auth@notify.rhodes.quinsy.app
GOTRUE_SITE_URL=https://rhodes.quinsy.app/app

# Billing (live)
LEMONSQUEEZY_API_KEY=...
LEMONSQUEEZY_WEBHOOK_SECRET=...
LEMONSQUEEZY_VARIANT_PRO_MONTHLY=...
LEMONSQUEEZY_VARIANT_TEAM_SEAT_MONTHLY=...

# Ollama (on Data server in distributed mode)
OLLAMA_HOST=http://data.internal:11434
```

### 5. DNS configuration

| Record | Target |
|--------|--------|
| `rhodes.quinsy.app` CNAME or A | VPS IP (marketing + product via Caddy path routing) |
| `notify.rhodes.quinsy.app` | Resend/SES DNS records (SPF, DKIM, DMARC) for transactional mail |

Single subdomain — no separate `app.` host. Caddy routes `/` → marketing, `/app` → product.

Optional: `staging.rhodes.quinsy.app` for pre-production (same `/` + `/app` split).

### 6. TLS

Coolify/Caddy auto-provisions Let's Encrypt for `rhodes.quinsy.app`.

Verify:
- HTTPS redirect from HTTP
- HSTS header (from helmet)
- Cookies `Secure` flag works

### 7. Ollama model bootstrap

Post-deploy script on VPS:
```bash
docker exec ollama ollama pull nomic-embed-text
docker exec ollama ollama pull llama3.2:3b-instruct-q4_K_M
docker exec ollama ollama pull llama3.1:8b-instruct-q4_K_M
```

Document in runbook; add to `deploy-prod.sh`.

### 8. LemonSqueezy live webhooks

1. Register `https://rhodes.quinsy.app/app/api/webhooks/lemonsqueezy` in LemonSqueezy dashboard
2. Use live webhook secret in Coolify env
3. Remove ngrok/tunnel dependency

### 9. Backups

**`scripts/backup-db.sh`:**
```bash
pg_dump $DATABASE_URL | gzip > /backups/rhodes-$(date +%Y%m%d).sql.gz
restic backup /backups --tag rhodes-db
```

Cron: daily 03:00 UTC. Retention: 30 daily, 12 monthly.

Weekly Hetzner Volume snapshot.

**RPO:** 24h | **RTO:** 4h (documented in runbook).

### 10. Monitoring

Deploy Uptime Kuma (on same VPS or separate):
- `https://rhodes.quinsy.app/app/api/health` — 5 min interval
- `https://rhodes.quinsy.app/` — 5 min interval

Alerts (email/Slack):
| Metric | Threshold |
|--------|-----------|
| Disk usage | >80% |
| BullMQ queue depth | >100 jobs |
| Ollama OOM | any occurrence |
| API error rate | >1% / 5min |
| Email bounce rate | >2% |

### 11. Integration test checklist

Run on **staging** first (`staging.rhodes.quinsy.app`), then production.

#### Auth (HTTPS + real SMTP)

- [ ] Register new account → verification email delivered (not spam)
- [ ] Click verify link → account active
- [ ] Login → session cookie `Secure` + correct domain
- [ ] Password reset email delivered → reset works
- [ ] Logout → session cleared
- [ ] JWT refresh after 1h idle

#### Billing (live LemonSqueezy)

- [ ] Upgrade to Pro via checkout (use real card or LS test in live mode per their docs)
- [ ] Webhook received on VPS → tier updated within 30s
- [ ] Pro feature gates active (debounce, storage)
- [ ] Customer portal opens
- [ ] Cancel subscription → tier reverts at period end
- [ ] Team checkout + seat enforcement

#### Email (relay)

- [ ] Auth emails: verify, reset — deliver via `auth@notify.rhodes.quinsy.app`
- [ ] Team invite email delivers with valid link
- [ ] Knowledge Bridge cron sends digest (trigger manually)
- [ ] Export ready email with download link
- [ ] Unsubscribe link works
- [ ] SPF/DKIM pass (check mail headers)

#### Backend hand-in-hand

- [ ] Upload PDF → ingest → `ready` within 15s (&lt;20 pages)
- [ ] Write document → insights appear (3s debounce)
- [ ] Ask chat streams with citations
- [ ] Quote insert creates CitationBlock
- [ ] Offline edit → reconnect → sync (test from laptop)
- [ ] Team invite → accept → shared workspace visible
- [ ] GDPR export ZIP complete
- [ ] Account deletion removes all data
- [ ] RLS: cross-workspace access denied (automated test on staging)

#### Performance (NFR spot checks)

- [ ] Editor LCP &lt;2s on broadband
- [ ] Vector search &lt;80ms @ 10k chunks (load test data if needed)
- [ ] UI panel transition &lt;100ms perceived

### 12. Runbooks

Write in `docs/runbooks/`:

| Runbook | Contents |
|---------|----------|
| `deploy.md` | Coolify deploy steps, env checklist, model pull |
| `rollback.md` | Revert to previous image tag; DB migration rollback policy |
| `rescale.md` | Hetzner power off → rescale RAM → power on (~2–5 min) |
| `backup-restore.md` | pg_restore procedure; restic restore |
| `incident-ollama-oom.md` | Restart Ollama; reduce concurrent jobs; rescale RAM |

### 13. Staging → production promotion

1. Deploy `main` to `staging.rhodes.quinsy.app`
2. Run full integration checklist
3. Fix any issues on `dev` → merge to `main`
4. Deploy to `rhodes.quinsy.app`
5. Tag: `git tag v1.0.0-rc1 && git push origin v1.0.0-rc1`

### 14. Post-launch

- Enable uptime monitoring alerts
- Schedule weekly backup restore drill (month 1)
- Document on-call contact (solo founder = self)
- Penetration test decision (O-016) before public marketing

---

## Environment variables (production-only)

See Phase 01 `.env.example` — all vars must be set in Coolify. Rotate `SUPABASE_SERVICE_ROLE_KEY` and `JWT_SECRET` from dev values.

---

## Exit criteria

1. Rhodes marketing at `https://rhodes.quinsy.app/` and product at `https://rhodes.quinsy.app/app` with valid TLS.
2. Full integration checklist passes on staging.
3. Backups running daily; restore tested once.
4. Monitoring alerts configured.
5. Runbooks written.
6. `main` tagged `v1.0.0-rc1`.
7. Auth, billing, email, and backend validated **together** on VPS — not just individually.

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| 16 GB RAM insufficient for Ollama + Supabase | Monitor; rescale to 32 GB playbook ready |
| Email deliverability | Dedicated subdomain; warm up; SPF/DKIM/DMARC |
| Coolify vs raw compose drift | Same `docker-compose.yml` in repo; Coolify references it |
| Downtime during rescale | Communicate 24h ahead; schedule low-traffic window |
| Secret leak in Coolify | RBAC on Coolify; audit access |

---

## Deliverables

- Hetzner VPS + Coolify deployment
- `docker-compose.prod.yml` finalized
- DNS + TLS configured
- Live LemonSqueezy + Resend/SES wired
- Backups + monitoring
- Integration test checklist (passed)
- Runbooks (5 docs)
- `v1.0.0-rc1` release tag

**Merge:** Final PR `release/v1.0.0-rc1` → `main`; deploy from `main`.

---

## What comes after V1

| Item | Timeline |
|------|----------|
| MFA (TOTP) | V1.5 |
| OAuth (Google) | V1.5 |
| Real-time collaboration (Yjs) | V2 |
| PWA install | V1.5 (O-010) |
| OCR for scanned PDFs | V2 |
| Multi-region / scale-out | V2+ |

Log new work in [`../docs/19-open-decisions.md`](../docs/19-open-decisions.md).
