# 08 — Metadata System

**Status:** draft

## Context

Documents and library sources need structured metadata for filtering, views, and AI context — beyond raw text and embeddings.

## Decision

Three metadata layers: **system** (automatic), **AI** (on ingest), **user-defined** (workspace schema). Detection via hybrid extraction; editing via on-demand sidebar.

## Specification

### Layer 1 — System metadata (automatic)

| Field | Source | Tables |
|-------|--------|--------|
| `created_at`, `updated_at` | DB defaults | documents, library_sources |
| `created_by`, `uploaded_by` | auth.uid() | documents, library_sources |
| `word_count` | computed from `content_plain` | documents |
| `file_type`, `file_name` | upload | library_sources |
| `page_count` | Tika extraction | library_sources |
| `embedding_status` | worker pipeline | library_sources |
| `detected_language` | franc / LLM | both |

### Layer 2 — AI metadata (on ingest / save)

| Field | How |
|-------|-----|
| `summary` | 5 bullet LLM summary | library_sources |
| `topics[]` | LLM extract, stored in `metadata.topics` | both |
| `entities[]` | LLM NER (people, orgs, products) | both |

Generated during ingestion pipeline; refreshed on significant document edit (optional V1.5).

### Layer 3 — User-defined metadata

**Schema per workspace** (`metadata_schemas` table):

```json
{
  "field_key": "status",
  "field_label": "Status",
  "field_type": "select",
  "options": ["draft", "review", "published"]
}
```

**Values** stored in `documents.metadata` / `library_sources.metadata`:

```json
{
  "status": "draft",
  "project": "Q3 Growth",
  "review_date": "2026-08-01"
}
```

### Field types (V1)

| Type | UI control |
|------|------------|
| `text` | Single line input |
| `select` | Dropdown |
| `date` | Date picker |
| `tags` | Tag chips, freeform |
| `number` | Number input |

### Metadata detection

| Source | Method |
|--------|--------|
| PDF/DOCX frontmatter | YAML parser if present |
| Filename patterns | `YYYY-MM-DD-title.pdf` → date + title hint |
| Document content | LLM extraction on first save (optional) |
| Manual | User edits in ⓘ sidebar |

### UI

- **Edit:** Header ⓘ → right sidebar "Document info" section
- **Display:** Not shown in editor by default — only in sidebar and search results
- **Views (V1.5):** Filter documents by metadata via saved views

### Workspace admin

- Owner/Admin can add/remove custom fields in space settings (future settings page or Cmd+K "Manage fields")
- Max 20 custom fields per workspace (V1)

## Open questions

- Inherit metadata schema from team template on new space?
- AI auto-fill metadata on every save (cost/latency)?

## Dependencies

- [04-data-model.md](04-data-model.md)
- [10-templates-and-views.md](10-templates-and-views.md)
- [16-ingestion-pipeline.md](16-ingestion-pipeline.md)
