# Phase 12 — Email, Privacy, and Security

**Status:** planned  
**Depends on:** Phase 08  
**Blocks:** Phase 13  
**Estimated duration:** 4–6 days  
**Can parallel with:** Phases 09, 10, 11

---

## Objectives

1. Wire **transactional email** via managed relay (Resend or AWS SES EU).
2. Configure **GoTrue SMTP** for auth emails through same relay.
3. Implement **GDPR export** and **account deletion** flows.
4. Apply **security hardening** per spec.
5. Local dev continues using Mailpit; **full email validation on VPS** (Phase 13).

---

## Prerequisites

- Phase 08 exit criteria met (Privacy placeholder in Settings).
- Phase 11 billing cancel hook stubbed.
- Worker app for deletion saga jobs.

---

## Canonical spec references

- [14-email-delivery.md](../docs/14-email-delivery.md)
- [24-privacy-user-tools.md](../docs/24-privacy-user-tools.md)
- [15-security-and-privacy.md](../docs/15-security-and-privacy.md)
- [22-authentication-and-accounts.md](../docs/22-authentication-and-accounts.md) — account deletion
- [adr/005-managed-email-relay.md](../docs/adr/005-managed-email-relay.md)

---

## Docker services touched

| Service | Dev | Staging/Prod |
|---------|-----|--------------|
| `mailpit` | Capture all mail | Disabled |
| `supabase-auth` | SMTP → Mailpit | SMTP → Resend/SES |

---

## File checklist

```
apps/web/src/
├── app/api/
│   ├── account/
│   │   ├── export/route.ts         # POST — queue export job
│   │   └── delete/route.ts         # POST — queue deletion job
│   └── email/
│       └── unsubscribe/route.ts    # Knowledge Bridge opt-out
├── lib/email/
│   ├── client.ts                   # Resend or SES SDK
│   └── templates/
│       ├── team-invite.tsx
│       ├── knowledge-bridge.tsx
│       └── export-ready.tsx
├── components/settings/
│   └── PrivacySection.tsx
└── lib/security/
    ├── headers.ts                  # helmet config
    └── rate-limit.ts               # API rate limits

apps/worker/src/jobs/
├── export-account.ts
└── delete-account.ts
```

---

## Step-by-step tasks

### 1. Email relay abstraction

**`lib/email/client.ts`:**
```typescript
interface EmailClient {
  send(params: { to: string; subject: string; html: string }): Promise<void>;
}

// Implementations: ResendEmailClient, SESEmailClient, MailpitEmailClient (dev)
export function getEmailClient(): EmailClient {
  if (process.env.RESEND_API_KEY) return new ResendEmailClient();
  if (process.env.NODE_ENV === 'development') return new MailpitEmailClient();
  throw new Error('No email client configured');
}
```

Per [14-email-delivery.md](../docs/14-email-delivery.md): **never send SMTP directly from app VPS IP** — always relay.

### 2. GoTrue SMTP (production mapping)

Document env switch in `docker-compose.prod.yml`:
```env
GOTRUE_SMTP_HOST=smtp.resend.com
GOTRUE_SMTP_PORT=465
GOTRUE_SMTP_USER=resend
GOTRUE_SMTP_PASS=re_...
GOTRUE_SMTP_ADMIN_EMAIL=auth@notify.rhodes.quinsy.app
```

Dev remains Mailpit (Phase 01).

### 3. App transactional emails

| Email | Trigger | Template |
|-------|---------|----------|
| Team invite | `POST /api/workspaces/[id]/invite` | Link with token |
| Knowledge Bridge digest | Worker cron (weekly) | Matched insights summary |
| Export ready | Export job complete | Download link (24h signed URL) |
| Account deletion confirm | Delete request | Confirm link (if grace period) |

All include unsubscribe where applicable.

### 4. GDPR data export

**`POST /api/account/export`:**
1. Auth: JWT = own user only
2. Enqueue `export-account` job
3. Return `{ job_id, message: "We'll email you when ready" }`

**`export-account` job:**
1. Collect: profile, documents, library metadata (not binary files — link to storage), subscriptions
2. Build ZIP (JSON files per category)
3. Upload ZIP to storage `exports/{user_id}/{timestamp}.zip`
4. Send email with 24h signed download URL
5. Audit log entry

