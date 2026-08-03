# 08 — Metadata System

**Status:** living (aligned with Properties builder)

## Context

Documents need structured metadata for filtering, views, AI context, and team workflows—beyond raw text.

## Three layers (product)

### Tier A — System / derived (readonly)

| Field | Source |
|-------|--------|
| Created | `documents.created_at` |
| Created by | `documents.created_by` |
| Word count | `documents.metadata.word_count` |
| Document type | `documents.metadata.document_type` (set by template) |

Shown via `SystemReadonlyRow`. Not schema pickers. Not AI-filled as form fields.

### Tier B / C — Workspace schema + values

**Definitions** live in `metadata_schemas` (+ `metadata_schema_groups`).  
**Values** live in `documents.metadata[field_key]`.

Users build schema via Properties **Manage → Add → Single | Group | Preset** (`PropertyFieldComposer` / `PropertyGroupComposer`). UI is always **label + control** (`SchemaFieldRow`).

| `field_type` | Control |
|--------------|---------|
| `text` / `url` | Input |
| `textarea` | TextArea |
| `select` | Dropdown |
| `multi_select` | Chips |
| `date` | DatePicker |
| `date_range` | DateRange |
| `tags` | TagsEditor |
| `number` | Input + unit |
| `checkbox` | Checkbox |

### AI-assisted values

- Per-field `metadata_schemas.ai_fill_enabled` (“Enable AI suggestions” in composers).  
- On document save (content threshold), worker fills empty top-level AI-enabled fields and sets `_ai_filled_keys`.  
- User edit clears that key’s AI mark.  
- Templates turn AI on for Tier B inferable fields by default.

## Templates

Templates declare `schema_fields` (same shape as bundle `MetadataFieldSeed` + `ai_fill_enabled`) and typed `default_properties`. On Use, fields are seeded onto the workspace. See [34-template-authoring.md](34-template-authoring.md).

Essential keys (`status`, `due_date`, `owner`, `summary`) cannot be deleted from Manage.

## Reserved metadata keys

`favorite`, `archived`, `archived_at`, `template_draft`, `comments`, plus bookkeeping `_ai_filled_keys`, `word_count`, `document_type`, `template_slug`.

## Related

- [10-templates-and-views.md](10-templates-and-views.md)  
- [34-template-authoring.md](34-template-authoring.md)  
- Implementation: `apps/web/src/components/properties/`, `lib/metadata/`
