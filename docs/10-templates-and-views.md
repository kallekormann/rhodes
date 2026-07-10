# 10 — Templates and Views

**Status:** draft

## Context

Templates accelerate structured writing. Views (saved filters) scale document discovery without adding permanent navigation chrome.

## Decision

- System templates in repo; user templates in DB with team sharing
- Template page is **transient** (on-demand), not app home
- Views via search/Cmd+K in V1.5 — no dashboard

## Specification

### System templates (V1)

| Template | Sections |
|----------|----------|
| Blank | Empty doc |
| Meeting Minutes | Attendees, Agenda, Notes, Action Items |
| Report | Summary, Findings, Recommendations |
| Product Spec | Problem, Goals, Requirements, Out of Scope |

Stored as JSON TipTap document trees in `rhodes-app/templates/`.

### User templates

```sql
-- templates table
is_system = false
is_shared = true  -- visible to all space members
workspace_id = <team space id>
structure_json = { ... TipTap JSON ... }
```

| Action | Who |
|--------|-----|
| Create personal template | Any member |
| Share to team | Owner, Admin (or creator with `is_shared`) |
| Edit team template | Owner, Admin |
| Use template | Any member |

**Create flow:** Save current document as template via ⓘ sidebar or Cmd+K "Save as template".

### Template page UX

- Triggered only from `+` → "From template"
- Not shown on app launch
- Shows system + shared + personal templates
- Recent documents below (max 5)

### Saved views (V1.5)

```json
{
  "name": "Draft Specs",
  "filter_json": {
    "metadata.status": "draft",
    "metadata.type": "spec"
  },
  "sort_json": { "field": "updated_at", "dir": "desc" }
}
```

**Access:**
- Cmd+K → "View: Draft Specs"
- Search overlay → filter chips when view active

Results open in search overlay — clicking opens document in editor. No separate list screen.

## Open questions

- Template marketplace across workspaces (never V1)?
- Default template per user preference?

## Dependencies

- [03-ux-ui-design.md](03-ux-ui-design.md)
- [04-data-model.md](04-data-model.md)
- [08-metadata-system.md](08-metadata-system.md)
- [11-editor-tiptap.md](11-editor-tiptap.md)
