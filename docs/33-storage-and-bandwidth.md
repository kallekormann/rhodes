# 33 — Storage & bandwidth architecture

**Status:** accepted — canonical policy for server + client data growth  
**Last updated:** July 29, 2026  
**Related:** [27-library-file-storage-vps.md](27-library-file-storage-vps.md), [28-product-roadmap-to-production.md](28-product-roadmap-to-production.md), [implementation_plan/28-production-storage-architecture.md](../implementation_plan/28-production-storage-architecture.md)

---

## Problem

Rhodes will grow across teams, views (Kanban, roadmaps, tickets), knowledge graphs, and deep document libraries. Without strict layering:

- **Supabase Postgres** fills with blobs and embeddings
- **Every app load** pulls megabytes of document bodies nobody is reading
- **Client IDB** mirrors whole workspaces offline

---

## Layered model (locked)

| Layer | What lives here | Rule |
|-------|-----------------|------|
| **Postgres** | Metadata, ACLs, embeddings/chunks, Yjs bytea for open docs | No library originals; document `content` jsonb is projection only |
| **Supabase Storage** | Library PDFs/DOCX, inline images, avatars | Path `{workspace_id}/…`; workspace RLS on `storage.objects` |
| **Client IDB** | Encrypted bodies for **opened** docs only | LRU cap per workspace (M1c); no full workspace mirror |
| **CDN / imgproxy** | Transformed images | Self-hosted imgproxy in Docker today |

Future views (M6 Kanban, graphs, ticket boards) are **online-first**: card = document id + metadata columns; body loads on open.

---

## Bandwidth rules (server → client)

1. **List APIs default to metadata** — `GET /api/documents` omits bodies unless `include_body=true`
2. **Background sync** — cursor + metadata only; no bulk body pull
3. **Open doc** — single-document fetch with body + Yjs state
4. **Realtime (M3)** — metadata deltas on lists; not full bodies
5. **Field projection (future)** — views request only columns they render
6. **Pagination** — library has offset; documents list supports `offset` + `limit` (sync uses `since` + `limit`)

---

## Self-hosted Supabase (dev = prod topology)

Docker stack already runs Auth, REST, Realtime, **Storage** (file backend by default), imgproxy, pooler. Dev must use Storage as the **only** blob source:

- `RHODES_IN_DOCKER=1` or `RHODES_ALLOW_LOCAL_STORAGE_FALLBACK=0` → no `.data/` fallback
- Laptop-only dev (no Docker): `RHODES_ALLOW_LOCAL_STORAGE_FALLBACK=1` optional

**Default dev:** `./scripts/dev-up.sh` — Supabase Storage API + file volume (named `supabase-storage-data` on macOS).

**Optional S3 rehearsal (28.3):** `./scripts/dev-up-s3.sh` — same Supabase Storage API and buckets; blob backend is MinIO (stand-in for Hetzner/R2 on VPS). No app code changes.

**macOS Docker:** `docker-compose.dev.yml` mounts Supabase Storage on a **named volume** (`supabase-storage-data`) because host bind mounts do not support extended attributes (upload error: *"The file system does not support extended attributes"*). After pulling this change, recreate storage: `cd docker && docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d storage imgproxy --force-recreate`. Alternative: Docker Desktop → **VirtioFS** file sharing (or use OrbStack).

**VPS cutover (monolith, one server):** keep the same compose stack; set `STORAGE_BACKEND: s3` and `GLOBAL_S3_ENDPOINT` to Hetzner Object Storage or Cloudflare R2. No second Rhodes server required. See [27-library-file-storage-vps.md](27-library-file-storage-vps.md) and O-019 in [19-open-decisions.md](19-open-decisions.md).

---

## What we shipped (Phase 28)

**Slice 1 (28.1)**

- Workspace-scoped Storage RLS (`00048_storage_workspace_policies.sql`)
- `allowLocalStorageFallback()` — explicit dev vs Docker behavior
- Serve/download paths: **Storage first**, local fallback only when allowed
- Documents list API: **`include_body` defaults false**
- `RhodesObjectStorage` adapter interface (`@rhodes/shared/storage-adapter`)
- `createAdminObjectStorage()` / `createSessionObjectStorage()` (`@rhodes/db/object-storage`)

**Slice 2 (28.2)** — adapter wired for library, images, avatars, worker.

**Slice 3 (28.3)** — optional S3 backend overlay:

- [`docker/docker-compose.s3.yml`](../docker/docker-compose.s3.yml) — MinIO + `STORAGE_BACKEND: s3` on existing `supabase-storage` service
- [`scripts/dev-up-s3.sh`](../scripts/dev-up-s3.sh) — dev stack with S3 rehearsal

**Slice 4 (28.5)** — API bandwidth hardening:

- Documents list `offset` pagination on `GET /api/documents`
- `ETag` / `If-None-Match` on `GET /api/documents/[id]`; editor polls send conditional requests

**Slice 5 (28.4)** — quota reconciliation:

- RPCs compare `library_sources.metadata.byte_size` vs `storage.objects` (`00049`)
- Account quota API includes `storage_bytes` and `drift_bytes`
- Upload verifies Storage object size after put; ops: `pnpm storage:reconcile`

**Slice 6 (28.6–28.7)** — ops:

- `health-check.sh` waits for Supabase Storage API; `qa:library` preflight includes Storage
- Worker emits `[rhodes:storage-alert]` JSON logs on Storage download/API failures

## Remaining work (Phase 28)

| Slice | Topic |
|-------|--------|
| — | Phase 28 feature work complete; VPS backend choice remains before M13 (O-019) |

M3 (realtime metadata), M7 (RAG ACLs), M8 (tier enforcement) build on this foundation.
