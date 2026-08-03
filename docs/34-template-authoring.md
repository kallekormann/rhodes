# 34 — Template authoring

**Status:** living guideline (M2.5.2+)

Templates are **best-in-class starters**. Users pick a template, then enhance Properties via Manage (Single / Group / Preset). Templates must bootstrap the Properties builder correctly—not invent a parallel metadata UI.

## Layers

| Layer | Storage | Purpose |
|-------|---------|---------|
| Body + tips | `templates.structure_json` | TipTap outline; italic tip under each H2 |
| Classification | `documents.metadata.document_type` | Tier A — derived from template; **not** a Properties schema field |
| Schema definitions | `templates.metadata.schema_fields` → seeded into `metadata_schemas` | Drives `SchemaFieldRow` controls |
| Defaults | `templates.metadata.default_properties` | Prefills those controls on create |
| Affinity | `supported_views` + `use_cases` | Wizard / catalog / composition |

## Field tiers

### Tier A — Derived (readonly)

Created, Created by, Word count, **Document type**, optional `template_slug`. Never AI-suggested as form fields.

### Tier B — Template-shipped (editable values)

Every template includes essentials with AI fill on:

- `status` (select) — Dropdown  
- `due_date` (date) — Date picker  
- `owner` (text) — Input  
- `summary` (textarea) — TextArea  

Plus use-case fields (e.g. `meeting_date`, `priority`, `milestone`, `period_end`, `confidence`) with correct `field_type`. Soft-locked from delete in Manage.

### Tier C — User-enhanced

Anything added later via Properties Manage. Full create/edit/delete; AI toggle in composers.

## Content rules

1. No leading H1 that duplicates the document title.  
2. H2 sections match the product outline.  
3. Italic tip paragraph under each H2 (user may delete).  
4. Narrative (agenda, decisions, findings) stays in the body.  
5. Board / timeline / dashboard facts go in Tier B/C Properties.

## On “Use template”

1. Seed missing `schema_fields` onto the workspace (`seed_scope_metadata_fields`).  
2. Copy `structure_json` → `documents.content`.  
3. Merge `default_properties` + `document_type` (+ `template_slug`) into `documents.metadata`.  
4. Editor must hydrate TipTap/Yjs from that content (collab empty-doc seed).

## Related

- [`packages/shared/src/system-templates.ts`](../packages/shared/src/system-templates.ts)  
- [`docs/08-metadata-system.md`](08-metadata-system.md)  
- Properties composers under `apps/web/src/components/properties/`
