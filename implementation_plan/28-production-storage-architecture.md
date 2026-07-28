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

### 28.2 — Storage adapter implementation — planned

- `SupabaseObjectStorage` in `@rhodes/db` or `apps/web`
- Wire upload, serve, worker, delete through adapter
- Env: `RHODES_STORAGE_BACKEND=supabase` (default)

### 28.3 — VPS S3 backend — planned

- `docker-compose.s3.yml` or Storage API env for S3-compatible endpoint
- Document in [docs/27-library-file-storage-vps.md](../docs/27-library-file-storage-vps.md)
- BYO bucket contract for enterprise (O-019)

### 28.4 — Quota reconciliation — planned

- Compare `storage.objects` size sum vs `library_sources.metadata.byte_size`
- Admin/reporting RPC; optional upload-time HEAD verify

### 28.5 — API bandwidth hardening — planned

- Documents list offset pagination
- ETag / `If-None-Match` on document metadata GET
- Explicit `fields=` projection for view APIs (prep M6)

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
