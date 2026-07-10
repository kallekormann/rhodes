# 17 — Business Model

**Status:** draft

## Context

Monetization via LemonSqueezy with Free, Pro, and Team tiers — per the incubator PRD. Feature gates must align with infrastructure costs (CPU inference, storage).

## Decision

Keep three tiers. Semantic search remains available on Free (limited quotas) — it is the core USP and must not be disabled.

## Specification

### Tiers

| Feature | Free (Solo) | Pro | Team |
|---------|-------------|-----|------|
| Private spaces | 1 | Unlimited | Unlimited |
| Team spaces | 0 | 0 | Unlimited |
| Library imports / month | 5 | Unlimited | Unlimited |
| Library storage | 100 MB | 2 GB | 10 GB / seat |
| Semantic insights | Yes (slower debounce, top 3) | Full (top 8) | Full |
| AI chat messages / day | 10 | Unlimited | Unlimited |
| Document versions kept | 10 | 50 | 100 |
| Knowledge Bridge email | Monthly | Weekly | Weekly |
| Per-seat billing | — | — | Yes |

**Correction from PRD:** Free tier must NOT be "keyword only" — that removes the product's reason to exist.

### LemonSqueezy integration

Full specification: [25-billing-lemonsqueezy.md](25-billing-lemonsqueezy.md)

- SDK: `@lemonsqueezy/lemonsqueezy.js`
- Webhook: `POST /api/webhooks/lemonsqueezy` with HMAC verification
- Events: `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_expired`
- Store in `subscriptions` table; UI in Settings → Billing

### Feature gate implementation

```typescript
const limits = TIER_LIMITS[user.tier];
if (monthlyImports >= limits.imports) throw new QuotaExceeded();
if (tier === 'free') debounceMs = 5000; else debounceMs = 3000;
```

### Pricing (TBD)

Placeholder — set before launch:
- Pro: ~€12/mo
- Team: ~€10/seat/mo (min 3 seats)

## Open questions

- Self-hosted single-tenant license for enterprises (no LemonSqueezy)?
- Annual discount?

## Dependencies

- [05-ai-and-rag.md](05-ai-and-rag.md)
- [07-individual-vs-team.md](07-individual-vs-team.md)
- [25-billing-lemonsqueezy.md](25-billing-lemonsqueezy.md)
- [23-user-settings-and-spaces.md](23-user-settings-and-spaces.md)
