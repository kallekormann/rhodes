# 15 — Security and Privacy

**Status:** draft

## Context

Rhodes handles sensitive company knowledge on a self-hosted VPS. EU users expect GDPR compliance. Team data must be isolated by RLS.

## Decision

Defense in depth: TLS, RLS, encryption at rest, audit logging, GDPR tooling. No secrets in git.

## Specification

### Transport security

- TLS 1.2+ everywhere (Caddy via Coolify)
- HSTS enabled
- Internal Docker network not exposed

### Authentication

Supabase Auth (self-hosted GoTrue) — full spec in [22-authentication-and-accounts.md](22-authentication-and-accounts.md):

- Email + password (V1); MFA TOTP (V1.5)
- `@supabase/supabase-js` + `@supabase/ssr` for Next.js sessions
- Account deletion requires custom cascade — **not** `deleteUser` alone

### Authorization

- Row Level Security on all content tables
- `is_workspace_member()` for every query
- Service role key **only** in worker container — never client
- API routes verify `auth.uid()` before any operation

### Encryption at rest

| Layer | Method |
|-------|--------|
| VPS disk | LUKS or Hetzner encrypted volumes |
| Postgres | Supabase default + encrypted backups |
| Storage buckets | Supabase Storage encryption |
| Backups | restic encrypted to Object Storage |

### Audit log

```sql
create table audit_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  workspace_id uuid,
  action text not null,  -- login, export, delete, invite, share
  metadata jsonb,
  ip_address inet,
  created_at timestamptz default now()
);
```

Retention: 90 days (Team tier: 1 year).

### GDPR

User-facing tools: [24-privacy-user-tools.md](24-privacy-user-tools.md). Backend deletion: [22-authentication-and-accounts.md](22-authentication-and-accounts.md).

| Requirement | Implementation |
|-------------|----------------|
| EU hosting | Hetzner Germany/Finland |
| Data export | Settings → Privacy → Download my data (ZIP) |
| Right to deletion | Settings → Privacy → Delete account → cascade saga |
| AVV / DPA | Hetzner DPA + Resend/SES DPA + LemonSqueezy DPA |
| Privacy policy | `rhodes.app/privacy` (draft, legal TBD) |
| Cookie consent | Session only in V1 — minimal banner if analytics added |

### Input validation

- `zod` schemas on all API inputs
- `rate-limiter-flexible` per IP and per user
- File upload: max 50 MB, MIME whitelist (pdf, docx, txt)
- Tika runs in isolated container (no shell execution)

### LLM security

- Prompt injection mitigation: system prompt + chunk-only context
- No tool/function calling in V1
- Worker LLM calls internal network only (Ollama not public)

### Secrets management

- Coolify environment variables
- `.env` in `.gitignore`
- Rotate `SUPABASE_SERVICE_ROLE_KEY` on compromise

### Recommended libraries

| Library | Use |
|---------|-----|
| `@supabase/supabase-js` | Auth + DB client |
| `helmet` | HTTP headers |
| `rate-limiter-flexible` | Rate limiting |
| `zod` | Validation |
| `@supabase/ssr` | Next.js auth cookies |
| `archiver` | GDPR ZIP export |

### Incident response (outline)

1. Detect (monitoring alert)
2. Isolate (disable compromised service)
3. Rotate secrets
4. Notify affected users within 72h if personal data breach (GDPR)

## Open questions

- SOC2 / ISO 27001 roadmap for enterprise tier?
- Penetration test before public launch?

## Dependencies

- [04-data-model.md](04-data-model.md)
- [07-individual-vs-team.md](07-individual-vs-team.md)
- [13-infrastructure-vps.md](13-infrastructure-vps.md)
- [22-authentication-and-accounts.md](22-authentication-and-accounts.md)
- [24-privacy-user-tools.md](24-privacy-user-tools.md)
