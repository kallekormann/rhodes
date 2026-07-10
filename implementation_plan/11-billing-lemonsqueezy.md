# Phase 11 — Billing (LemonSqueezy)

**Status:** planned  
**Depends on:** Phase 08  
**Blocks:** Phase 13  
**Estimated duration:** 4–6 days  
**Can parallel with:** Phases 09, 10, 12

---

## Objectives

1. Integrate **LemonSqueezy** for Pro and Team subscriptions.
2. Implement **webhook handler** with HMAC verification.
3. Build **feature gates** by tier (Free / Pro / Team).
4. Complete Settings **Billing** section.
5. Test locally with **test mode** + webhook tunnel; full validation on VPS (Phase 13).

---

## Prerequisites

- Phase 08 exit criteria met (Billing placeholder in Settings).
- `subscriptions` table exists (Phase 02 migration).
- LemonSqueezy account with test store configured.

---

## Canonical spec references

- [25-billing-lemonsqueezy.md](../docs/25-billing-lemonsqueezy.md)
- [17-business-model.md](../docs/17-business-model.md)
- [23-user-settings-and-spaces.md](../docs/23-user-settings-and-spaces.md) — Billing section
- [18-non-functional-requirements.md](../docs/18-non-functional-requirements.md)

---

## Docker services touched

None directly — external LemonSqueezy API.

**Local dev:** ngrok or cloudflared tunnel to `localhost:3000/api/webhooks/lemonsqueezy`.

---

## Tier feature gates

| Feature | Free | Pro | Team |
|---------|------|-----|------|
| Personal workspaces | 1 | Unlimited | Unlimited |
| Team workspaces | 0 | 0 | Unlimited |
| Library storage | 500 MB | 10 GB | 50 GB / seat |
| Insight debounce | 5000ms | 3000ms | 3000ms |
| Team seats | — | — | Per subscription |
| Ask messages / day | 20 | Unlimited | Unlimited |

Implement in `packages/shared/src/tiers.ts`.

---

## File checklist

```
apps/web/src/
├── app/api/
│   ├── billing/
│   │   ├── checkout/route.ts       # Create checkout URL
│   │   ├── portal/route.ts         # Customer portal URL
│   │   └── subscription/route.ts   # GET current tier
│   └── webhooks/
│       └── lemonsqueezy/route.ts   # POST webhook
├── lib/billing/
│   ├── lemonsqueezy.ts             # SDK setup
│   ├── webhooks.ts                 # HMAC verify + handlers
│   ├── gates.ts                    # canUseFeature(userId, feature)
│   └── sync-subscription.ts
├── components/settings/
│   └── BillingSection.tsx
└── hooks/useSubscription.ts

packages/shared/src/
└── tiers.ts
```

---

## Step-by-step tasks

### 1. LemonSqueezy SDK setup

```typescript
import { lemonSqueezySetup } from '@lemonsqueezy/lemonsqueezy.js';

lemonSqueezySetup({
  apiKey: process.env.LEMONSQUEEZY_API_KEY!,
  onError: (error) => console.error('LemonSqueezy:', error),
});
```

### 2. Checkout flow

**`POST /api/billing/checkout`:**
```typescript
// Body: { variant: 'pro_monthly' | 'team_seat_monthly' }
// 1. Get or create LemonSqueezy customer for user
// 2. createCheckout({ variantId, checkoutData: { email, custom: { user_id } } })
// 3. Return { checkout_url }
```

Settings Billing → "Upgrade to Pro" opens checkout URL in same tab.

### 3. Webhook handler

**`POST /api/webhooks/lemonsqueezy`:**

1. Verify HMAC signature (`X-Signature` header vs `LEMONSQUEEZY_WEBHOOK_SECRET`) using `crypto.timingSafeEqual`
2. Parse payload with Zod
3. Idempotency: check `webhook_events.event_id` — skip if processed
4. Handle events:

| Event | Action |
|-------|--------|
| `subscription_created` | Insert/update `subscriptions` row |
| `subscription_updated` | Update status, seats, `current_period_end` |
| `subscription_cancelled` | Set status cancelled; downgrade at period end |
| `subscription_payment_success` | Renew period |
| `subscription_payment_failed` | Mark past_due; notify user |

5. Insert `webhook_events` record

### 4. Subscription sync

**`getUserTier(userId)`:**
```typescript
const sub = await db.subscriptions.findByUserId(userId);
if (!sub || sub.status === 'cancelled') return 'free';
return sub.tier; // 'pro' | 'team'
```

Cache tier in JWT custom claim or short-lived server cache (5 min).

### 5. Feature gates

**`gates.ts`:**
```typescript
export async function assertFeature(userId: string, feature: Feature): Promise<void> {
  const tier = await getUserTier(userId);
  if (!tierAllows(tier, feature)) throw new FeatureGateError(feature);
}
```

Apply gates:
- Insight debounce interval (Phase 07 hook)
- Library upload size quota
- Team workspace creation
- Ask daily message count (Redis counter)

### 6. Customer portal

**`POST /api/billing/portal`:**
- Generate LemonSqueezy customer portal URL for manage/cancel

### 7. Billing UI

**`BillingSection.tsx`:**
- Current plan card (Free / Pro / Team)
- Usage meters (library storage, ask messages)
- Upgrade buttons
- "Manage subscription" → portal link
- Invoice history link (LemonSqueezy hosted)

### 8. Account deletion integration

Phase 12 will call `cancelSubscription(userId)` before auth delete — stub hook here.

### 9. Local testing setup

1. LemonSqueezy **test mode** API keys in `.env`
2. Register webhook URL via tunnel: `https://abc.ngrok.io/api/webhooks/lemonsqueezy`
3. Document in README: `cloudflared tunnel --url localhost:3000`

### 10. Team seats

Team tier: `seats` column in `subscriptions`
- Enforce max members in `workspace_members` for team workspaces
- Block invite if at seat limit

---

## Environment variables

```env
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_WEBHOOK_SECRET=
LEMONSQUEEZY_VARIANT_PRO_MONTHLY=
LEMONSQUEEZY_VARIANT_TEAM_SEAT_MONTHLY=
```

---

## Testing checklist

- [ ] Checkout URL opens LemonSqueezy test checkout
- [ ] Test purchase → webhook received → `subscriptions` row created
- [ ] User tier updates to `pro`
- [ ] Feature gates: Pro gets 3000ms debounce; Free gets 5000ms
- [ ] Library quota enforced for Free tier
- [ ] Cancel subscription → webhook → tier reverts at period end
- [ ] Duplicate webhook idempotent (no double processing)
- [ ] Invalid webhook signature rejected (401)
- [ ] Customer portal link works
- [ ] Team seat limit blocks excess invites

---

## Exit criteria

1. Full subscription lifecycle works in LemonSqueezy test mode.
2. Webhooks update `subscriptions` reliably.
3. Feature gates enforce tier limits.
4. Billing section complete in Settings.
5. Documented tunnel setup for local webhook testing.

**VPS validation (Phase 13):** Live webhooks on production domain, real payment smoke test.

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Webhook missed | Reconciliation cron: poll LS API daily |
| Tier cache stale | Invalidate on webhook |
| Test vs live key mix-up | Separate `.env.production` |
| EU VAT complexity | LemonSqueezy MoR handles tax |

---

## Deliverables

- Checkout + portal API routes
- Webhook handler with HMAC + idempotency
- Feature gate module
- BillingSection UI
- Tier constants + tests
- Local tunnel documentation

**Merge:** PR `feature/phase-11-billing` → `dev` → `main` when exit criteria met.
