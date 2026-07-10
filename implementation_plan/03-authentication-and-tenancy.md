# Phase 03 — Authentication and Tenancy

**Status:** complete  
**Depends on:** Phase 02  
**Blocks:** Phase 04  
**Estimated duration:** 4–6 days

---

## Objectives

1. Integrate **Supabase Auth** with Next.js App Router (`@supabase/ssr` cookie sessions).
2. Build minimal auth UI pages (login, register, forgot/reset password, verify).
3. Auto-provision **private workspace** on user signup via Postgres trigger.
4. Enforce **RLS** on all content tables; prove cross-workspace access is denied.
5. Configure dev email via Mailpit; document production SMTP mapping for VPS.

---

## Prerequisites

- Phase 02 exit criteria met (migrations, web app running).
- Mailpit running (Phase 01).
- RLS policies migration file exists (may need expansion this phase).

---

## Canonical spec references

- [22-authentication-and-accounts.md](../docs/22-authentication-and-accounts.md)
- [07-individual-vs-team.md](../docs/07-individual-vs-team.md)
- [04-data-model.md](../docs/04-data-model.md) — profiles, workspace bootstrap
- [15-security-and-privacy.md](../docs/15-security-and-privacy.md)
- [adr/007-supabase-auth.md](../docs/adr/007-supabase-auth.md)
- [18-non-functional-requirements.md](../docs/18-non-functional-requirements.md) — DoD #1 (RLS)

---

## Docker services touched

| Service | Usage |
|---------|-------|
| `supabase-auth` (GoTrue) | Signup, login, verify, reset |
| `supabase-kong` | Auth API routes |
| `mailpit` | Capture verification + reset emails |

---

## File checklist

```
apps/web/src/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx              # Minimal chrome, centered card
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   └── verify/page.tsx         # Email confirmation callback
│   ├── (app)/
│   │   ├── layout.tsx              # Protected shell (placeholder until Phase 04)
│   │   └── page.tsx                # Redirect to editor
│   └── auth/callback/route.ts      # OAuth/code exchange (future)
├── middleware.ts                     # Session refresh + route protection
└── lib/
    ├── supabase/
    │   ├── client.ts               # Browser client
    │   ├── server.ts               # Server component client
    │   └── middleware.ts           # Middleware helper
    └── auth/
        ├── schemas.ts              # Zod: login, register, reset
        └── rate-limit.ts           # rate-limiter-flexible

packages/db/migrations/
└── 00006_auth_triggers.sql         # Signup → workspace + profile

apps/web/src/app/api/auth/
└── (rate-limited routes if custom wrappers needed)

apps/web/tests/ or packages/db/tests/
└── rls.test.ts                     # Cross-workspace denial test
```

---

## Step-by-step tasks

### 1. Supabase SSR setup

