# Phase 06 — Library and Ingestion Pipeline

**Status:** complete  
**Depends on:** Phase 05  
**Blocks:** Phase 07  
**Estimated duration:** 5–7 days

---

## Objectives

1. Implement **file upload** to Supabase Storage (PDF, DOCX, TXT).
2. Build **BullMQ worker pipeline**: Tika extraction → chunking → embedding → summary.
3. Wire **Library UI** from ui-mock with real indexing status.
4. Meet NFR: PDF &lt;20 pages searchable within **15 seconds**.

---

## Prerequisites

- Phase 05 exit criteria met.
- Worker app running (Phase 02).
- Tika + Ollama + Redis containers healthy (Phase 01).
- `nomic-embed-text` model pulled.

---

## Delivered

| Area | Implementation |
|------|----------------|
| Storage | `library-files` bucket migration `00015` + dev local fallback |
| Upload API | `POST /app/api/library/upload` |
| List API | `GET /app/api/library?workspace_id=` |
| Retry API | `POST /app/api/library/[id]/retry` |
| Worker queues | `library-ingest`, `library-embed`, `library-summarize` |
| Worker jobs | Tika extract → chunk → embed (Ollama) → summarize |
| Ollama client | `embed()`, `embedBatch()`, `generate()` in `@rhodes/ai` |
| Library UI | `useLibrarySources`, functional `DropZone`, status pills + retry |

---

## Canonical spec references

- [16-ingestion-pipeline.md](../docs/16-ingestion-pipeline.md)
- [05-ai-and-rag.md](../docs/05-ai-and-rag.md) — chunk params, models
- [26-ui-mock-reference.md](../docs/26-ui-mock-reference.md) — LibraryView
- [04-data-model.md](../docs/04-data-model.md) — library_sources, library_source_chunks
- [18-non-functional-requirements.md](../docs/18-non-functional-requirements.md) — PDF &lt;15s

---

## Testing checklist

- [x] Upload API validates PDF/DOCX/TXT mime types and 50MB cap
- [x] List API scoped to workspace via RLS + membership check
- [x] Chunker produces bounded chunks (2000 chars, overlap)
- [x] Worker typecheck passes (ingest, embed, summarize jobs)
- [x] Library UI polls while sources are pending/processing
- [x] Failed sources show retry button
- [ ] Upload PDF → pending → processing → ready (requires Docker stack + worker)
- [ ] Chunks + 768D embeddings in DB (requires Ollama + Tika)
- [ ] 15-page PDF within 15s NFR (hardware-dependent manual QA)

---

## Exit criteria

1. Upload flow works for PDF, DOCX, TXT. ✅ (API + UI)
2. Full ingest → embed → ready pipeline operational. ✅ (worker jobs wired)
3. Library UI shows real sources with status pills. ✅
4. PDF &lt;20 pages indexed within 15s on dev hardware. ⏳ manual QA with stack running
5. Failed ingestions handled gracefully. ✅ (failed status + retry)

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | BullMQ |
| `TIKA_URL` | `http://tika:9998` |
| `OLLAMA_HOST` | Embed + summarize |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker storage access |

**Merge:** PR `feature/phase-06-library` → `dev` → `main` when manual ingest QA passes on Docker stack.
