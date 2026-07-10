# Phase 06 — Library and Ingestion Pipeline

**Status:** planned  
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

## Canonical spec references

- [16-ingestion-pipeline.md](../docs/16-ingestion-pipeline.md)
- [05-ai-and-rag.md](../docs/05-ai-and-rag.md) — chunk params, models
- [26-ui-mock-reference.md](../docs/26-ui-mock-reference.md) — LibraryView
- [04-data-model.md](../docs/04-data-model.md) — library_sources, library_source_chunks
- [18-non-functional-requirements.md](../docs/18-non-functional-requirements.md) — PDF &lt;15s

---

## Docker services touched

| Service | Usage |
|---------|-------|
| `supabase-storage` | File storage |
| `supabase-kong` | Storage API |
| `redis` | BullMQ queues |
| `tika` | Text extraction |
| `ollama` | Embeddings + summary LLM |

---

## File checklist

```
apps/web/src/
├── app/api/library/
│   ├── route.ts                    # GET sources list
│   └── upload/route.ts             # POST multipart upload
├── views/LibraryView.tsx           # Wire real data
├── components/DropZone.tsx         # Functional upload
└── hooks/useLibrarySources.ts

apps/worker/src/
├── queues/
│   ├── ingest.queue.ts
│   ├── embed.queue.ts
│   └── summarize.queue.ts
├── jobs/
│   ├── ingest.ts                   # Tika + chunk
│   ├── embed.ts                    # Ollama batch embed
│   └── summarize.ts                # LLM summary
└── lib/
    ├── tika.ts
    ├── chunker.ts
    └── storage.ts                  # Download file from Supabase

packages/ai/src/
├── ollama.ts                       # embed(), generate()
└── prompts.ts                      # Summary prompt stub
```

---

## BullMQ queue design

| Queue | Job name | Trigger | Concurrency |
|-------|----------|---------|-------------|
| `ingest` | `process-file` | After upload | 2 |
| `embed` | `embed-chunks` | After chunking | 1 |
| `summarize` | `summarize-source` | After chunking | 1 |

Max 2 parallel LLM jobs globally (shared with Phase 07).

---

## Step-by-step tasks

### 1. Upload API

**`POST /api/library/upload`:**
```typescript
// multipart/form-data: file, workspace_id
// 1. Validate file type: pdf, docx, txt (mime check)
// 2. Upload to storage/{workspace_id}/library/{uuid}/{filename}
// 3. Insert library_sources (embedding_status: 'pending')
// 4. Enqueue ingest job { sourceId, workspaceId, filePath }
// 5. Return { id, file_name, embedding_status }
```

Max file size: 50 MB (configurable).

### 2. Library list API

**`GET /api/library?workspace_id=`:**
- Return sources with `embedding_status`, `summary`, `created_at`
- Order by `created_at desc`

### 3. Ingest job

**`jobs/ingest.ts`:**
1. Update status → `processing`
2. Download file bytes from Supabase Storage
3. POST to Tika `http://tika:9998/tika` (or `/rmeta` for metadata)
4. Parse plain text + page boundaries
5. Chunk text (see chunker below)
6. Insert `library_source_chunks` rows (no embeddings yet)
7. Enqueue `embed-chunks` and `summarize-source` jobs

**Tika timeout:** 60s; retry 2× on failure → status `failed`.

### 4. Chunker

**`lib/chunker.ts`:**
| Parameter | Value |
|-----------|-------|
| Chunk size | 512 tokens (~2000 chars) |
| Overlap | 64 tokens |
| Page boundary | Prefer splits at page breaks |

Use simple char-based chunking with token estimate (`chars / 4`) for V1.

### 5. Embed job

**`jobs/embed.ts`:**
1. Fetch chunks for `source_id` where `embedding is null`
2. Batch up to 32 chunks per Ollama request
3. Model: `nomic-embed-text` → 768D vectors
4. Update `library_source_chunks.embedding`
5. When all chunks done → `embedding_status = 'ready'`

On Ollama failure: retry 3× with backoff; then `failed`.

### 6. Summarize job

**`jobs/summarize.ts`:**
1. Take first ~4000 chars of extracted text
2. Ollama `llama3.2:3b-instruct-q4_K_M`
3. Prompt: "Summarize in 2-3 sentences for a knowledge library index."
4. Update `library_sources.summary`

Run parallel to embed job (does not block `ready` status).

### 7. Library UI

Port `LibraryView.tsx`:
- `DropZone`: drag-drop + click → calls upload API
- Progress toast on upload start
- Source list with `StatusPill`:
  - `pending` / `processing` → loader
  - `ready` → neutral pill
  - `failed` → error pill + retry button (re-enqueue ingest)

### 8. Realtime status updates (optional)

Subscribe to Supabase realtime on `library_sources` for `embedding_status` changes. Fallback: poll every 3s while any source is `pending` or `processing`.

### 9. Error handling

| Failure | UX |
|---------|-----|
| Tika timeout | `embedding_status = failed`; toast "Could not read file" |
| Unsupported type | 400 before upload |
| Storage quota (future) | 413 with upgrade message (Phase 11) |

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | BullMQ |
| `TIKA_URL` | `http://tika:9998` |
| `OLLAMA_HOST` | Embed + summarize |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker storage access |

---

## Testing checklist

- [ ] Upload PDF → appears in library list as `pending`
- [ ] Status transitions: pending → processing → ready
- [ ] Chunks created in `library_source_chunks`
- [ ] Embeddings are 768-dimensional vectors
- [ ] Summary text populated
- [ ] Upload DOCX and TXT successfully
- [ ] 15-page PDF completes within 15s (NFR)
- [ ] Tika failure → `failed` status + toast
- [ ] Retry button re-processes failed source
- [ ] RLS: user cannot see other workspace's sources
- [ ] Worker logs show job completion

---

## Exit criteria

1. Upload flow works for PDF, DOCX, TXT.
2. Full ingest → embed → ready pipeline operational.
3. Library UI shows real sources with status pills.
4. PDF &lt;20 pages indexed within 15s on dev hardware.
5. Failed ingestions handled gracefully.

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Tika OOM on large PDFs | 50 MB upload cap; page limit warning |
| Ollama slow on Mac Docker | Use native Ollama; reduce batch size |
| Duplicate job processing | Job idempotency key = `source_id` |
| Storage path leaks | Signed URLs only; RLS on metadata |

---

## Deliverables

- Upload + list API routes
- BullMQ ingest, embed, summarize jobs
- Tika + chunker + Ollama integration
- Functional LibraryView with DropZone

**Merge:** PR `feature/phase-06-library` → `dev` → `main` when exit criteria met.
