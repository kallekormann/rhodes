# Phase 15 — Scopes, orgs, teams & settings (M2)

**Status:** in progress  
**Milestone:** M2  
**Depends on:** M1 (collab, offline, storage)  
**Blocks:** M3 realtime, M6 views, M7 RAG ACLs, M8 org billing

---

## Objective

Introduce organizations as an optional container over team scopes, keep private scopes permanently personal, unify scope setup wizards, and ship cross-scope **sharing** (not document relocation) with policy gates. Full RAG cross-scope reads land in M7.

---

## Product decisions (locked)

| Topic | Decision |
|-------|----------|
| Private scopes | Always `org_id IS NULL`; never join an org |
| Teams without org | Allowed when tier permits (`team_scopes.create`) |
| Org vs team | Separate capabilities: `org.create` ≠ `team_scopes.create` |
| Cross-scope docs | **Share** via `document_shares` (workspace grant); doc stays in author's private scope |
| Publish language | UI may say “Share with team” / “Published to…” — same API as share |
| Permissions | **Can view** (default) or **Can edit** per grantee; live single document |
| Enforcement | M2: policies + invite/share UI gates; M7: library/RAG ACL |

See also: [docs/07-individual-vs-team.md](../docs/07-individual-vs-team.md), [docs/30-scope-settings-matrix.md](../docs/30-scope-settings-matrix.md).

---

## Delivery waves

### Wave 0 — Spec artifacts — **done**

| Doc | Status |
|-----|--------|
| This file | done |
| [docs/29-use-cases-views-templates.md](../docs/29-use-cases-views-templates.md) | done |
| [docs/30-scope-settings-matrix.md](../docs/30-scope-settings-matrix.md) | done |
| [docs/07](../docs/07-individual-vs-team.md) | updated |

### M2.1 — Onboarding shell — **done**

| Item | Status |
|------|--------|
| `OnboardingGate` in `AppShell` | done |
| Personal onboarding (display name) | done |
| Pro/Team tier fork (Just me / Set up org) | done |
| Org setup (`POST /api/organizations`) | done |
| Org upgrade onboarding (blocking shell) | done (attach teams deferred) |
| `PATCH /api/profile/onboarding` | done |
| Profile flags wired in `(app)/layout` | done |

**Deferred:** team migration on org upgrade (options B/C), full `ScopeSetupWizard` modes (M2.5)

### M2.2 — Data model — **done**

| Item | Status |
|------|--------|
| `organizations`, `organization_members` | done |
| `workspaces.org_id`, `workspaces.scope_policy_id` | done |
| `scope_policies`, `scope_links`, `scope_collaborators` | done |
| Profile onboarding columns | done |
| RLS + `is_org_member`, `is_org_admin`, `workspace_org_id` | done |
| Tier `org.create`; free/basic `teamScopes` → 1 / 2 | done |
| Types in `packages/db/src/types.ts` | done |
| RLS tests (org isolation) | done |

Migrations: `00050_organizations_and_scope_policies.sql`, `00051_organization_insert_rls_fix.sql`, `00052_org_select_creator_policy.sql`

**Not in M2.2 (deferred):** `/api/organizations` routes, org creation UI, default policy seeding on workspace create

### M2.3 — Scope picker v2 — **done**

- Personal world (private + standalone teams) vs Org world (org teams)
- Solo-pro-as-org UX (collapsed single-team org)
- `org_id` on scope model; org team create via workspace API

### M2.4 — Settings catalog — **done**

- Sharing, views, templates, collaborators per scope/org
- `GET/PATCH /api/workspaces/[id]/policy`, `GET/PATCH /api/organizations/[id]/policy`
- Settings nav: Account | Scope switcher; Sharing, Views, Templates (placeholder), Collaborators (placeholder), Organization (org admins)
- Policy types in `@rhodes/shared/scope-policies`; view catalog in `scope-views`
- Policy GET returns defaults without admin insert; PATCH persists rows
- Settings URL synced client-side after mount (avoids Next.js `AsyncMetadataOutlet` hydration drift)
- **Deferred:** share API enforcement (M2.5b), Templates wizard (M2.5), Collaborators/guests (M2.6)

