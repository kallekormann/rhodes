# Phase 09 — Offline Sync

**Status:** planned  
**Depends on:** Phase 05  
**Blocks:** Phase 13  
**Estimated duration:** 5–7 days  
**Can parallel with:** Phases 10–12 (after Phase 08 recommended for conflict UX)

---

## Objectives

1. Implement **IndexedDB** local cache for documents.
2. Build **outbox sync** protocol: write locally first, push on reconnect.
3. Handle **conflicts** with LWW + version branch + user notification.
4. Meet NFR DoD #4: editor writable offline; syncs without data loss.

---

## Prerequisites

- Phase 05 exit criteria met (document CRUD, TipTap editor).
- Document API PATCH endpoint stable.

---

## Canonical spec references

- [12-offline-sync.md](../docs/12-offline-sync.md)
- [18-non-functional-requirements.md](../docs/18-non-functional-requirements.md) — DoD #4
- [09-document-history.md](../docs/09-document-history.md) — conflict branches

---

## Docker services touched

None — client-side IndexedDB + existing API.

---

## File checklist

```
apps/web/src/
├── lib/offline/
│   ├── db.ts                       # IndexedDB wrapper (idb library)
│   ├── schema.ts                   # Store definitions
│   ├── outbox.ts                   # Mutation queue
│   ├── sync-engine.ts              # Pull + push orchestrator
│   └── conflict.ts                 # LWW + branch logic
├── hooks/
│   ├── useOfflineDocument.ts
│   └── useOnlineStatus.ts
├── components/
│   └── SyncStatusIndicator.tsx     # Editor meta row
└── workers/
    └── sync-worker.ts              # Optional: background sync
```

---

## IndexedDB schema

```
rhodes-db (version 1)
├── documents/{id}        # { id, workspace_id, title, content, content_plain, updated_at, sync_status }
├── outbox/{id}           # { id, document_id, mutation, payload, created_at, retries }
└── meta/last_sync        # { workspace_id, cursor, client_id }
```

**`sync_status`:** `synced` | `pending` | `conflict`

---

## Step-by-step tasks

### 1. IndexedDB setup

Use [`idb`](https://github.com/jakearchibald/idb) package:

```typescript
export async function getDB() {
  return openDB('rhodes-db', 1, {
    upgrade(db) {
      db.createObjectStore('documents', { keyPath: 'id' });
      db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('meta');
    },
  });
}
```

Generate `client_id` (UUID) once per browser; store in `meta`.

### 2. Write path (local-first)

**`useOfflineDocument.ts`:**
1. On editor update → write to IndexedDB immediately
2. Set `sync_status = 'pending'`
3. Add entry to `outbox`: `{ type: 'PATCH', document_id, payload: { title, content, content_plain } }`
4. If online → trigger sync engine

Editor never waits for network.

### 3. Sync engine

**`sync-engine.ts`:**

**Push (outbox FIFO):**
```
for each outbox entry (oldest first):
  PATCH /api/documents/{id} with payload + If-Unmodified-Since or updated_at check
  on success: remove from outbox, set sync_status = 'synced'
  on 409 conflict: run conflict resolver
  on network error: stop push, retry on reconnect
```

**Pull:**
```
GET /api/documents?workspace_id=&since={last_sync_cursor}
for each remote doc:
  if local missing or remote.updated_at > local.updated_at:
    update IndexedDB (unless local has pending outbox for same doc)
update last_sync_cursor
```

### 4. Conflict resolution

Per [12-offline-sync.md](../docs/12-offline-sync.md):

When server `updated_at` > local at push time:
1. Compare `content_plain` hash
2. If different:
   - Save local version as `document_versions` branch via API
   - Apply server version to local IndexedDB
   - Show toast once: "This document was updated elsewhere. Your version was saved to history."
   - Link opens version history

### 5. Online/offline detection

**`useOnlineStatus.ts`:**
- `window.addEventListener('online' | 'offline')`
- On `online`: run sync engine
- Visual indicator in editor meta row (subtle dot or label)

### 6. Sync status indicator

**`SyncStatusIndicator.tsx`** in document meta row:
- `synced`: hidden or checkmark
- `pending`: subtle "Saving…" / cloud icon
- `conflict`: warning icon

### 7. Logout behavior

On logout ([22-authentication-and-accounts.md](../docs/22-authentication-and-accounts.md)):
- Clear IndexedDB for active space (or entire DB)
- Prevents data leak to next user on shared machine

### 8. Service worker (deferred)

PWA install deferred per open decision O-010. Optional service worker for background sync in V1.5.

---

## API changes

**`PATCH /api/documents/[id]`** — add optimistic concurrency:
```typescript
// Body includes client updated_at
// If server updated_at > client updated_at: return 409 with server document
```

---

## Testing checklist

- [ ] Edit document while online → saves to server + IndexedDB
- [ ] Go offline (DevTools) → edit → changes persist in IndexedDB
- [ ] Go online → outbox drains → server updated
- [ ] No data loss after offline edit + reconnect
- [ ] Conflict: edit same doc on two tabs → toast + version branch created
- [ ] Sync indicator shows pending during push
- [ ] Logout clears local cache
- [ ] Pull fetches remote changes from other device/session
- [ ] Large document (100KB JSON) performs acceptably in IndexedDB

---

## Exit criteria

1. Editor writable fully offline.
2. Reconnect syncs pending changes without data loss.
3. Conflict detected and handled with version branch + toast.
4. NFR DoD #4 satisfied.

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| IndexedDB quota exceeded | Warn at 50MB; compress plain text only in IDB |
| Race on rapid edits | Debounce outbox coalesce per document |
| TipTap JSON large | Store full JSON; monitor size |
| Safari IndexedDB bugs | Test on Safari last 2 versions |

---

## Deliverables

- IndexedDB layer + schema
- Outbox queue + sync engine
- Conflict resolver + toast UX
- Sync status indicator
- 409 conflict support on document API

**Merge:** PR `feature/phase-09-offline` → `dev` → `main` when exit criteria met.
