# Phase 07 — AI, RAG, and Insights

**Status:** in progress  
**Depends on:** Phase 06  
**Blocks:** Phase 08  
**Estimated duration:** 7–10 days

---

## Objectives

1. Implement **semantic insights** while writing (debounced RAG).
2. Build **Right Panel** tabs: Insights, Ask, Properties (with **Manage properties** toolbar).
3. **Ask chat** scoped to workspace with streaming responses.
4. **Quote insertion** flow: select insight → CitationBlock in editor.
5. Document **re-embedding** on save when content changes &gt;15%.
6. **Document properties management** in the Properties tab: bottom action bar, add/delete workspace fields, extended field types, AI auto-fill on save.

---

## Prerequisites

- Phase 06 exit criteria met (library chunks embedded).
- Documents with `content_plain` populated (Phase 05).
- `match_workspace_knowledge` RPC deployed (Phase 02).
- Ollama models: `nomic-embed-text`, `llama3.2:3b-instruct-q4_K_M`, optionally `llama3.1:8b-instruct-q4_K_M`.

---

## Canonical spec references

- [05-ai-and-rag.md](../docs/05-ai-and-rag.md)
- [06-ai-chat.md](../docs/06-ai-chat.md)
- [26-ui-mock-reference.md](../docs/26-ui-mock-reference.md) — RightPanel, AskComposer
- [11-editor-tiptap.md](../docs/11-editor-tiptap.md) — CitationBlock
- [08-metadata-system.md](../docs/08-metadata-system.md) — property layers, field types, AI metadata

---

## Docker services touched

| Service | Usage |
|---------|-------|
| `ollama` | Embed query, generate "Why relevant?", chat |
| `redis` | LLM job queue (max 2 parallel) |
| `supabase-db` | `match_workspace_knowledge` RPC |

---

## File checklist

```
packages/ai/src/
├── ollama.ts                       # embed, generate, stream
├── rag.ts                          # retrieve(), buildContext()
├── prompts.ts                      # Why relevant, Ask system prompt
└── diff.ts                         # content change % for re-embed

apps/web/src/
├── app/api/insights/
│   └── route.ts                    # POST { workspace_id, query_text }
├── app/api/ask/
│   └── route.ts                    # POST streaming chat
├── components/
│   ├── RightPanel.tsx              # Wire Insights + Ask tabs
│   ├── InsightDot.tsx
│   ├── AskComposer.tsx
│   ├── ChatMessageBubble.tsx
│   └── insights/
│       ├── InsightCard.tsx
│       └── WhyRelevant.tsx
├── hooks/
│   ├── useInsights.ts              # Debounced fetch
│   ├── useAskChat.ts
│   └── useMetadataSchemas.ts       # extend: create/delete schema fields
├── components/
│   ├── PropertiesTab.tsx           # + bottom action bar + Manage flow
│   ├── PropertiesManageSheet.tsx   # add/delete property definitions
│   └── properties/
│       ├── AddPropertyDialog.tsx
│       └── PropertyTypePicker.tsx
└── lib/documents/embed-on-save.ts

apps/worker/src/jobs/
├── embed-document.ts               # Document-level embedding
└── llm-generate.ts                 # Queued LLM calls
```

---

## Step-by-step tasks

### 1. Ollama client (`packages/ai`)

```typescript
export async function embedText(text: string): Promise<number[]>
export async function* streamGenerate(model: string, prompt: string): AsyncGenerator<string>
export async function generate(model: string, prompt: string): Promise<string>
```

Config from env: `OLLAMA_HOST`, model names as constants.

### 2. RAG retrieval

**`packages/ai/src/rag.ts`:**
```typescript
export async function retrieve(workspaceId: string, queryText: string) {
  const embedding = await embedText(queryText);
  const { data } = await supabase.rpc('match_workspace_knowledge', {
    query_embedding: embedding,
    match_threshold: 0.72,
    match_count: 8,
    target_workspace_id: workspaceId,
  });
  return data; // top 4 shown in UI
}
```

### 3. Insights API

**`POST /api/insights`:**
```typescript
// Body: { workspace_id, query_text }
// 1. retrieve()
// 2. Return top 4 matches with similarity %, origin_type, title, matched_text, page_ref
// No LLM in this call — fast retrieval only
```