### M2.5 — ScopeSetupWizard — **in progress**

Sub-phases (see plan `m2.5_scopesetupwizard`):

| Sub-phase | Status | Scope |
|-----------|--------|-------|
| M2.5.0 Foundation | **done** | `scope-bundles`, `view-template-affinity`, `scope-composition`, DB migration, `applyScopeComposition`, API |
| M2.5.1 Wizard shell | **done** | Composition workspace UI |
| M2.5.2 Core templates | **done** | Properties-native templates + hydrate fix + authoring guideline ([docs/34](../docs/34-template-authoring.md)) |
| M2.5.3 Pilot bundle KB | **done** | Knowledge Base & Operations |
| M2.5.4 Bundle: Growth & Experimentation | **done** | `relation`/`status` field types (Phase 0) + A/B Experiment, Insight, Problem, Scientific Experiment |
| M2.5.5 Bundle: Product Architecture & Decisions | **done** | ADR, Technical Requirements Document, Workflow Definition — decision log Kanban + architecture wiki |
| M2.5.6 Bundle: Product Discovery & UX | **done** | PRD, Product Feature, User Flow Definition, SWOT Analysis — feature board Kanban + roadmap Gantt |
| M2.5.7 Bundle: GTM & Project Execution | **done** | Project Charter, GTM Plan, Launch Checklist, Status Report — launch timeline Gantt + status dashboard |
| M2.5.8 Bundle: Content & Campaign Marketing | **done** | Campaign Brief, Content Calendar Item, SEO Brief, Social Post Batch — content calendar + pipeline Kanban |

- Modes: `onboarding_personal`, `onboarding_org`, `onboarding_org_upgrade`, `create_*`, `settings_reconfigure`
- Bidirectional view↔template inference; multi-bundle; non-limiting composition
- Extends `ScopeCreateWizard.tsx` → `ScopeSetupWizard.tsx`

### M2.5b — Cross-scope sharing UX — **pending**

- SharePopover team picker + “Shared with us” list
- Policy gates on share API
- No transfer/edition pipeline

### M2.6 — Guests & invite-by-link — **pending**

- Guest/collaborator roles, `can_delegate_invite`, copy-link invites

---

## Data model summary

```
organizations ──< organization_members
organizations ──< workspaces (org_id, team scopes only)
workspaces ── scope_policies (scope_policy_id)
scope_links (source_workspace_id → target_workspace_id)
scope_collaborators (workspace_id, user_id, guest role)
document_shares (existing — cross-scope share grants)
```

**Two worlds in UI:** `org_id IS NULL` → Personal section; `org_id SET` → Org section.

---

## Tier matrix (M2 changes)

| Tier | personal | team (standalone OK) | `org.create` |
|------|----------|----------------------|--------------|
| free | 1 | 1 | no |
| basic | 5 | 2 | no |
| pro | ∞ | 3 | yes |
| team | ∞ | ∞ | yes |

---

## Exit criteria (M2)

1. User can create standalone team without org (tier permitting).
2. Pro user can create org + org team; private scopes stay personal.
3. Share to team from private scope works with view/edit permission.
4. Team scope shows “Shared with us” documents.
5. Scope policies stored and editable in settings (enforcement stubs OK for library until M7).
6. Post-upgrade org onboarding flow complete (M2.1 + M8 hook).

---

## Related

- Plan: `.cursor/plans/m2_scope_platform_0fa5080a.plan.md`
- [docs/28-product-roadmap-to-production.md](../docs/28-product-roadmap-to-production.md)
- [implementation_plan/21-library-rag-scopes.md](21-library-rag-scopes.md) (M7 — to write)
