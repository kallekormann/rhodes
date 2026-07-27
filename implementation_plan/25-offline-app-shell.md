# Phase 25 — Offline App Shell (M1b)

**Status:** planned
**Milestone:** M1b
**Depends on:** Phase 09 (M1, complete), [docs/31-offline-security-and-privacy.md](../docs/31-offline-security-and-privacy.md)
**Independent of:** Phase 09.1 (realtime transport hardening) — no shared code path, can ship in either order
**Estimated duration:** multi-week, executed as small independent slices (see below), not a single big-bang release

---

## Objective

M1 delivered **editing an already-open document offline**. M1b delivers the **encrypted, owner-opt-in offline app shell**: browsing, creating, and managing documents offline, with everything in IndexedDB encrypted at rest.

## Locked design constraints (from roadmap)

- Rhodes is **online-first**; offline is **opt-in, per document, owner-controlled**.
- **Encrypt everything** cached in IndexedDB — body, metadata, outbox, index, assets. See [docs/31-offline-security-and-privacy.md](../docs/31-offline-security-and-privacy.md) for the full threat model and key derivation decision.
- Reuse the existing Yjs + conflict review system from M1 — M1b adds shell, list, and crypto, **not** a new merge model.
- **Single storage location:** all offline document data lives in `rhodes-db` only (see the IndexedDB storage audit in [docs/31-offline-security-and-privacy.md](../docs/31-offline-security-and-privacy.md)) — no separate per-document IndexedDB databases.

## Architecture principle for every slice below

Minimal diffs, small focused modules, clear separation of concerns:

- Prefer a small new adapter/module/component over expanding an existing large file. New logic gets its own file (`crypto.ts`, `yjs-rhodes-persistence.ts`, a `ConnectivityIndicator` component, an `OfflineUnavailable` component) rather than being folded into `db.ts`, `AppHeader.tsx`, or `useYjsCollaboration.ts`.
- Each slice's diff is the smallest change that achieves its one stated goal. No drive-by refactors, no bundling a second unrelated improvement into the same commit.
- Existing files get the minimum edit needed to call the new module (one new store definition, one wrapper call, one constructor swap) — the logic itself lives in the new module.
- If wiring in a new module would require touching more than ~2-3 existing files, that's a signal the slice is too large and should be split further.
- Every slice below has an explicit commit message and a verify step. No slice bundles unrelated changes. No slice ships without its own passing check.

---

## Wave M1b.1 — Encrypt offline stores (blocker for all further offline work)

Builds on [db.ts](../apps/web/src/lib/offline/db.ts), [documents-cache.ts](../apps/web/src/lib/offline/documents-cache.ts), [outbox.ts](../apps/web/src/lib/offline/outbox.ts), and the vault pattern in [ask-vault.ts](../apps/web/src/lib/offline/ask-vault.ts). Key derivation and encryption scope are decided in [docs/31-offline-security-and-privacy.md](../docs/31-offline-security-and-privacy.md) — this wave implements that decision.

**Risk note:** slices 6-11 touch the Yjs local-persistence layer that the whole collaboration/conflict system depends on. [09-m1-exit-collab-offline.md](09-m1-exit-collab-offline.md)'s fix playbook shows how easily this exact area regresses (several "fixed" rows there were timing/persistence bugs in this same code path). Slices 1-5 (field-level encryption of documents/outbox/meta snapshots) are low-risk and independent — they can ship on their own schedule. Slices 6-11 must follow the isolated-build → flagged-swap → bake sequence below; do not collapse them into one commit.

1. **Extract shared crypto helpers**
   - **Goal:** move the base64/AES-GCM encrypt/decrypt primitives out of `ask-vault.ts` into a standalone module, no behavior change.
   - **Touches:** new `apps/web/src/lib/offline/crypto.ts` (pure functions, no vault state); `ask-vault.ts` updated to import from it instead of defining its own.
   - **Commit:** `refactor(offline): extract AES-GCM helpers into shared crypto module`
   - **Verify:** existing Ask encryption round-trip (manual: send an Ask message, reload, confirm history decrypts) still works; `pnpm test:offline` green.

