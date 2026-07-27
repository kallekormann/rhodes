# 31 — Offline Security & Privacy

**Status:** accepted
**Milestone:** M1b (Phase 25)
**Depends on:** [12-offline-sync.md](12-offline-sync.md), [09-offline-sync.md](../implementation_plan/09-offline-sync.md) (M1, complete)
**Related:** [28-product-roadmap-to-production.md](28-product-roadmap-to-production.md), [implementation_plan/25-offline-app-shell.md](../implementation_plan/25-offline-app-shell.md)

## Context

M1 shipped open-document offline editing with a **plaintext** IndexedDB cache — acceptable only as a temporary state, per the roadmap's locked principle: *"Encrypt everything cached — all offline IDB data AES-GCM, private and team docs."* M1b extends offline to the app shell with **per-share control**: edit access implies offline editing by default, and the document owner can opt out per grantee in the share workflow.

## Threat model

- **In scope:** device theft or unauthorized local access (shared machine, stolen laptop, malware with filesystem access) reading cached document content directly out of IndexedDB.
- **Out of scope:** network-level attacks — Realtime/API traffic is already TLS + Supabase-authenticated; this doc does not change wire security. Server-side encryption of the `documents` Postgres table is also out of scope; the server is a trusted component.
- **Non-goal:** protecting against a fully compromised, currently-unlocked browser session (an attacker with script execution while the user is logged in can read decrypted data in memory, same as any client-side crypto scheme). The goal is protecting **data at rest** on disk when the app is not actively unlocked, not protecting a live compromised session.

## Key derivation decision

Reuse the existing per-user AES-GCM vault pattern already shipped for Ask conversations in [ask-vault.ts](../apps/web/src/lib/offline/ask-vault.ts) — a non-extractable-in-transit, exportable JWK DEK stored in the `vault` IndexedDB object store, unlocked into memory on login, dropped from memory on logout.

**Decision:** a **separate key** for documents, not the same DEK as Ask. Store it as a second row in the existing `vault` store (e.g. keyed `${userId}:docs` vs. today's implicit `${userId}` for Ask), unlocked and locked alongside the Ask vault at the same lifecycle points (login/logout/account delete). Rationale: Ask history and document cache have different retention and wipe semantics (Ask history persists across offline-cache clears; see [09-offline-sync.md](../implementation_plan/09-offline-sync.md) logout behavior) — a shared key would couple their rotation/revocation even though the data they protect is unrelated.

No new vault UI or unlock flow — this rides the same login-triggered unlock as Ask.

## IndexedDB storage audit

Before scoping M1b.1, this planning pass audited every place document content is written into IndexedDB today. There are **three**, not one:

1. **`rhodes-db` → `documents` object store** ([db.ts](../apps/web/src/lib/offline/db.ts)) — JSON `content` / `content_plain` / `metadata` snapshot used by the outbox/sync engine and offline document restore. In scope for M1b.1.
2. **`rhodes-db` → `meta` object store**, keys `offline_base:<documentId>` / `offline_mine:<documentId>` ([yjs-offline-snapshot.ts](../apps/web/src/lib/offline/yjs-offline-snapshot.ts)) — full base64-encoded raw Yjs CRDT state captured for offline conflict review. Currently plaintext; missed by the original M1b.1 scoping until this audit. In scope for M1b.1.
3. **A separate physical IndexedDB database per document**, named literally as the document's UUID, created by the third-party `y-indexeddb` package's `IndexeddbPersistence(documentId, doc)` ([useYjsCollaboration.ts](../apps/web/src/hooks/useYjsCollaboration.ts)) — the live Yjs update log for whichever document is currently open. Entirely outside `rhodes-db`, entirely outside our field-level control, and currently plaintext.

Storage location 3 is already partially mitigated: `clearYjsIndexedDbPersistence(documentId)` ([yjs-idb.ts](../apps/web/src/lib/collaboration/yjs-idb.ts)) deletes that per-document database on every online reload, so plaintext exposure is bounded to the current offline session rather than indefinite. But having a second, uncontrolled storage location for the same content is a risk in itself — inconsistent encryption coverage, orphaned databases that a cleanup pass could miss, and a doubled attack surface for something that should be one system.

**Decision (locked): consolidate to a single storage location.** All offline document data — JSON snapshot, outbox payloads, Yjs conflict snapshots, and the live Yjs CRDT state — lives in `rhodes-db` only. No separate per-document IndexedDB databases. [25-offline-app-shell.md](../implementation_plan/25-offline-app-shell.md) M1b.1 slices 6-11 implement this by replacing `y-indexeddb`'s `IndexeddbPersistence` with a small injectable adapter module that persists into a new `rhodes-db` object store (`yjs_state`) instead of its own database, built and verified in isolation before it is wired into the collaboration hook, and swapped in behind a rollback flag (see that doc for the full sequencing and risk mitigation — this is the highest-risk slice group in M1b because it touches the shared Yjs persistence layer that collaboration and conflict review both depend on).

## Scope of encrypted data

Encrypted (AES-GCM, docs DEK):
- Document body (`content`, `content_plain`)
- Document `metadata`
- Outbox mutation `payload`
- Yjs offline conflict snapshots (`offline_base`, `offline_mine` state)
- Live Yjs CRDT state (`yjs_state` store, replacing the unencrypted per-document `y-indexeddb` database)
- Future: asset blobs and library upload queue payloads (M1b.5-6)

Plaintext (by design, for list UX and indexing — same pattern already used for Ask `conversations.title`/`preview`):
- Document `title`
- `sync_status`
- Object store keys (document IDs, workspace IDs) — IDs are not sensitive content

## Non-goals

- No server-side encryption change — `documents` table in Postgres is unaffected.
- No change to the Yjs wire protocol, channel names, or event payload shape used by [supabase-yjs-provider.ts](../apps/web/src/lib/collaboration/supabase-yjs-provider.ts).
- No change to the conflict review/merge model — M1b adds encryption and shell UX, not a new merge algorithm.

## Migration and rollout

The existing M1 plaintext IndexedDB cache (`documents`, `outbox`, `meta` snapshot keys, and any legacy per-document `y-indexeddb` databases) is **disposable local cache, not source of truth** — the server is always the durable copy. On the `rhodes-db` schema version bump that ships with M1b.1, stale plaintext `documents`/`outbox` rows are cleared rather than migrated in place. Legacy per-document `y-indexeddb` databases are cleaned up via a dedicated one-time pass (`indexedDB.databases()` enumeration where supported) once the replacement adapter has baked — see M1b.1 slice 10 in [25-offline-app-shell.md](../implementation_plan/25-offline-app-shell.md).

## Related documents

- [implementation_plan/25-offline-app-shell.md](../implementation_plan/25-offline-app-shell.md) — M1b phase plan implementing this design
- [implementation_plan/09-offline-sync.md](../implementation_plan/09-offline-sync.md) — M1 offline foundation (complete)
- [12-offline-sync.md](12-offline-sync.md) — offline + live collaboration product spec
- [28-product-roadmap-to-production.md](28-product-roadmap-to-production.md) — milestone sequencing
