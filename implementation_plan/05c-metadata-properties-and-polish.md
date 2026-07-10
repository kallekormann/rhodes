# Phase 05c — Metadata, Properties, Template Fields & Polish

**Status:** planned  
**Depends on:** Phase 05b  
**Related:** Phase 08 (full metadata admin, teams, sharing)

---

## Objectives

1. Define how **document properties** are declared (workspace schema, template defaults, per-document values).
2. Extend **templates** with description, use cases, and default property values.
3. Design **metadata field types** and UI controls for the Properties sidebar.
4. Enable **Created at** display in Documents list and Editor meta row.
5. Close remaining Phase 05 gaps: signed URL refresh, share-with-team (blocked on teams).

---

## Open tasks

| Task | Priority | Notes |
|------|----------|-------|
| **Created at** in Documents view list rows | done |
| **Created at** in Editor meta row | done |
| Signed URL refresh for document images | P1 | Expired storage URLs after TTL |
| Share document with team members | P2 | **Blocked:** needs team invites + multi-user dev environment (Phase 08) |
| Template **description** editor | P1 | Store in `templates.description` (column exists) |
| Template **use cases** list editor | P1 | Store in `templates.metadata.use_cases[]` (JSONB column addition) |
| Template **default properties** on create | P1 | `templates.metadata.default_properties` copied to new document |
| Workspace **metadata schema** admin UI | P2 | `metadata_schemas` table exists; wire Properties tab |
| Properties tab: render fields from schema | P1 | Replace static stub in `RightPanel` |
| Document `metadata` values editor | P1 | Read/write `documents.metadata` user fields |
| Field type: `text` (label + input) | P1 | |
| Field type: `select` (dropdown) | P1 | Options from schema `options[]` |
| Field type: `tags` (chip input) | P2 | |
| Field type: `date` | P1 | Date picker |
| Field type: `number` | P2 | |
| Field type: `radio` group | P2 | Single select, visible options |
| Field type: `date_range` | P3 | Start + end date |
| Field type: `select_or_text` (dropdown + custom input) | P3 | Hybrid control |
| Metadata-powered **saved views** | P3 | Deferred to V1.5 per `docs/10-templates-and-views.md` |
| Metadata **search/filter** in Documents view | P2 | Filter chips from active metadata |
| Document **relationships** from metadata | P3 | e.g. `related_document_ids[]` in metadata |
| AI metadata extraction on save | P3 | Phase 07/08 |

---

## Data model (current + proposed)

### System fields (automatic)

| Field | Storage | UI |
|-------|---------|-----|
| `created_at` | `documents.created_at` | Documents list, Editor meta |
| `updated_at` | `documents.updated_at` | Documents list, Editor meta |
| `created_by` | `documents.created_by` | Properties tab (read-only) |

### User-defined metadata (workspace schema)

**Schema** — `metadata_schemas` table (per workspace):

```json
{
  "field_key": "status",
  "field_label": "Status",
  "field_type": "select",
  "options": ["draft", "review", "published"]
}
```

**Values** — `documents.metadata` JSONB:

```json
{
  "status": "draft",
  "project": "Q3 Growth",
  "review_date": "2026-08-01",
  "favorite": true,
  "archived": false,
  "comments": []
}
```

Reserved keys in `metadata`: `favorite`, `archived`, `template_draft`, `comments` — user schema keys must not collide (validate on schema create).

### Template-specific fields

| Field | Storage | Shown in |
|-------|---------|----------|
| Name | `templates.name` | Editor title when editing template |
| Description | `templates.description` | Template sidebar |
| Use cases | `templates.metadata.use_cases` (proposed) | Template sidebar |
| Default properties | `templates.metadata.default_properties` (proposed) | Copied to `documents.metadata` on **Use** |
| Structure | `templates.structure_json` | Document body on **Use** |

**Migration needed:** `templates.metadata jsonb default '{}'` if not present.

### On document create from template

```
POST /api/documents { template_id, title }
  → content = stripTitle(template.structure_json)
  → metadata = { ...template.metadata.default_properties }
```

### Future use cases for metadata

| Use | How |
|-----|-----|
| Find relationships | `metadata.related_docs[]`, entity links, `@document` refs in content |
| Saved views | `views.filter_json` queries `documents.metadata.*` |
| Search/filter | Postgres JSONB operators + `content_plain` full-text |
| AI context | Pass metadata + summary to RAG pipeline (Phase 07) |

---

## Field types → UI components

| `field_type` | Component | Schema extras |
|--------------|-----------|---------------|
| `text` | `Input` | `placeholder?` |
| `textarea` | `TextArea` | `rows?` |
| `select` | `Select` / searchable dropdown | `options: string[]` |
| `radio` | Radio group | `options: string[]` |
| `tags` | Tag chip input | `suggestions?` |
| `date` | Date picker | — |
| `date_range` | Two date pickers | — |
| `number` | Number input | `min?`, `max?` |
| `select_or_text` | Select + "Other" text field | `options: string[]` |

Admin defines options in **Settings → Space → Custom fields** (Phase 08) or interim API `POST /api/metadata-schemas`.

---

## Canonical spec references

- [docs/08-metadata-system.md](../docs/08-metadata-system.md)
- [docs/10-templates-and-views.md](../docs/10-templates-and-views.md)
- [docs/04-data-model.md](../docs/04-data-model.md)

---

## Exit criteria

1. Created at visible in Documents view and Editor.
2. Template description + use cases editable for owned templates.
3. Properties tab renders at least `text`, `select`, `date` from workspace schema.
4. New document from template inherits default property values.
5. Signed URL refresh implemented for images.
