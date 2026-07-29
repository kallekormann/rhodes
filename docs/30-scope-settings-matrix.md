# 30 — Scope settings & policy matrix

**Status:** draft (M2 Wave 0)

## Context

Policies are stored in `organizations.policy` (org ceiling) and `scope_policies.policy` (per workspace). Team/private policies must be **equal or stricter** than org ceiling (validated server-side in M2.4+).

M2 stores policies and gates UI/invites. M7 enforces library/RAG cross-scope reads.

## Org policy (`organizations.policy`)

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `guests_allowed` | bool | `false` | Ceiling for all org teams |
| `who_can_invite_guests` | enum | `admin` | `owner` \| `admin` \| `member` \| `request_approval` |
| `default_team_visibility` | enum | `isolated` | `isolated` \| `org_catalog` |
| `cross_team_content_default` | enum | `team_only` | `none` \| `team_only` \| `org_wide` \| `selected_teams` |
| `external_sharing_default` | enum | `document_only` | `blocked` \| `document_only` \| `guest_allowed` |
| `who_can_create_teams` | enum | `admin` | `owner` \| `admin` \| `org_member` |

## Private scope policy (`scope_policies` for `is_team_workspace = false`)

| Key | Type | Default | M2 enforces |
|-----|------|---------|-------------|
| `cross_private_sharing` | enum | `isolated` | Settings UI |
| `external_collaborators` | enum | `guests_only` | Invite gate |
| `default_collaborator_role` | enum | `viewer` | Invite default |
| `collaborator_can_invite` | enum | `false` | Share API |
| `content_sharing_outbound` | enum | `documents` | Share-to-team API |

`content_sharing_outbound`: `none` \| `documents` \| `documents_and_library`

## Team scope policy (`scope_policies` for `is_team_workspace = true`)

| Key | Type | Default | M2 enforces |
|-----|------|---------|-------------|
| `org_sharing` | enum | `team_only` | Settings UI |
| `external_collaborators` | enum | `org_members_only` | Invite gate |
| `default_member_role` | enum | `member` | Invite wizard |
| `default_guest_role` | enum | `viewer` | Guest invite |
| `collaborator_can_invite` | enum | `team_members_only` | Share API |
| `content_sharing_outbound` | enum | `team_only` | Share API |
| `content_sharing_inbound` | enum | `org_teams_only` | Accept inbound shares |

`content_sharing_inbound`: `none` \| `org_teams_only` \| `linked_private` \| `any_member_private`

## Document share (existing — not policy table)

| Field | Values | Default for team share |
|-------|--------|------------------------|
| `permission` | `read` \| `edit` | `read` |
| `grantee_type` | `user` \| `workspace` | `workspace` |

Cross-scope sharing uses `document_shares` only — no `workspace_id` change.

## Matrix: who can share private doc to team?

| Source policy `content_sharing_outbound` | Target policy `content_sharing_inbound` | Result |
|------------------------------------------|----------------------------------------|--------|
| `none` | any | Block |
| `documents` | `any_member_private` | Allow (view/edit per grant) |
| `documents` | `linked_private` | Allow if scope_link exists |
| `documents` | `org_teams_only` | Allow if target is org team, same org |
| `documents` | `none` | Block |

Full ACL for library citations in team Ask: M7.

## Scope links (`scope_links`)

| `link_type` | Meaning |
|-------------|---------|
| `private_peer` | Private scope ↔ private scope |
| `org_team` | Team ↔ team within org |
| `org_wide` | Org catalog visibility |

Used for picker visibility and M7 RAG bounds.

## Dependencies

- [07-individual-vs-team.md](07-individual-vs-team.md)
- [29-use-cases-views-templates.md](29-use-cases-views-templates.md)