### 4. Debounced insight fetch (client)

**`useInsights.ts`:**
- On editor `content_plain` change: debounce **3000ms** (Pro tier; 5000ms Free — gate in Phase 11)
- Call `/api/insights` with last ~500 chars of plain text as query
- Update Insights tab + show `InsightDot` when matches exist

Never block editor typing.

### 5. "Why relevant?" generation

On user click per insight card:
- Enqueue LLM job or stream inline for single request
- Model: `llama3.2:3b-instruct-q4_K_M`
- Prompt guardrails from [05-ai-and-rag.md](../docs/05-ai-and-rag.md):
  - Only reference provided chunk
  - Max 1 sentence, &lt;120 chars
  - Stream if &gt;2s

### 6. Ask chat API

**`POST /api/ask`:**
```typescript
// Body: { workspace_id, messages: [{ role, content }] }
// 1. Embed last user message
// 2. retrieve() for context chunks
// 3. Build system prompt with chunks as citations (06-ai-chat.md)
// 4. Stream response via llama3.1:8b (or 3b for speed)
// Return: SSE stream
```

Guardrails: only cite retrieved chunks; say "I don't have information" if no matches.

### 7. Ask UI

Port from mock:
- `AskComposer`: multiline input, status row ("Thinking…"), send button
- `ChatMessageBubble`: user right-aligned, Rhodes left-aligned
- Open Ask tab from: bubble menu "Ask" on selection, Cmd+K, insight panel

Pre-fill Ask with selected text when opened from bubble menu.

### 8. Quote insertion flow

1. User expands insight in panel (split view 45% width)
2. Select text in insight card
3. Floating "Insert quote" button
4. Insert `CitationBlock` at cursor in TipTap with `sourceId`, `sourceTitle`, `page`, `excerpt`

### 9. Document embedding on save

**`embed-on-save.ts`:**
- On document PATCH: compare new vs old `content_plain` length/chars
- If diff &gt;15%: enqueue `embed-document` job
- Job: embed full `content_plain` → update `documents.embedding`

### 10. Insight dot

Port `InsightDot.tsx`:
- Bottom-right floating affordance
- Lucide `lightbulb` in violet pill
- Pulse once on first matches (400ms ease-in-out)
- Click → open Right Panel → Insights tab

### 11. LLM queue (worker)

**`llm-generate.ts`:**
- BullMQ queue `llm` with concurrency **2**
- Jobs: `why-relevant`, `ask-turn`, `summarize` (Phase 06), `extract-document-metadata` (§13)
- 30s hard timeout → fallback to retrieval-only text

### 12. Right Panel wiring

| Tab | Phase 07 content |
|-----|------------------|
| Insights | Ranked matches, relevance %, Why relevant?, quote flow |
| Ask | Chat thread + composer |
| Properties | Schema-driven values + **Manage** action bar (see §13) |

### 13. Document properties — Manage UI (sidebar)

**Goal:** While editing a document, users can define which properties exist for *all documents in the workspace* without leaving the editor — same affordance pattern as `TemplateDetailPanel` bottom action bar.

#### UI pattern (reference)

Mirror [`TemplateDetailPanel.tsx`](../apps/web/src/components/TemplateDetailPanel.tsx) `.template-detail__actionbar`:
- Properties tab body scrolls (`panel-tab--properties`)
- **Pinned bottom toolbar** inside the tab: primary **Manage** button (secondary: optional "View history" later)
- Click **Manage** → slide-over sheet or nested panel listing workspace property definitions

```
┌─ Properties tab ─────────────────┐
│ Created · Created by             │
│ Status        [ Draft ▾ ]        │
│ Summary       [ …………… ]          │
│ Due           [ Nov 10 ]           │
│ …scroll…                         │
├──────────────────────────────────┤
│              [ Manage ]          │  ← action bar (like template sidebar)
└──────────────────────────────────┘
```

