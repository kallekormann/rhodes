# 07 — Individual vs Team vs Organization

**Status:** draft (updated M2)

## Context

Users work alone (private scopes), in teams (team scopes), and optionally inside an **organization** container. AI, RLS, and UX must prevent accidental data leakage while keeping orientation simple.

## Decision

- Strict **scope-level isolation** for data and AI queries by default
- Cross-scope document access via **`document_shares`** (share grants) — document stays in author's scope
- Default private scope auto-created at signup; users may create additional private scopes and standalone teams per tier
- Organizations are **optional**; private scopes **never** join an org

## Specification

### Scope types

| Type | `is_team_workspace` | `org_id` | Members | AI scope (active) |
|------|---------------------|----------|---------|-------------------|
| Private | `false` | `NULL` | Owner (+ guests via collaborators) | That scope's docs + library |
| Standalone team | `true` | `NULL` | Invited members | Team docs + library + shared-in docs (M7) |
| Org team | `true` | set | Org + team members | Same as team |

### Two worlds (scope picker)

| UI section | Contains |
|------------|----------|
| **Personal** | Private scopes + standalone teams (`org_id IS NULL`) |
| **Organization** | Org container + teams where `org_id` is set |

Only **one scope active** at a time. Header scope switcher makes context explicit.

### Cross-scope sharing (M2.5b)

Users share **their** documents outward; the document **remains** in the author's private scope.

| Action | Mechanism | Updates |
|--------|-----------|---------|
| Share with person | `document_shares` grantee `user` | Live |
| Share with team (“publish”) | `document_shares` grantee `workspace` | Live |
| Permission | `read` (default) or `edit` | Per grantee |

Team members find shared docs under **Shared with [Team]** in Documents view.

No document relocation, editions, or re-publish flow in M2.

### Roles

**Workspace (`workspace_members`):**

| Role | Permissions |
|------|-------------|
| Owner | Delete scope, manage members, all content |
| Admin | Invite/remove members, manage templates |
| Member | Read/write documents and library |
| Viewer | Read-only (team scopes) |

**Organization (`organization_members`):**

| Role | Permissions |
|------|-------------|
| Owner | Org settings, billing (M8), attach teams |
| Admin | Org policies, create org teams (per policy) |
| Member | Access org teams they belong to |

**Guests (`scope_collaborators`):** M2.6 — explicit collaborator on a scope without full membership.

### When in a private scope

- AI searches that scope's docs + library only (plus M7 shared-out bounds)
- User can share documents to teams with view/edit permission

### When in a team scope

- AI searches team pool (+ docs shared **to** this team in M7)
- User's unshared private docs remain invisible

### Tier limits (M2)

| Tier | Personal scopes | Team scopes | Org |
|------|-----------------|-------------|-----|
| free | 1 | 1 | no |
| basic | 5 | 2 | no |
| pro | ∞ | 3 | optional |
| team | ∞ | ∞ | yes |

See [25-billing-lemonsqueezy.md](25-billing-lemonsqueezy.md).

### Signup bootstrap

On registration, auth trigger creates default `"Private"` workspace — see [22-authentication-and-accounts.md](22-authentication-and-accounts.md).

### Edge cases

| Scenario | Behavior |
|----------|----------|
| User removed from team | Loses access immediately (RLS) |
| Doc shared to team with `read` | Team can view; author edits live in private scope |
| Doc shared with `edit` | Team co-edits same document |
| Share to multiple teams | Multiple `document_shares` rows, one document |
| User upgrades to org tier | Org upgrade onboarding (M2.1); private scopes stay personal |
| Attach team to org | `workspaces.org_id` set; team moves to Org section in picker |

### Future

- **Bridge Mode** — explicit cross-scope Ask with consent (M7+)
- **Share as template** — force-copy for playbooks (separate from live share)

## Dependencies

- [04-data-model.md](04-data-model.md)
- [05-ai-and-rag.md](05-ai-and-rag.md)
- [29-use-cases-views-templates.md](29-use-cases-views-templates.md)
- [30-scope-settings-matrix.md](30-scope-settings-matrix.md)
- [implementation_plan/15-scopes-org-teams-settings.md](../implementation_plan/15-scopes-org-teams-settings.md)
