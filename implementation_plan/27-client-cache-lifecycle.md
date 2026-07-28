# Phase 27 — Client cache & storage lifecycle (M1c)

**Status:** core complete (M1c.5–6 shipped; M1c.7 UAT manual)  
**Milestone:** M1c  
**Depends on:** Phase 25 (M1b core complete)  
**Blocks:** M2 (scope growth multiplies workspaces and cache pressure)

---

## Objective

Bound IndexedDB growth so Rhodes remains usable with **10,000+ documents** per workspace. Online-first: IDB holds only documents the user has **opened** or has **offline-edit access** to — never a full workspace mirror.

## Locked policies

| Policy | Rule |
|--------|------|
| **Cache on demand** | Full body + `yjs_state` written on editor open / offline access grant only |
| **List = metadata** | Documents list API uses `include_body=false`; background pull advances cursor only |
| **LRU eviction** | Per-workspace cap (default 100 synced docs); never evict pending/conflict/local-only |
| **Coupled delete** | Evicting `documents` row also deletes `yjs_state` |
| **Future surfaces** | M6 Views, Library browse, Chat — online-only offline; no IDB body cache |

## Waves

### M1c.1 — Storage audit (doc) — done in this phase doc

| Store | Growth | Eviction |
|-------|--------|----------|
| `documents` | Full encrypted body per opened doc | LRU per workspace |
| `yjs_state` | CRDT snapshot per open doc | Deleted with document row |
| `outbox` | Pending mutations | Never auto-evict |
| `meta` | Conflict snapshots | Session-scoped |
| Background pull | ~~50 full bodies~~ → cursor only | N/A |

### M1c.2 — `last_accessed_at` — done

- Field on `OfflineDocumentStorageRecord` / `OfflineDocumentRecord`
- Set on `putOfflineDocument`; touched on `getOfflineDocumentStrict`

### M1c.3 — LRU eviction engine — done

- [`cache-eviction.ts`](../apps/web/src/lib/offline/cache-eviction.ts)
- `DEFAULT_MAX_CACHED_DOCS_PER_WORKSPACE = 100`
- Called after each `putOfflineDocument`

### M1c.4 — Metadata-only background pull — done

- [`pullWorkspaceDocuments`](../apps/web/src/lib/offline/sync-engine.ts) uses `include_body=false`; advances sync cursor only (no bulk `putOfflineDocument`)

### M1c.5 — Quota monitor — done

- [`idb-quota-monitor.ts`](../apps/web/src/lib/offline/idb-quota-monitor.ts) — warn when browser quota ≥ 85% used (`navigator.storage.estimate`)
- [`OfflineQuotaToast`](../apps/web/src/hooks/useOfflineQuotaToast.ts) — persistent `warning` toast (sticker-sheet style, bottom-center); dismiss removes it fully

### M1c.6 — Settings → Offline storage — done

- [`OfflineStoragePanel.tsx`](../apps/web/src/components/settings/OfflineStoragePanel.tsx) — per-scope counts, clear cache (`clearSyncedOfflineCache`)

### M1c.7 — Tests + UAT — done (automated); manual UAT optional

## Exit criteria

1. Background sync does not write full document bodies to IDB.
2. LRU evicts oldest synced docs when cap exceeded; pending/conflict/local-only preserved.
3. `last_accessed_at` updated on open/read.
4. `pnpm test:offline` green including eviction tests.
5. TD-005 marked done in [techncial-dept.md](../techncial-dept.md).

## Related

- [docs/28-product-roadmap-to-production.md](../docs/28-product-roadmap-to-production.md)
- [docs/31-offline-security-and-privacy.md](../docs/31-offline-security-and-privacy.md)
- [25-offline-app-shell.md](25-offline-app-shell.md)
- [09.2-offline-conflict-quality.md](09.2-offline-conflict-quality.md) — after M1c
