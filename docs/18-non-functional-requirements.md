# 18 — Non-Functional Requirements

**Status:** draft

## Context

Performance, reliability, and acceptance criteria from the PRD — extended for CPU-only AI and On-Demand UI.

## Decision

Adopt PRD performance budgets with adjustments for CPU inference latency.

## Specification

### Performance budgets

| Metric | Target |
|--------|--------|
| Vector search (`match_workspace_knowledge`) | <80ms @ 10k chunks |
| Insight debounce | 3000ms (Pro), 5000ms (Free) |
| UI sidebar transition | <100ms perceived |
| PDF ingestion pipeline | <15s for <20 pages |
| LLM "Why relevant?" | <8s (3B model), stream if >2s |
| LLM chat first token | <10s (8B CPU), stream |
| Page load (editor) | <2s LCP on broadband |
| Header auto-hide delay | 2000ms after last keystroke |

### Availability

| Tier | Target |
|------|--------|
| MVP | 99% monthly (best effort) |
| Production | 99.5% |

Planned maintenance: Rescale downtime communicated 24h ahead.

### Scalability

| Users | Infrastructure |
|-------|----------------|
| 1–50 | 16 GB RAM, 8 vCPU |
| 50–300 | 32 GB RAM |
| 300–1000 | 48 GB RAM + Volume |

LLM queue prevents CPU saturation — max 2 concurrent inference jobs.

### Definition of Done (V1)

1. **Tenancy:** RLS blocks access without workspace membership (automated test)
2. **Pipeline:** PDF upload → searchable in insights within 15s
3. **Split-screen:** Quote insert with backlink works in all supported browsers
4. **Offline:** Editor writable offline; syncs on reconnect without data loss
5. **i18n:** UI renders in all 5 locales; LLM responds in user/doc language
6. **Light/Dark:** Both modes functional with system preference
7. **Email:** Knowledge Bridge sends via relay; unsubscribe works
8. **Security:** No service role key in client bundle; HTTPS only

### Monitoring

| Metric | Alert threshold |
|--------|-----------------|
| Disk usage | >80% |
| Queue depth | >100 jobs |
| Ollama OOM | Any occurrence |
| API error rate | >1% / 5min |
| Email bounce rate | >2% |

### Browser support

- Chrome, Firefox, Safari, Edge — last 2 versions
- No IE

## Open questions

- SLA for Team tier customers?
- Load test target: concurrent users per VPS?

## Dependencies

- [05-ai-and-rag.md](05-ai-and-rag.md)
- [13-infrastructure-vps.md](13-infrastructure-vps.md)
- [12-offline-sync.md](12-offline-sync.md)
