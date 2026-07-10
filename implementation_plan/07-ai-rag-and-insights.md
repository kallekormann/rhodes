# Phase 07 — AI, RAG, and Insights

**Status:** planned  
**Depends on:** Phase 06  
**Blocks:** Phase 08  
**Estimated duration:** 7–10 days

---

## Objectives

1. Implement **semantic insights** while writing (debounced RAG).
2. Build **Right Panel** tabs: Insights, Ask, Properties (properties content in Phase 08).
3. **Ask chat** scoped to workspace with streaming responses.
4. **Quote insertion** flow: select insight → CitationBlock in editor.
5. Document **re-embedding** on save when content changes &gt;15%.

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
- [18-non-functional-requirements.md](../docs/18-non-functional-requirements.md) — debounce, latency budgets

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
│   └── useAskChat.ts
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
- Jobs: `why-relevant`, `ask-turn`, `summarize` (from Phase 06)
- 30s hard timeout → fallback to retrieval-only text

### 12. Right Panel wiring

Port `RightPanel.tsx` fully:
| Tab | Phase 07 content |
|-----|------------------|
| Insights | Ranked matches, relevance %, Why relevant?, quote flow |
| Ask | Chat thread + composer |
| Properties | Stub → Phase 08 |

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

---

## Exit criteria

1. Debounced insights work while writing.
2. Ask chat streams with workspace-scoped citations.
3. Quote insertion flow complete.
4. Document embeddings update on substantial edits.
5. Right Panel Insights + Ask tabs fully functional.
6. Meets latency budgets where CPU allows (stream on slow responses).

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
- Right Panel Insights + Ask tabs
- InsightDot affordance
- Document embed-on-save job
- LLM BullMQ queue

**Merge:** PR `feature/phase-07-rag` → `dev` → `main` when exit criteria met.
