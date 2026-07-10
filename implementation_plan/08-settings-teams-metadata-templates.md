# Phase 08 — Settings, Teams, Metadata, and Templates

**Status:** planned  
**Depends on:** Phase 07  
**Blocks:** Phases 09–12  
**Estimated duration:** 7–10 days

---

## Objectives

1. Complete **Settings overlay** per spec (Profile, Security, Preferences, Spaces, Team, Billing/Privacy placeholders).
2. Implement **team workspaces**: create, invite, roles.
3. Wire **Properties tab** with workspace metadata fields.
4. Finish **templates** and **document version history**.
5. Port remaining editor features: **comments**, **block drag-drop** (if deferred from Phase 05).

---

## Prerequisites

- Phase 07 exit criteria met.
- Right Panel shell exists with Properties stub.

---

## Canonical spec references

- [23-user-settings-and-spaces.md](../docs/23-user-settings-and-spaces.md)
- [07-individual-vs-team.md](../docs/07-individual-vs-team.md)
- [08-metadata-system.md](../docs/08-metadata-system.md)
- [09-document-history.md](../docs/09-document-history.md)
- [10-templates-and-views.md](../docs/10-templates-and-views.md)
- [26-ui-mock-reference.md](../docs/26-ui-mock-reference.md) — SettingsView, comments

---

## Docker services touched

| Service | Usage |
|---------|-------|
| `supabase-storage` | Avatar uploads |
| `supabase-auth` | Password change |
| Mailpit / relay | Team invite emails (stub until Phase 12) |

---

## File checklist

```
apps/web/src/
├── views/SettingsView.tsx          # All sections
├── app/api/
│   ├── profile/route.ts
│   ├── workspaces/
│   │   ├── route.ts                # Create personal/team space
│   │   └── [id]/invite/route.ts
│   ├── metadata-schemas/route.ts
│   └── documents/[id]/versions/route.ts
├── components/settings/
│   ├── ProfileSection.tsx
│   ├── SecuritySection.tsx
│   ├── PreferencesSection.tsx
│   ├── SpacesSection.tsx
│   └── TeamSection.tsx
├── components/editor/comments/       # If not done in Phase 05
│   ├── CommentMarker.tsx
│   ├── CommentNoteBubble.tsx
│   └── CommentPopover.tsx
└── hooks/
    ├── useMetadata.ts
    └── useDocumentVersions.ts
```

---

## Step-by-step tasks

### 1. Settings overlay structure

Port `SettingsView.tsx` from mock:
- Full-screen overlay with left nav
- Back link (`NavLink` + `ArrowLeft`) → return to editor
- Sections: Profile, Security, Preferences, Spaces, Team, Billing, Privacy

### 2. Profile section

Per [23-user-settings-and-spaces.md](../docs/23-user-settings-and-spaces.md):
- Display name (`Input`)
- Email (disabled, from auth)
- Avatar upload → `storage/avatars/{user_id}`
- Language dropdown (stub until Phase 10)
- Theme radio: System / Light / Dark → updates `profiles` + `data-theme`

### 3. Security section

- Change password: `supabase.auth.updateUser({ password })` — require current password
- Sign out everywhere: `signOut({ scope: 'global' })`
- MFA: placeholder "Coming in V1.5"

### 4. Preferences section

- Default workspace selector
- Email preferences toggles (`email_preferences` JSONB)
- Insight debounce display (read-only; tier-gated in Phase 11)

### 5. Spaces section

**Multiple personal spaces** (Option B from settings spec):
- List personal + team spaces
- Switch active space
- Create personal space (`SpaceCreateModal`)
- Create team space (`SpaceCreateModal` with team flag)
- Rename / delete (owner only)

**API `POST /api/workspaces`:**
```typescript
// Body: { name, is_team_workspace: boolean }
// Creates workspace + owner membership
```

### 6. Team section

- List members with roles (owner, admin, member)
- Invite by email → `workspace_invites` row + token
- Accept invite flow: `/invite/{token}` → add `workspace_members`
- Role management: admin can change member roles; owner can transfer ownership
- Remove member (admin+)

Invite email: stub with Mailpit; real templates in Phase 12.

### 7. Billing / Privacy placeholders

- Billing: "Upgrade to Pro" button disabled with "Configure in Phase 11"
- Privacy: links to export/delete (built Phase 12)

### 8. Properties tab (Right Panel)

Wire plain-variant fields from mock:
- Status (`Dropdown` with options from metadata schema)
- Owner (read-only, `created_by` display name)
- Summary (`TextArea`)
- Due date (`DatePickerField`)
- Date range (`DateRangePicker`)

**Metadata system:**
- Load `metadata_schemas` for workspace
- Read/write `documents.metadata` JSONB keys
- Default schema seeded: `status`, `owner`, `summary`, `due_date`

### 9. Document version history

Per [09-document-history.md](../docs/09-document-history.md):
- On significant save: insert `document_versions` snapshot
- Properties tab or ⓘ link: "View history"
- List versions with timestamp + author
- Restore version → PATCH document content

Throttle: max 1 version per 5 min per document (avoid spam).

### 10. Templates (complete)

- System templates from seed migration
- User templates: create from current document structure
- `TemplatesView` + `TemplateDetailPanel` from mock
- `+` menu → "From template" → inject `structure_json` → new document

### 11. Saved views (V1.5 stub)

- Table exists; UI shows "Coming soon" in Documents view
- Or basic filter save if time allows

### 12. Editor comments (if deferred)

Port from mock:
- `CommentPopover` in bubble menu → add comment on selection
- `CommentMarker` in right gutter (gray, not accent)
- Hover marker → highlight anchor spans
- Click → thread in gutter (`CommentNoteBubble`)

Store comments in `documents.metadata.comments` array for V1 (structured migration to table in V2).

### 13. Block drag-and-drop (if deferred)

Port `BlockDragHandle`, `BlockDropZone`, `editorBodyUtils.ts` — adapt for TipTap node dragging or defer.

---

## Environment variables

No new vars. Uses existing Supabase + storage config.

---

## Testing checklist

- [ ] Profile: update display name, avatar upload
- [ ] Theme preference persists across sessions
- [ ] Change password works
- [ ] Create second personal workspace; switch between spaces
- [ ] Create team workspace
- [ ] Invite member → accept invite → member sees team space
- [ ] Role restrictions: member cannot invite; admin can
- [ ] Properties tab: edit status, due date, summary → saved in metadata
- [ ] Version history: save → new version → restore old version
- [ ] Template creates structured document
- [ ] Comments: add, hover highlight, thread display (if implemented)
- [ ] Sole owner cannot delete account without transfer (stub warning)

---

## Exit criteria

1. Settings overlay fully navigable with Profile, Security, Preferences, Spaces, Team implemented.
2. Team workspaces with invite flow work (email stub OK).
3. Properties tab edits document metadata.
4. Document version history with restore.
5. Templates flow complete.
6. Billing/Privacy show placeholders pointing to Phases 11–12.

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Invite token security | UUID token, 7-day expiry, single use |
| Metadata schema migration | Seed defaults per workspace on create |
| TipTap comment anchors | Use ProseMirror marks; not char offsets |
| Scope creep on views V1.5 | Explicit stub |

---

## Deliverables

- Complete SettingsView with 6+ sections
- Workspace CRUD + team invites
- Properties tab with metadata
- Document version history
- Templates gallery + detail panel
- Comments + drag-drop (if scheduled)

**Merge:** PR `feature/phase-08-settings` → `dev` → `main` when exit criteria met.
