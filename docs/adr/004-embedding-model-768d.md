# ADR 004 — Embedding Model 768 Dimensions

**Status:** accepted  
**Date:** July 2026

## Context

The incubator PRD specifies `nomic-embed-text` with `vector(1536)`. This is incorrect — `nomic-embed-text` outputs **768 dimensions** natively. No Ollama embedding model outputs 1536 (that dimension is OpenAI `text-embedding-3-small`).

## Decision

Use `nomic-embed-text` with `vector(768)` in Postgres/pgvector. Track `embedding_model_version` on documents and chunks for future migrations.

## Migration note

If switching to `mxbai-embed-large` (1024D) or `bge-m3` (1024D) later:
1. Add new column or re-create index
2. Background re-embed all content
3. Update `embedding_model_version`

## Consequences

**Positive:**
- Correct schema; smaller index (less storage, faster search)
- nomic-embed-text is lightweight and CPU-fast

**Negative:**
- PRD SQL must be corrected in all references
- OpenAI-dimension assumptions in any copied code will break

## Dependencies

- [04-data-model.md](../04-data-model.md)
- [05-ai-and-rag.md](../05-ai-and-rag.md)