**Manage sheet:**
| Action | Behavior |
|--------|----------|
| List fields | All `metadata_schemas` rows for workspace (label, type, option count) |
| Add property | Opens add flow (type picker → label → options if needed) |
| Delete property | Confirm if any documents have values; remove schema row; optional: purge key from `documents.metadata` |
| Reorder | P2 — drag order in sheet (display order in Properties tab) |

**Add property flow:**
1. User enters **Label** (e.g. "Review date") → auto-generate `field_key` (`review_date`)
2. User picks **Data type** (see table below)
3. If `select` / `multi_select`: define options (chip input, one per line)
4. Save → `POST /api/metadata-schemas` → field appears immediately in Properties tab

**Permissions (V1):**
- Any workspace **member** can edit property **values** on documents they can edit
- **Owner / admin** can add/delete schema fields via Manage (match Phase 08 settings later)

#### Field types — Phase 07 scope

| `field_type` | UI control | Value shape in `documents.metadata` | Notes |
|--------------|------------|-------------------------------------|-------|
| `text` | Single-line `Input` | `"string"` | Default for freeform labels |
| `textarea` | `TextArea` | `"string"` | Longer summary / notes |
| `select` | `Dropdown` | `"option_id"` | Label + predefined options |
| `multi_select` | Tag chips + dropdown | `["a","b"]` | Multiple options |
| `date` | `DatePickerField` | `"YYYY-MM-DD"` | Single date |
| `date_range` | `DateRangeField` | `{ "start": "…", "end": "…" }` | Timelines, sprints |
| `number` | Number input | `number` | Estimates, scores |
| `tags` | Chip input | `["tag1","tag2"]` | Freeform tags |
| `url` | `Input` + link validation | `"https://…"` | External refs |
| `checkbox` | Toggle | `boolean` | Flags (e.g. "Needs review") |

**Migration:** extend `metadata_schemas.field_type` check constraint for `textarea`, `multi_select`, `date_range`, `url`, `checkbox` (or map `date_range` to jsonb options in schema).

#### Recommended property catalog (sensible defaults)

Users can add any custom field via Manage. Ship **suggestions** in the add flow ("Common properties") so teams don't start from a blank slate:

| Label | Type | Example options | Auto-fill source | Layer |
|-------|------|-----------------|------------------|-------|
| **Status** | `select` | draft, in progress, review, done, archived | AI infers from tone/structure on save (optional) | user + AI |
| **Priority** | `select` | low, medium, high, urgent | — | user |
| **Document type** | `select` | spec, meeting notes, research, experiment, plan, decision, weekly review | AI classifies from title + first § | AI |
| **Summary** | `textarea` | — | LLM 2–3 sentences on save (debounced) | AI |
| **Tags** | `tags` | — | LLM topics[] from content; user can edit | AI + user |
| **Due date** | `date` | — | AI extracts explicit dates from body ("by Nov 10") | AI + user |
| **Timeline** | `date_range` | — | — | user |
| **Review date** | `date` | — | — | user |
| **Project** | `text` or `select` | workspace-specific list | — | user |
| **Owner** | read-only row | — | `documents.created_by` → profile display name | system |
| **Created** | read-only row | — | `documents.created_at` | system |
| **Word count** | `number` (read-only) | — | `content_plain` split length on save | system |
| **Language** | `select` | en, de, fr, es, … | `detected_language` column / franc | system + AI |
| **Source** | `select` | blank, template, library, import | Set on create from `template_id` / library link | system |
| **Stakeholders** | `tags` | — | AI NER people/orgs from content (optional) | AI |
| **Decision status** | `select` | proposed, agreed, rejected, superseded | AI for decision-type docs | AI + user |
| **Experiment outcome** | `select` | pending, success, failed, inconclusive | — | user |
| **Confidence** | `select` | low, medium, high | AI self-assessed completeness (optional) | AI |
| **Related doc** | `text` (V1) → doc link (V1.5) | — | AI suggests from RAG similarity (Insights tab) | AI |

**Reserved keys** (never offered in Manage): `favorite`, `archived`, `archived_at`, `template_draft`, `comments`, `template_description`.

#### API additions

```
POST   /api/metadata-schemas          # { workspace_id, field_label, field_type, options? }
DELETE /api/metadata-schemas/[id]     # owner/admin; optional ?purge_values=true
PATCH  /api/metadata-schemas/[id]     # relabel, update options (P2)
```

