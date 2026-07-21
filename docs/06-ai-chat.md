# 06 — AI Chat

**Status:** draft

## Context

The insight sidebar answers "what relates to what I'm writing?" passively. Users also need dialogic exploration — asking questions against their workspace knowledge, plus lightweight tools (calculators) that don’t invent numbers.

## Decision

Add an **optional chat mode** accessible from the insight sidebar or Cmd+K — scoped strictly to the active workspace, grounded in **(A) retrieved document/library chunks**, **(B) a live workspace overview pack** (inventory + schema), and **(C) deterministic TypeScript tools** (Tier-1 calculators). Overview and tool results are built per request. Chat history is **never** stored on the server (D-013 / Phase 09 IndexedDB).

## Specification

### Entry points

| Path | Action |
|------|--------|
| Insight sidebar | Tab: "Insights" / "Ask" — **docked** compact `RightPanel` |
| Cmd+K / Global Ask | "Ask about {scope name}" — **~50vw overlay** (does not squeeze page content) |
| Selection | Right-click selected text → "Ask about selection" |

### Dual context + tools

| Layer | Source | Use for |
|-------|--------|---------|
| **Workspace overview** | Live Postgres reads (`buildWorkspaceAskContext`) | “What’s in this space?”, status filters, which properties exist |
| **Context chunks (RAG)** | `match_workspace_knowledge` | Content questions with `[Source: title]` citations |
| **Tool results** | Ask tools registry — arithmetic, units, datetime, statistics, **A/B sample size & runtime**, ROI/break-even, compound interest | Math / experiments; Rhodes narrates in first person; may answer **without** RAG |

**Fast path:** Intent is classified *before* RAG (`classifyAskIntent`):

| Intent | When | What runs |
|--------|------|-----------|
| `tools` | Calculator matched + no doc/library language | Instant first-person Rhodes narration (skip overview, RAG, Ollama) |
| `mixed` | Calculator + knowledge language | Tools + overview + RAG + Ollama (Rhodes speaks as if he calculated) |
| `knowledge` | No calculator match | Overview + RAG + Ollama |

Tool-only replies use a Rhodes walkthrough (what → why → result) and soft-stream into the chat so they feel conversational without waiting on Ollama. Numbers stay deterministic.

If RAG returns nothing but overview or tools have content, Rhodes still answers. If all empty, use the friendly no-context reply.

### Architecture (extensible)

```
Ask UI → orchestrator → always-on overview + RAG + capped tools (≤2) → Ollama → Markdown + chart blocks
```

New features (Roadmap, Dashboard) should register **context providers** and/or **tools**, and pass `ask_surface` later. Calculators run in **Node/TS on the Ask API** — not inside Ollama, and **no Python** this milestone.

### Chat behavior

1. Build workspace overview for `workspace_id` (capped inventory)
2. Run matching Tier-1 tools against the last user question (rule-based match, max 2)
3. User message → embed query → `match_workspace_knowledge` (top ~8–10)
4. Optional **LLM rerank** (or heuristic keep/skip) with SSE `reasoning_step` / `reasoning_done`
5. SSE `charts` when tools return chart payloads
6. Build answer prompt from **overview + kept chunks + tool results**; stream tokens (GFM markdown encouraged)
7. Emit `sources_used` (chunks, Workspace overview, or Computed)

### Replies UI

- Assistant bubbles render **sanitized Markdown** (`react-markdown` + `remark-gfm` + `rehype-sanitize`; optional `<u>`)
- Chart payloads map to sticker-sheet Recharts primitives (`ChartFrame` / Line / Bar / Area / Scatter)
- Global Ask: fixed overlay `clamp(360px, 50vw, 720px)` + light scrim

### System prompt (EN template)

Live prompt in `packages/ai/src/prompts.ts` (`askSystemPrompt` / `askUserPrompt`). Model must use overview for inventory, chunks for content, and tool summaries for math — never invent tool numbers.

### Scope rules

| Rule | Enforcement |
|------|-------------|
| Single workspace | `workspace_id` from active scope — never cross-space |
| No general knowledge | System prompt + empty overview/tools/retrieval → refuse |
| No invented math | Calculators are TS tools; Ollama only narrates results |
| Rate limit | 20 messages/user/hour on Free; unlimited Pro |

### Persistence

**Client-only (D-013 / Phase 09):** Ask conversations live in IndexedDB as **encrypted** message payloads (AES-GCM). Titles/previews stay plaintext for the History list. **Never** store Ask transcripts in Postgres / `chat_sessions`.

| Event | Local Ask history |
|-------|-------------------|
| Reload | Restored (last active conversation + History list) |
| Logout | **Kept** (ciphertext stays; in-memory vault key cleared) |
| Account delete | **Wiped** (`wipeAskDataForUser` / `clearOfflineCache`) |
| Server | Never |

**UX:** blank new chat shows History only; an open conversation shows History + New chat; History list shows New chat plus open/delete rows. Empty drafts (no user messages) are discarded when leaving.

### Spellcheck (Editor + Writing Coach)

| Layer | Decision |
|-------|----------|
| Engine | Client `nspell` + Hunspell dicts under `/dictionaries/{locale}/` |
| Locales | **EN first**; ES/DE/FR/IT in Phase 10 i18n |
| Editor | TipTap decoration underlines (not persisted marks) |
| Coach | `checkSpelling` → `spelling_issues` on `/api/writing-coach`; prompt must not invent typos |
| Personal dict | `localStorage` ignore/add — never upload by default |

### Fallback

If LLM queue full or timeout:
> "Insights are busy — here are the closest matches:" + retrieval-only list

## Open questions

- Chat history pinned to document vs workspace-wide in IndexedDB? (**Locked:** workspace-scoped `kind: "ask"`; optional `document_id` later)
- Clear Ask IndexedDB on logout / account delete? (**Locked:** logout keeps ciphertext + locks vault; account delete wipes)

## Dependencies

- [05-ai-and-rag.md](05-ai-and-rag.md)
- [07-individual-vs-team.md](07-individual-vs-team.md)
- [21-i18n.md](21-i18n.md)