2. **Add a `docs` vault key**
   - **Goal:** a second per-user DEK, independent from the Ask DEK, per the key derivation decision in [docs/31-offline-security-and-privacy.md](../docs/31-offline-security-and-privacy.md).
   - **Touches:** `ask-vault.ts` (or a new sibling module if the diff would otherwise grow past the file's single responsibility — prefer a new `docs-vault.ts` that reuses `crypto.ts`, keeping `ask-vault.ts` untouched beyond the slice 1 import change).
   - **Commit:** `feat(offline): add per-user document encryption key`
   - **Verify:** unit test — unlock, encrypt, decrypt round trip; lock clears the in-memory key; unlocking Ask's key does not implicitly unlock the docs key or vice versa.

3. **Encrypt `documents` store body fields**
   - **Goal:** `content`, `content_plain`, `metadata` are encrypted at rest; `title` and `sync_status` stay plaintext for list UX and indexing.
   - **Touches:** `documents-cache.ts` (`putOfflineDocument`/`getOfflineDocument` wrap with encrypt/decrypt calls from the new `docs-vault.ts`); `db.ts` (`DB_VERSION` bump; clear stale plaintext `documents`/`outbox` stores on upgrade per the rollout note in [docs/31-offline-security-and-privacy.md](../docs/31-offline-security-and-privacy.md) — no migration needed, this cache is disposable).
   - **Commit:** `feat(offline): encrypt document body and metadata in IndexedDB`
   - **Verify:** `pnpm test:offline`; manual offline edit → reload round trip confirms content survives encryption correctly.

4. **Encrypt outbox payloads**
   - **Goal:** `payload` field in outbox records is encrypted at rest.
   - **Touches:** `outbox.ts` (`enqueueDocumentPatch`/`listOutbox` wrap `payload` with the same helpers).
   - **Commit:** `feat(offline): encrypt outbox mutation payloads`
   - **Verify:** offline edit → reconnect → server receives the correct decrypted patch (existing `pnpm test:offline` plus one manual offline-edit-then-reconnect cycle).

5. **Encrypt Yjs offline snapshot metadata**
   - **Goal:** close the gap found in the [docs/31-offline-security-and-privacy.md](../docs/31-offline-security-and-privacy.md) storage audit — `storeOfflineBase`/`storeOfflineMine` in [yjs-offline-snapshot.ts](../apps/web/src/lib/offline/yjs-offline-snapshot.ts) currently write raw base64 Yjs state into the `meta` store in plaintext.
   - **Touches:** `yjs-offline-snapshot.ts` (wrap `state` with the docs-DEK encrypt/decrypt helpers before `putMeta`/after `getMeta`).
   - **Commit:** `feat(offline): encrypt Yjs offline conflict snapshots`
   - **Verify:** offline overlap conflict flow (Step 4 of the [09-m1-exit-collab-offline.md](09-m1-exit-collab-offline.md) UAT script) still works end-to-end with encrypted snapshots.

### Design constraint for slices 6-11: injectable adapter, not a rewrite

Verified in [useYjsCollaboration.ts](../apps/web/src/hooks/useYjsCollaboration.ts) that `IndexeddbPersistence` (from the third-party `y-indexeddb` package) is touched in exactly two places: construction (`new IndexeddbPersistence(documentId, doc)` then `await idbPersistence.whenSynced`) and teardown (`idbPersistence?.destroy()`). Nothing else in the hook — server seeding, catchup, offline conflict snapshots, provider lifecycle — depends on `y-indexeddb` internals. The replacement is therefore a drop-in class implementing the exact same minimal contract (`whenSynced: Promise<void>`, `destroy(): void`, constructor `(docName, doc)`), so the change to `useYjsCollaboration.ts` itself is a **single-line constructor swap** — no other line in the collaboration/conflict path changes. All new logic lives in one new, independently testable module.

6. **Add a unified `yjs_state` store to `rhodes-db`**
   - **Goal:** schema-only groundwork, no behavior change.
   - **Touches:** `db.ts` (`DB_VERSION` bump; new object store `yjs_state` keyed by `documentId`, value `{ documentId, state_enc: EncryptedBlob, updated_at }`; typed accessor functions `getYjsState`/`putYjsState`/`deleteYjsState`).
   - **Commit:** `feat(offline): add yjs_state store to rhodes-db schema`
   - **Verify:** schema upgrade runs cleanly; manual DB inspection in DevTools Application tab confirms the new store exists.

7. **Build the persistence adapter in isolation**
   - **Goal:** a standalone module matching `IndexeddbPersistence`'s interface, built and unit-tested before it touches any collaboration code.
   - **Touches:** new `apps/web/src/lib/offline/yjs-rhodes-persistence.ts` only — **do not touch `useYjsCollaboration.ts` in this slice.**
   - **Behavior:** class `RhodesYjsPersistence` with constructor `(documentId: string, doc: Y.Doc)`. On construction: read + decrypt `yjs_state` for `documentId` (if present), apply to `doc`, then resolve `whenSynced`. On every subsequent doc `update` event: debounce (reuse the existing `1_500ms` pattern from [supabase-yjs-provider.ts](../apps/web/src/lib/collaboration/supabase-yjs-provider.ts)), encode full state via `Y.encodeStateAsUpdate(doc)`, encrypt with the docs DEK, write to `yjs_state`. `destroy()` cancels the debounce timer and detaches the update listener.
   - **Commit:** `feat(offline): add RhodesYjsPersistence adapter (not yet wired)`
   - **Verify:** standalone unit tests only — construct against a `Y.Doc`, apply updates, assert a debounced write to `yjs_state`; construct a second instance against the same `documentId` and assert it loads the persisted state; assert `destroy()` stops further writes.

8. **Swap the single line, behind a rollback-friendly flag**
   - **Goal:** wire the adapter in with a change small enough to revert instantly if something regresses.
   - **Touches:** `useYjsCollaboration.ts` — one constructor call replaced (`new IndexeddbPersistence(documentId, doc)` → `new RhodesYjsPersistence(documentId, doc)`), gated behind an env/config flag (e.g. `NEXT_PUBLIC_YJS_PERSISTENCE=rhodes-db`, defaulting to the existing `y-indexeddb` path).
   - **Commit:** `feat(offline): wire RhodesYjsPersistence behind a flag`
   - **Verify:** **full manual M1 UAT re-run** with the flag on — live typing, live block add, offline different-blocks auto-merge, offline overlapping-edit conflict + Keep/Take, comments, hard refresh, reconnect (exactly the steps in [09-m1-exit-collab-offline.md](09-m1-exit-collab-offline.md)); `pnpm test:offline` green. Keep the flag defaulting to `y-indexeddb` until this passes clean.

9. **Flip the default, bake, then remove the flag**
   - **Goal:** make the new adapter the default once verified, with a bake period before deleting the old path.
   - **Touches:** `useYjsCollaboration.ts` (flag default only).
   - **Commit:** `feat(offline): default to RhodesYjsPersistence`
   - **Verify:** short bake period in normal use with no regressions reported before proceeding to slice 10.

10. **One-time cleanup of legacy per-document databases**
    - **Goal:** remove orphaned plaintext `y-indexeddb` databases left on users' machines from before this change shipped.
    - **Touches:** small new cleanup routine (its own module, invoked once at app init) using `indexedDB.databases()` where supported (safe no-op fallback otherwise), reusing [clearYjsIndexedDbPersistence](../apps/web/src/lib/collaboration/yjs-idb.ts) to delete matches.
    - **Commit:** `chore(offline): clean up legacy per-document y-indexeddb databases`
    - **Verify:** DevTools Application tab shows no more per-document databases after opening a few previously-cached documents. Only run this slice after slice 9 is confirmed stable.

11. **Remove `y-indexeddb` dependency and the flag**
    - **Goal:** delete the now-dead code path entirely.
    - **Touches:** `apps/web/package.json` (remove `y-indexeddb`); `useYjsCollaboration.ts` (delete the flag branch and the now-unused import).
    - **Commit:** `chore(deps): remove y-indexeddb, superseded by rhodes-db persistence`

12. **Verification + doc update**
    - **Goal:** confirm the single-storage-location invariant actually holds and record coverage.
    - **Touches:** test files only (new round-trip tests for documents/outbox/snapshots/`yjs_state`); this doc's checklist below.
    - **Commit:** `test(offline): add encryption round-trip coverage for documents, outbox, snapshots, and yjs_state`
    - **Verify:** confirm vault lock on logout also locks the docs key; confirm account delete wipes `yjs_state` along with the rest; grep the codebase for any remaining direct `indexedDB.open`/`IndexeddbPersistence` calls outside `db.ts` and the new adapter — there should be none.

---

## Wave M1b.2 — Owner-only "Available offline" toggle

1. **DB migration** — add `documents.offline_available boolean not null default false`; RLS/policy update restricting the column's update to `created_by = auth.uid()`. Commit: `feat(db): add owner-only offline_available flag to documents`.
2. **API** — extend `PATCH /api/documents/[id]` (or a small dedicated route, whichever keeps the diff smaller) to accept the toggle, with a server-enforced owner check even though RLS already blocks it (defense in depth). Commit: `feat(api): support offline_available toggle, owner-only`.
3. **UI** — toggle in the document menu/settings, visible only when `created_by === currentUser`. Own small component, not inlined into an existing large view. Commit: `feat(editor): add owner-only Available offline toggle`.
4. **Wiring** — toggling on triggers an eager encrypted fetch+cache (reuses the M1b.1 encrypted `putOfflineDocument`); toggling off purges that document from IDB. Commit: `feat(offline): eager cache and purge on offline_available toggle`.

## Wave M1b.3 — Offline shell + `OfflineUnavailable`

0. **App-wide connectivity indicator (header)**
   - **Goal:** a small, non-interactive online/offline status icon so users always know their connectivity state, independent of any other M1b.3 work.
   - **Touches:** new `ConnectivityIndicator` component (own file, not inlined into `AppHeader.tsx`); one insertion point in [AppHeader.tsx](../apps/web/src/components/AppHeader.tsx) `app-header__zone--right`, immediately before the theme toggle `IconButton`; a small addition to [AppHeader.css](../apps/web/src/components/AppHeader.css) if a dedicated class is needed.
   - **Behavior:** `Wifi` icon when online, `WifiOff` when offline — both from **lucide-react**, the same icon family already used for `Moon`/`Sun`/`Search` (no custom SVG). Backed by the existing [useOnlineStatus.ts](../apps/web/src/hooks/useOnlineStatus.ts) hook (no `workspaceId` needed for a header-only status read). Rendered as `role="status"` with `aria-label`/`title` toggling "Online"/"Offline" — not a clickable button. Match `IconButton` sizing (`size={20}`, `strokeWidth={1.75}`). Optional subtle token color when offline; keep it minimal.
   - **Commit:** `feat(shell): add online/offline wifi indicator to app header`
   - **Verify:** toggle DevTools Network → Offline; icon switches without a page reload; theme toggle still works; collapsible header behavior on narrow viewports is unchanged.
   - **Note:** this slice has no dependency on encryption or the rest of M1b.3 — it can ship standalone, any time after this doc is written, since `useOnlineStatus` already exists.
1. **`OfflineUnavailable` component** — shared empty-state component, consistent with the design system, own file. Commit: `feat(components): add OfflineUnavailable placeholder`.
2. **Gate online-only surfaces** — Views, Library, Ask, Insights, Chat, Settings routes render `OfflineUnavailable` when `useOnlineStatus` reports offline. One surface per commit to keep review small (e.g. `feat(shell): gate Library behind offline check`, repeated per surface — do not gate all surfaces in one commit).
3. **Offline document list** — sourced from the `rhodes-db` `documents` IDB index (owned + `offline_available` docs only). Commit: `feat(offline): render document list from IndexedDB when offline`.

## Wave M1b.4 — Offline create/delete/rename (owned docs)

1. **Offline create** — local-id document + outbox `create` mutation (the `OfflineOutboxRecord.mutation` type already supports `"create"`). Commit: `feat(offline): support creating documents while offline`.
2. **Offline delete** — outbox `delete` mutation + optimistic removal from the local list. Commit: `feat(offline): support deleting owned documents while offline`.
3. **Offline rename/title edit** — confirm the existing `patch` outbox path already covers this; add a test if coverage is missing rather than new code. Commit: `test(offline): cover offline rename via existing patch outbox`.

## Wave M1b.5-6 — Encrypted asset + library upload queues (backlog, lower priority)

Documented at a shallower level as forward-looking backlog — not sliced in detail yet:
- **M1b.5** — encrypted image asset cache + upload queue.
- **M1b.6** — encrypted library upload queue (upload only, not offline library browsing).

Full slice breakdown for M1b.5-6 is deferred until M1b.1-4 ship, since both reuse the `crypto.ts` module from M1b.1.

---

## Exit criteria

1. All IndexedDB document data (body, metadata, outbox, Yjs snapshots, live Yjs state) is encrypted at rest — no plaintext document content anywhere in IndexedDB.
2. Single storage location confirmed — no per-document `y-indexeddb` databases remain, verified by the M1b.1 slice 12 grep check.
3. Owner-only offline toggle works and is enforced both client-side and server-side (RLS + API check).
4. Offline shell renders a usable document list and blocks online-only surfaces cleanly.
5. Offline create/delete/rename work for owned documents without regressing the M1 conflict/collaboration system.
6. `pnpm test:offline` green throughout; full manual M1 UAT re-run clean after the M1b.1 persistence adapter swap.

## Related documents

- [docs/31-offline-security-and-privacy.md](../docs/31-offline-security-and-privacy.md) — key derivation, threat model, storage audit this phase implements
- [09-offline-sync.md](09-offline-sync.md) — Phase 09 / M1 foundation (complete)
- [09-m1-exit-collab-offline.md](09-m1-exit-collab-offline.md) — UAT script reused for M1b.1 regression verification
- [09.1-realtime-transport-hardening.md](09.1-realtime-transport-hardening.md) — independent precursor slice, no shared code path
- [28-product-roadmap-to-production.md](../docs/28-product-roadmap-to-production.md) — milestone sequencing
