# M1b.1 — Title & body offline QA (post outbox hardening)

**When:** After `fix(offline): harden title outbox path…` and before/after M1b.1 slices 5–11.  
**Environment:** Local Docker, two users in the same workspace, DevTools Application + Network tabs.

## Preconditions

1. Stop active Fast Refresh / HMR (wait for dev server to settle).
2. DevTools → Application → IndexedDB → delete `rhodes-db` (and any legacy UUID-named DBs if present).
3. Hard refresh the editor tab.
4. Sign in as **User A**; confirm docs vault unlocks (normal app load).

---

## Title path (outbox → `rhodes-db`)

**Storage:** `rhodes-db.documents` + `rhodes-db.outbox` — **not** the per-doc Yjs store.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open a shared document while **online** | `rhodes-db` → `documents` has a row for the doc; `title` plaintext; `sync_status` = `synced` |
| 2 | DevTools → **Network** → check **Offline** (not throttling only) | App `online` flag false; header shows **Offline** (or **Unsaved changes** if title pending) |
| 3 | Edit title; wait ≥500ms (title debounce) | `documents.sync_status` = `pending`; `outbox` has one row for `document_id`; `payload_enc` present |
| 4 | Confirm **no** direct `PATCH /api/documents` while offline | Network tab empty for document PATCH |
| 5 | Uncheck Offline (back online) | Outbox drains; `sync_status` = `synced`; User B sees new title |
| 6 | Open same doc offline **without** editing | `sync_status` stays `synced`; outbox empty |

**Automated:** `pnpm test:offline` (includes `offline-document-patch`, outbox encryption).

---

## Body path (Yjs CRDT)

**Storage:** `rhodes-db.yjs_state` (after M1b.1 slices 6–11) or legacy UUID `y-indexeddb` DB while flag off.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open document online; type in body | Editor updates; Yjs state persists locally |
| 2 | Go offline; add/edit blocks | Edits visible after refresh in same tab |
| 3 | Inspect IDB | `rhodes-db` → `yjs_state` row for doc (encrypted `state_enc`) **or** legacy UUID DB with `updates` store |
| 4 | Reconnect | User B sees body changes (auto-merge if non-overlapping) |
| 5 | Overlapping offline edit (M1 UAT step 4) | Conflict UI for offline returner; `meta` keys `offline_base:*` / `offline_mine:*` encrypted after slice 5 |

**Automated:** `pnpm test:offline` (`yjs-rhodes-persistence`, `yjs-offline-snapshot` encryption).

**Full manual:** [09-m1-exit-collab-offline.md](09-m1-exit-collab-offline.md) steps 1–5.

---

## Regression watchlist

- Do **not** use `navigator.onLine` alone — use DevTools Offline so `useOnlineStatus` matches.
- Orphan outbox: after successful sync, `outbox` must be empty for that document.
- QA during HMR can show false “cached” logs — always hard refresh after IDB delete.