Validate: max **20 custom fields** per workspace; `field_key` unique; no reserved keys.

#### AI auto-fill on document save (Phase 07)

Hook into existing debounced document PATCH (after Phase 05c metadata write path):

1. On save, if AI metadata enabled (workspace default on): enqueue `extract-document-metadata` job or inline fast model call
2. Model: `llama3.2:3b-instruct-q4_K_M` with structured JSON output schema
3. Only fill keys that are **empty** or user has not manually edited since last AI run (track `metadata._ai_filled_keys` or per-field `metadata._ai.{key}_at`)
4. Fields eligible for auto-fill: `summary`, `tags`, `document_type`, `due_date` (if parseable), `stakeholders`, `decision_status`, `confidence`
5. Never overwrite user-edited values

**UX:** subtle "AI suggested" hint on auto-filled fields; user can clear or override.

#### Relationship to Phase 08

| Concern | Phase 07 (editor) | Phase 08 (settings) |
|---------|-------------------|---------------------|
| Edit property values | Properties tab | — |
| Add/delete property definitions | Properties → **Manage** | Settings → Space → Custom fields (same API) |
| Team-wide schema admin | Owner/admin via Manage | Full settings UI + audit |
| Saved views / filter by metadata | — | Documents view filters |

Phase 07 delivers the **in-context Manage** flow; Phase 08 duplicates entry point in Settings for admins who prefer space configuration there.

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `OLLAMA_HOST` | All AI calls |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` |
| `OLLAMA_FAST_MODEL` | `llama3.2:3b-instruct-q4_K_M` |
| `OLLAMA_CHAT_MODEL` | `llama3.1:8b-instruct-q4_K_M` |

---

## Testing checklist

- [ ] Writing in doc with related library content → insights appear after 3s debounce
- [ ] Insight dot visible when matches exist
- [ ] Top matches show relevance %, source title, excerpt
- [ ] "Why relevant?" streams a short explanation
- [ ] Ask chat responds with citations from workspace only
- [ ] Ask refuses to hallucinate sources not in retrieval
- [ ] Quote insert creates CitationBlock with backlink
- [ ] Document re-embeds when content changes significantly
- [ ] Editor never blocks during insight fetch
- [ ] LLM queue limits concurrent jobs to 2
- [ ] 30s timeout returns graceful fallback
- [ ] Insights only from active workspace (RLS + RPC param)
- [ ] Properties tab shows pinned **Manage** action bar (template-sidebar pattern)
- [ ] Add property: pick type (text, select, date, date_range, tags, …) → appears in tab
- [ ] Delete property: confirm + removed from schema (optional value purge)
- [ ] `date_range` stores `{ start, end }` and renders with `DateRangeField`
- [ ] AI auto-fill on save populates empty Summary/Tags/Document type without overwriting user edits
- [ ] System fields (Created, Owner, Word count) read-only in Properties tab

---

## Exit criteria

1. Debounced insights work while writing.
2. Ask chat streams with workspace-scoped citations.
3. Quote insertion flow complete.
4. Document embeddings update on substantial edits.
5. Right Panel Insights + Ask + Properties (**Manage** flow) fully functional.
6. Document property definitions editable in-editor (add/delete types).
7. AI auto-fill for eligible metadata fields on save.
8. Meets latency budgets where CPU allows (stream on slow responses).

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| CPU inference too slow | Stream tokens; show "Thinking…"; retrieval-only fallback |
| Poor retrieval quality | Tune `match_threshold`; log similarity scores |
| Ollama OOM | `OLLAMA_MAX_LOADED_MODELS=1`; queue jobs |
| Ask prompt injection | System prompt constraints; no tool execution |

---

## Deliverables

- `packages/ai` Ollama + RAG module
- Insights + Ask API routes (streaming)
- Right Panel Insights + Ask + Properties (Manage toolbar)
- `PropertiesManageSheet` + metadata schema CRUD API
- AI document metadata extraction job
- InsightDot affordance
- Document embed-on-save job
- LLM BullMQ queue

**Merge:** PR `feature/phase-07-rag` → `dev` → `main` when exit criteria met.
