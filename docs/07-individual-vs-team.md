# 07 — Individual vs Team

**Status:** draft

## Context

Users work alone (Private Space) and in teams (Team Spaces). AI, RLS, and UX must prevent accidental data leakage while keeping orientation simple.

## Decision

- Strict **space-level isolation** for all data and AI queries in V1
- No cross-space retrieval without explicit future "Bridge Mode"
- Default personal space auto-created at signup; users may create additional personal spaces

## Specification

### Space types

| Type | `is_team_workspace` | Members | AI scope |
|------|---------------------|---------|----------|
| Personal | `false` | Owner only | That space's docs + library only |
| Team | `true` | Invited members | All team docs + library |

### User with both personal and team data

A user typically has:
- 1+ **Personal Spaces** (private, owner-only) — default `Private` auto-created at signup; user may create more for separate projects (book, research, etc.)
- 0–N **Team Spaces** (invited or created)

**Rule:** Only **one space active** at a time. Header Space switcher makes context explicit.

When in a Personal Space:
- AI never surfaces team documents or other personal spaces
- Library shows only that space's imports

When in Team Space:
- AI searches entire team knowledge pool
- User's private docs remain invisible

### Roles

| Role | Permissions |
|------|-------------|
| Owner | Delete space, manage billing, all content |
| Admin | Invite/remove members, manage templates |
| Member | Read/write documents and library |

V1: no document-level permissions. V2: `visibility` field (`team`, `private-in-team`).

### Signup bootstrap

```sql
-- Pseudocode trigger on auth.users insert
insert into workspaces (name, is_team_workspace) values ('Private', false);
insert into workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new_user_id, 'owner');
```

#### Create personal space

1. Header scope switcher → Personal → "New personal space", or Settings → Spaces → Create
2. Enter name → `workspaces` insert (`is_team_workspace = false`)
3. Creator is sole Owner (no invites)
4. Limit by plan (e.g. Free: 1 personal, Pro: up to 10) — see [25-billing-lemonsqueezy.md](25-billing-lemonsqueezy.md)

Personal spaces are **not** team spaces with zero members — same isolation model, different UX section and no sharing.

### Edge cases

| Scenario | Behavior |
|----------|----------|
| User removed from team | Loses access immediately (RLS); local IndexedDB cache purged on next sync |
| User in team + writes similar private doc | No cross-hint between spaces |
| User with multiple personal spaces | Same isolation as between personal and team — switch scope to access |
| Free tier team spaces | 0 team spaces; Pro/Team unlocks |
| Invite flow | Email via managed relay → accept link → `workspace_members` insert — see [23-user-settings-and-spaces.md](23-user-settings-and-spaces.md) |

### Signup bootstrap

On registration, Supabase Auth trigger creates Private workspace — see [22-authentication-and-accounts.md](22-authentication-and-accounts.md).

### Future: Bridge Mode (V2, not V1)

Explicit user consent to search across Private + one Team space for a single query. UI shows mixed results with space badges. Off by default.

## Open questions

- Personal space limits per billing tier (Free: 1 default only vs Pro: N)?
- Can one user own multiple team spaces on Team tier?
- Guest/read-only role needed?

## Dependencies

- [04-data-model.md](04-data-model.md)
- [05-ai-and-rag.md](05-ai-and-rag.md)
- [14-email-delivery.md](14-email-delivery.md)
- [22-authentication-and-accounts.md](22-authentication-and-accounts.md)
- [23-user-settings-and-spaces.md](23-user-settings-and-spaces.md)
- [25-billing-lemonsqueezy.md](25-billing-lemonsqueezy.md)