### 5. Account deletion saga

**`POST /api/account/delete`:**
```typescript
// Body: { confirm_email: string } — must match user email
// 1. Validate JWT
// 2. Check team ownership transfer requirements
// 3. Enqueue delete-account job
// 4. Disable sessions immediately (optional soft-delete)
```

**`delete-account` job** per [22-authentication-and-accounts.md](../docs/22-authentication-and-accounts.md):
1. `cancelSubscription(userId)` (Phase 11)
2. Purge storage files for owned workspaces
3. Delete owned workspaces (CASCADE handles documents, chunks)
4. Remove `workspace_members` rows
5. Anonymized audit log
6. `supabaseAdmin.auth.admin.deleteUser(userId)`

**Grace period (optional):** 7-day soft delete — account disabled, data marked `deleted_at`; hard delete after 7 days. Resolve open decision O-017 before implementing.

### 6. Privacy settings UI

**`PrivacySection.tsx`:**
- Export my data button → triggers export
- Delete account → confirmation modal (type email)
- Consent toggles: Knowledge Bridge emails, product updates
- Links to Privacy Policy / Imprint (static pages, EN for V1)

### 7. Security headers

**`lib/security/headers.ts`:**
```typescript
import helmet from 'helmet';
// Apply on API routes: CSP, X-Frame-Options, HSTS (prod only)
```

### 8. Rate limiting (API)

Extend `rate-limiter-flexible`:
- Export: 1 / user / 24h
- Delete: 1 / user / 24h
- General API: 100 req / min / user

### 9. Secret audit

- ESLint rule: fail build if `SERVICE_ROLE_KEY` imported in client bundle
- CI grep: `SUPABASE_SERVICE_ROLE` in `apps/web/src` client components

### 10. Consent logging

```sql
create table consent_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  consent_type text not null,
  granted boolean not null,
  ip_hash text,
  created_at timestamptz default now()
);
```

Log on signup (terms acceptance) and preference changes.

---

## Environment variables

```env
# Dev (Mailpit — Phase 01)
SMTP_HOST=mailpit
SMTP_PORT=1025

# Production (choose one)
RESEND_API_KEY=re_...
# OR
AWS_SES_REGION=eu-central-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

EMAIL_FROM=notify@rhodes.quinsy.app
AUTH_EMAIL_FROM=auth@notify.rhodes.quinsy.app
```

---

## Testing checklist

- [ ] Team invite email appears in Mailpit (dev)
- [ ] Export job produces ZIP with user data
- [ ] Export download link expires after 24h
- [ ] Delete account removes user from auth + app tables
- [ ] Delete cancels subscription (mock/test)
- [ ] Sole team owner blocked from delete without transfer
- [ ] Security headers present on API responses
- [ ] Service role key not in client bundle (CI check)
- [ ] Rate limits on export/delete enforced
- [ ] Unsubscribe link disables Knowledge Bridge emails
- [ ] Consent logged on preference change

---

## Exit criteria

1. Email abstraction supports Mailpit (dev) and Resend/SES (prod config ready).
2. GDPR export produces complete ZIP + notification email.
3. Account deletion saga cascades all user data.
4. Privacy section functional in Settings.
5. Security headers + rate limits + secret audit in CI.
6. NFR DoD #7–8 addressed (relay configured; no service role in client).

**VPS validation (Phase 13):** Real emails deliver; SPF/DKIM pass; auth verify/reset over HTTPS.

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Incomplete deletion (GDPR) | Checklist + automated test creates user, deletes, asserts empty |
| Email to spam | Use relay subdomain `notify.rhodes.quinsy.app`; SPF/DKIM in Phase 13 |
| Export ZIP too large | Stream ZIP; exclude library binaries (metadata only) |
| Deletion race with active session | Revoke all sessions before delete job |

---

## Deliverables

- Email client abstraction + templates
- Export + delete API + worker jobs
- PrivacySection UI
- Security headers + API rate limits
- Consent logging migration
- CI secret leak check

**Merge:** PR `feature/phase-12-privacy` → `dev` → `main` when exit criteria met.
