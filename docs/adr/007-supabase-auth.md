# ADR 007 — Supabase Auth for Identity

**Status:** accepted  
**Date:** July 2026

## Context

Rhodes needs registration, login, password reset, sessions, optional MFA, and admin user deletion. Options included NextAuth, Clerk, Auth0, or self-hosted Supabase Auth (GoTrue).

## Decision

Use **Supabase Auth** (included in self-hosted Supabase stack) with:
- `@supabase/supabase-js` — client
- `@supabase/ssr` — Next.js App Router cookies

Account deletion and GDPR export are **custom application code** — Supabase does not cascade to app tables.

## Alternatives rejected

| Option | Reason |
|--------|--------|
| NextAuth | Redundant layer; Supabase already provides flows |
| Clerk / Auth0 | Third-party SaaS; conflicts with self-hosted data sovereignty |
| Custom JWT auth | Reinventing GoTrue; security risk |

## Consequences

**Positive:**
- Integrated with RLS via `auth.uid()`
- MFA, OAuth extensible via env config
- No additional auth service to deploy

**Negative:**
- Self-hosted GoTrue requires manual SMTP/OAuth config
- Must build deletion saga ourselves

## Dependencies

- [22-authentication-and-accounts.md](../22-authentication-and-accounts.md)
- [15-security-and-privacy.md](../15-security-and-privacy.md)
