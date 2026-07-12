# Phase 05c — Metadata, Properties, Template Fields & Polish

**Status:** complete  
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
| Signed URL refresh for document images | done | `resolveDocumentImageUrls` on editor hydration |
| Share document with team members | P2 | **Blocked:** needs team invites + multi-user dev environment (Phase 08) |
| Template **description** editor | done | Properties tab in template edit mode (`?template=`) |
| Template **use cases** list editor | done | `templates.metadata.use_cases[]` |
| Template **default properties** on create | done | Copied on `POST /api/documents` with `template_id` |
| Workspace **metadata schema** admin UI | P2 | `GET /api/metadata-schemas`; admin UI deferred to Phase 08 |
| Properties tab: render fields from schema | done | `PropertiesTab` + `useMetadataSchemas` |
| Document `metadata` values editor | done | Debounced PATCH via `useEditorSession` |
| Field type: `text` (label + input) | done | |
| Field type: `select` (dropdown) | done | Options from schema `options[]` |
| Field type: `tags` (chip input) | P2 | |
| Field type: `date` | done | Date picker |
| Field type: `number` | P2 | |
| Field type: `radio` group | P2 | Single select, visible options |
| Field type: `date_range` | P3 | Start + end date |
| Field type: `select_or_text` (dropdown + custom input) | P3 | Hybrid control |
| Metadata-powered **saved views** | P3 | Deferred to V1.5 per `docs/10-templates-and-views.md` |
| Metadata **search/filter** in Documents view | P2 | Filter chips from active metadata |
| Document **relationships** from metadata | P3 | e.g. `related_document_ids[]` in metadata |
| AI metadata extraction on save | moved → Phase 07 |
| Properties **Manage** toolbar (add/delete fields) | moved → Phase 07 |

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
| Use cases | `templates.metadata.use_cases` | Template sidebar |
| Default properties | `templates.metadata.default_properties` | Copied to `documents.metadata` on **Use** |
| Structure | `templates.structure_json` | Document body on **Use** |

**Migration:** `00014_template_metadata_and_schema_seed.sql` — `templates.metadata jsonb` + default schema seed per workspace.

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

1. Created at visible in Documents view and Editor. ✅
2. Template description + use cases editable for owned templates. ✅
3. Properties tab renders at least `text`, `select`, `date` from workspace schema. ✅
4. New document from template inherits default property values. ✅
5. Signed URL refresh implemented for images. ✅