Follow [Supabase Next.js SSR guide](https://supabase.com/docs/guides/auth/server-side/nextjs):

**`middleware.ts`:**
- Refresh session on each request
- Redirect unauthenticated users from `(app)` routes to `/auth/login`
- Redirect authenticated users from `(auth)` routes to `/`

**Cookie config:** `httpOnly`, `Secure` in production, `SameSite=Lax`.

### 2. Auth UI pages

Minimal design per [03a-design-language.md](../docs/03a-design-language.md):
- Centered card, 400px max width
- `Input`, `Button` components (stub minimal versions; full port in Phase 04)
- No app header on auth pages

| Route | Actions |
|-------|---------|
| `/auth/register` | `signUp({ email, password })` → "Check your email" |
| `/auth/login` | `signInWithPassword` → redirect `/` |
| `/auth/forgot-password` | `resetPasswordForEmail` |
| `/auth/reset-password` | `updateUser({ password })` from recovery token |
| `/auth/verify` | Handle email confirmation redirect |

### 3. Signup trigger (workspace bootstrap)

**`00006_auth_triggers.sql`:**
```sql
create or replace function handle_new_user()
returns trigger as $$
declare
  ws_id uuid;
begin
  insert into profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));

  insert into workspaces (name, is_team_workspace)
  values ('Private', false)
  returning id into ws_id;

  insert into workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

Supports **multiple personal spaces** later (Phase 08); first space auto-created at signup.

### 4. RLS policies (complete)

For each table (`documents`, `library_sources`, `library_source_chunks`, `document_versions`, `templates`, `metadata_schemas`, `workspace_invites`):

```sql
-- Example: documents
create policy "members_select" on documents
  for select using (is_workspace_member(workspace_id));
create policy "members_insert" on documents
  for insert with check (is_workspace_member(workspace_id));
create policy "members_update" on documents
  for update using (is_workspace_member(workspace_id));
create policy "members_delete" on documents
  for delete using (is_workspace_member(workspace_id));
```

`workspaces` / `workspace_members`: user can see workspaces they belong to.

`profiles`: user can read/update own row only.

### 5. Rate limiting

**`lib/auth/rate-limit.ts`:**
- Register: 5 requests / IP / hour
- Login: 10 attempts / email / 15 min → lockout message
- Password reset: 3 requests / email / hour

Apply in API route wrappers or server actions.

### 6. GoTrue SMTP (dev)

In `docker-compose.dev.yml` / `.env`:
```env
GOTRUE_SMTP_HOST=mailpit
GOTRUE_SMTP_PORT=1025
GOTRUE_MAILER_AUTOCONFIRM=false
GOTRUE_SITE_URL=http://localhost:3000
```

Verification links must point to `http://localhost:3000/auth/verify`.

### 7. RLS automated test

**`packages/db/tests/rls.test.ts`:**
1. Create user A + workspace A + document A
2. Create user B + workspace B
3. As user B, attempt `select` on document A via Supabase client with B's JWT
4. Assert: empty result or permission error

Run in CI with ephemeral Postgres.

### 8. Session + logout

- Logout: `signOut({ scope: 'global' })` clears cookies
- On logout: clear any client-side active workspace ID (localStorage key `rhodes:active_workspace`)

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin ops only (tests, seed) — **never client** |
| `GOTRUE_SITE_URL` | Auth redirect base |
| `GOTRUE_SMTP_*` | Email via Mailpit (dev) |

---

## Testing checklist

- [ ] Register new user → email appears in Mailpit
- [ ] Click verify link → account confirmed
- [ ] Login → redirected to app shell
- [ ] `workspaces` row created (`Private`, `is_team_workspace = false`)
- [ ] `workspace_members` row created (`role = owner`)
- [ ] `profiles` row created
- [ ] Unauthenticated access to `/` redirects to login
- [ ] Forgot password → reset email in Mailpit → password updated
- [ ] Logout → session cleared → redirect login
- [ ] RLS test: user B cannot read user A's document
- [ ] Rate limit: 11th login attempt blocked

---

## Exit criteria

1. Full register → verify → login flow works with Mailpit.
2. Private workspace auto-provisioned on signup.
3. All content tables have RLS; automated cross-workspace denial test passes.
4. Auth pages render with minimal chrome.
5. Rate limiting active on auth endpoints.
6. Documented GoTrue SMTP env mapping for VPS (Resend/SES) in README.

**VPS note:** Auth is built and tested locally. Phase 13 re-validates with HTTPS cookies and real SMTP relay.

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| GoTrue redirect URL mismatch | Match `GOTRUE_SITE_URL` and Next.js `APP_URL` exactly |
| Trigger fails silently | Log trigger errors; test in seed script |
| Service role key leaked | ESLint rule: ban import in `apps/web/src` client components |
| Cookie issues on localhost | Use `http://localhost:3000` consistently (not 127.0.0.1) |

---

## Deliverables

- Supabase SSR middleware + clients
- Auth pages (5 routes)
- Signup trigger migration
- Complete RLS policies
- Rate limiting
- RLS automated test

**Merge:** PR `feature/phase-03-auth` → `dev` → `main` when exit criteria met.
