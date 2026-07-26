# Phase 09 — Offline Sync

**Status:** ✅ complete — **M1 exit:** [09-m1-exit-collab-offline.md](09-m1-exit-collab-offline.md) — merged to `main` at `c779c77` (July 26, 2026)  
**Depends on:** Phase 05  
**Blocks:** ~~Phase 13~~ (VPS deferred to M10 per roadmap)  
**Estimated duration:** 5–7 days  
**Can parallel with:** Phases 10–12 (after Phase 08 recommended for conflict UX)

**Started:** July 21, 2026 — IndexedDB scaffold + encrypted Ask history.  
**Wave A (branch `feature/phase-09-offline-wave-a`):** document local-first outbox + push + `expected_updated_at` 409 + online/sync indicator.  
**Wave B (same branch):** Keep mine / Take theirs / Review + block-diff list; conflict version branches; workspace pull `since` cursor.  
**Wave C:** TipTap + Yjs live collaboration (O-007) over Supabase Realtime; Compare Keep/Take reserved for offline reconnect 409 only.

---

## Objectives

1. Implement **IndexedDB** local cache for documents.
2. Build **outbox sync** protocol: write locally first, push on reconnect.
3. Handle **conflicts** with LWW + version branch + user notification.
4. Meet NFR DoD #4: editor writable offline; syncs without data loss.
5. Persist **Ask chat history client-only** in IndexedDB — multi-conversation, AES-GCM encrypted payloads, never on server (privacy / D-013).

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
rhodes-db (version 2)
├── documents/{id}        # { id, workspace_id, title, content, content_plain, updated_at, sync_status }
├── outbox/{id}           # { id, document_id, mutation, payload, created_at, retries }
├── conversations/{id}    # encrypted Ask history — NEVER synced (privacy)
├── vault/{userId}        # per-user AES-GCM DEK (JWK) — device-local
├── ask_threads/{id}      # deprecated v1 plaintext — migrated then deleted
└── meta/{key}            # client_id, active_conversation:workspace:kind
```

**`sync_status`:** `synced` | `pending` | `conflict`

**Ask conversations (locked):** Multi-conversation History in IndexedDB only (`kind: "ask"`). Message bodies AES-GCM ciphertext; titles/previews plaintext for list UX. Unlock DEK on login; **logout locks vault in memory but keeps ciphertext**; **account delete wipes** conversations + vault. Do not create a server `chat_sessions` table. Spec: [06-ai-chat.md](../docs/06-ai-chat.md), [12-offline-sync.md](../docs/12-offline-sync.md).

---

## Step-by-step tasks

### 1. IndexedDB setup

Use [`idb`](https://github.com/jakearchibald/idb) package — **done** in [`apps/web/src/lib/offline/db.ts`](../apps/web/src/lib/offline/db.ts) (`rhodes-db` v2: documents, outbox, conversations, vault, meta; legacy `ask_threads` migrated). Ask crypto: [`ask-vault.ts`](../apps/web/src/lib/offline/ask-vault.ts), CRUD: [`conversations.ts`](../apps/web/src/lib/offline/conversations.ts).

### 1b. Ask chat local persistence

**Done:** multi-conversation encrypted History via `useAskChat` + `ask-vault` / `conversations`. Logout calls `lockVault()` + `clearSyncedOfflineCache()` (keeps ciphertext). Account delete uses `wipeAskDataForUser` / `clearOfflineCache`. Charts/sources are not rehydrated (text transcript only). Never enqueue Ask messages in `outbox`.

### 2. Write path (local-first)

**Done (Wave A):** [`useDocument.save`](../apps/web/src/hooks/useDocument.ts) writes IndexedDB + coalesced outbox immediately, then [`pushOutbox`](../apps/web/src/lib/offline/sync-engine.ts) when online. Helpers: [`documents-cache.ts`](../apps/web/src/lib/offline/documents-cache.ts), [`outbox.ts`](../apps/web/src/lib/offline/outbox.ts).

### 3. Sync engine

**Done (Wave A — push):** FIFO outbox drain; network errors stop and retry on `online`; 409 → conflict + store theirs snapshot.  
**Done (Wave B — pull):** [`pullWorkspaceDocuments`](../apps/web/src/lib/offline/sync-engine.ts) with `GET /api/documents?since=` cursor; skips docs with pending/conflict local state.

### 4. Conflict resolution

**Done (Wave B):** Shared/team docs stay in IndexedDB. On realtime dirty conflict or outbox 409:
- Banner: **Review** | **Keep mine** | **Take theirs** ([`DocumentRemoteConflictBanner`](../apps/web/src/components/DocumentRemoteConflictBanner.tsx))
- Review: block-diff list (`blockId`) + read-only TipTap of theirs ([`DocumentConflictReview`](../apps/web/src/components/DocumentConflictReview.tsx))
- Keep mine → version-branch theirs → force-push mine with `expected_updated_at = theirs`
- Take theirs → version-branch mine → load server into editor, clear outbox
- Versions POST accepts optional content override for conflict branches

**Wave C:** per-block Use mine/Use theirs + optional write-third-variant card.

### 5. Online/offline detection

**Done (Wave A):** [`useOnlineStatus.ts`](../apps/web/src/hooks/useOnlineStatus.ts) — `online`/`offline` listeners; push on reconnect.

### 6. Sync status indicator

**Done (Wave A):** [`SyncStatusIndicator.tsx`](../apps/web/src/components/SyncStatusIndicator.tsx) in editor meta row — Offline / Saving… / Conflict.

### 7. Logout behavior

On logout ([22-authentication-and-accounts.md](../docs/22-authentication-and-accounts.md)):
- Clear synced document/outbox cache (`clearSyncedOfflineCache`)
- **Lock** Ask vault DEK in memory (`lockVault`) — **keep** encrypted conversations + vault JWK on device
- On account delete: wipe Ask data (`wipeAskDataForUser` / `clearOfflineCache`)

### 8. Service worker (deferred)

PWA install deferred per open decision O-010. Optional service worker for background sync in V1.5.

---

## API changes

**`PATCH /api/documents/[id]`** — optimistic concurrency (**Wave A done**):
```typescript
// Body may include expected_updated_at
// If server updated_at > expected: return 409 with server document
```

---

## Testing checklist

- [x] Edit document while online → saves to server + IndexedDB
- [x] Go offline (DevTools) → edit → changes persist in IndexedDB
- [x] Go online → outbox drains → server updated
- [x] No data loss after offline edit + reconnect
- [x] Conflict: edit same doc on two tabs → toast + version branch created
- [x] Sync indicator shows pending during push
- [x] Logout clears local cache
- [x] Pull fetches remote changes from other device/session
- [x] Large document (100KB JSON) performs acceptably in IndexedDB

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
