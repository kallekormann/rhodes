# Phase 28 — Production storage architecture (M1d)

**Status:** in progress (slice 1 shipped)  
**Milestone:** M1d  
**Depends on:** M1c (client cache lifecycle)  
**Blocks:** M2 scale, M3 realtime, VPS deploy (O-019)

---

## Objective

Use self-hosted Supabase Storage as the production object-store path **today in Docker dev**, with policies and APIs that stay valid on VPS (S3 backend later). Bound Postgres growth and server→client bandwidth before multi-team views land.

---

## Waves

### 28.1 — Docker dev = production topology — **done**

| Item | Status |
|------|--------|
| Workspace-scoped Storage RLS (`library-files`, `document-images`) | ✅ `00048_storage_workspace_policies.sql` |
| `allowLocalStorageFallback()` + Docker `RHODES_ALLOW_LOCAL_STORAGE_FALLBACK=0` | ✅ |
| Upload/serve: Storage first, fallback gated | ✅ library, images, avatars, worker |
| Documents list `include_body` default **false** | ✅ |
| `RhodesObjectStorage` interface | ✅ `@rhodes/shared/storage-adapter` |
| Architecture doc | ✅ [docs/33-storage-and-bandwidth.md](../docs/33-storage-and-bandwidth.md) |

### 28.2 — Storage adapter implementation — **done**

- `@rhodes/db/object-storage` — `SupabaseObjectStorage`, `LocalFilesystemObjectStorage`, `CompositeObjectStorage`
- `createAdminObjectStorage()` / `createSessionObjectStorage()` — default `RHODES_STORAGE_BACKEND=supabase`
- Wired: library upload/serve/delete, document images, avatars, worker download

### 28.3 — VPS S3 backend — **done**

- [`docker/docker-compose.s3.yml`](../docker/docker-compose.s3.yml) — MinIO + `STORAGE_BACKEND: s3` on existing Supabase Storage service (app unchanged)
- [`scripts/dev-up-s3.sh`](../scripts/dev-up-s3.sh) — optional local rehearsal
- VPS: same Storage API; point `GLOBAL_S3_ENDPOINT` at Hetzner/R2 ([docs/27-library-file-storage-vps.md](../docs/27-library-file-storage-vps.md))

### 28.4 — Quota reconciliation — planned

- Compare `storage.objects` size sum vs `library_sources.metadata.byte_size`
- Admin/reporting RPC; optional upload-time HEAD verify

### 28.5 — API bandwidth hardening — **done**

- Documents list `offset` pagination (`listDocumentsQuerySchema` + `.range()`)
- `ETag` / `If-None-Match` on `GET /api/documents/[id]`; client polls via `fetchDocumentMetadata`
- Explicit `fields=` projection for view APIs (prep M6) — backlog

### 28.6 — Ops — planned

- Storage smoke test in dev-up / `pnpm qa:library`
- Alert on Storage API errors in worker ingest

---

## Exit criteria (M1d)

1. Docker dev never silently writes blobs to `.data/` when stack is up.
2. Storage RLS enforces workspace path prefix.
3. List APIs do not return bodies by default.
4. Adapter interface documented; Supabase implementation wired (28.2).
5. VPS storage backend chosen and documented before M13.

---

## Related

- [docs/33-storage-and-bandwidth.md](../docs/33-storage-and-bandwidth.md)
- [implementation_plan/27-client-cache-lifecycle.md](27-client-cache-lifecycle.md) (M1c)
- [implementation_plan/12b-distributed-docker-topology.md](12b-distributed-docker-topology.md)
