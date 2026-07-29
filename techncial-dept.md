# Technical debt register

**Status:** living document — add items as we discover them during implementation  
**Last updated:** July 29, 2026  
**Owner:** fill in during active milestones; review when closing a milestone or before VPS (M13)

> **Purpose:** One place to track known bugs, debug cruft, and deferred quality work discovered while executing the roadmap. Items here are **intentionally not fixed immediately** when fixing them would collide with in-flight work (e.g. M1b crypto) or when several related issues should be addressed together after a foundational change lands.

---

## How to use this doc

1. **Add** a row when QA, UAT, or implementation finds something we are deferring — include repro steps and the milestone we expect to fix it in.
2. **Update status** when work starts (`planned` → `in progress` → `done`) or when an item is superseded/cancelled.
3. **Link** to the phase plan that will own the fix (e.g. [09.2-offline-conflict-quality.md](implementation_plan/09.2-offline-conflict-quality.md)).
4. **Do not** use this as a substitute for phase exit criteria — shipped milestones still need their own UAT tables.

### Status values

| Status | Meaning |
|--------|---------|
| `open` | Known, not scheduled |
| `planned` | Scheduled in a named phase/milestone |
| `in progress` | Actively being worked |
| `done` | Fixed and verified |
| `wontfix` | Accepted risk with rationale |

---

## Register

| ID | Area | Severity | Status | Fix after | Summary |
|----|------|----------|--------|-----------|---------|
| [TD-001](#td-001-multi-conflict-misclassification) | Offline conflict UI | High | done | [09.2](implementation_plan/09.2-offline-conflict-quality.md) | Second+ conflicts in one review session misclassified (block delete vs inline edit) |
| [TD-002](#td-002-conflict-debug-console-logs) | Offline / collab logging | Low | done | [09.2](implementation_plan/09.2-offline-conflict-quality.md) | Verbose `console.info`/`console.debug` from Phase 09 conflict implementation |
| [TD-003](#td-003-y-indexeddb-per-document-plaintext-store) | Offline Yjs persistence | Medium | done | M1b.1 slices 6–11 → [25](implementation_plan/25-offline-app-shell.md) | Separate UUID IndexedDB DB per open doc (`y-indexeddb`), plaintext Yjs updates |
| [TD-004](#td-004-temp-offline-client-error-log) | Offline QA / debug | Low | in progress | Remove before **M13** | Temporary dev file log (`logs/client-errors.log`) + `__rhodesErrors()` |
| [TD-005](#td-005-unbounded-indexeddb-document-cache) | Client IDB lifecycle | High | done | [27](implementation_plan/27-client-cache-lifecycle.md) (M1c) | LRU cap, metadata-only pull, quota UI |
| [TD-006](#td-006-offline-debug-banner) | Dev UX | Low | open | Remove before **M13** | `OfflineDebugBanner` — opt-in via `__rhodesShowDebugBanner()` |
| [TD-007](#td-007-offline-online-conflict-ui-regression) | Offline conflict UI | High | open | [09.2](implementation_plan/09.2-offline-conflict-quality.md) or hotfix | Conflict review UI no longer appears on offline → online reconnect |
| [TD-008](#td-008-properties-editor-type-specific-ui) | Properties / Studio | Medium | open | Properties Studio / M6 views | Property types need distinct editors (e.g. Options → dropdown, not chips) |
| [TD-009](#td-009-document-sharing-model-and-ux) | Sharing / ACL | High | open | **M2.5b** + **M2.6** | Team-only share gate, private-scope sharing, visibility vs discoverability |

*(Add new rows at the bottom; keep IDs stable.)*

---

## TD-001 — Multi-conflict misclassification

**Status:** planned (fix in Phase 09.2, after M1b crypto)  
**Severity:** High — wrong conflict type misleads the returner’s Keep/Take decision  
**Discovered:** Phase 09.1 UAT (July 27, 2026)  
**Likely origin:** Phase 09 conflict clustering / peer contribution / span detection — not introduced by 09.1 transport work

### Repro

1. Three users on the same document (A, B, C online; A goes offline).
2. **Conflict 1 (Block 1):** User A edits Block 1 offline; User B removes Block 1 online.  
   → Conflict UI **correct** (edit vs removal).
3. **Conflict 2 (Block 2):** User A changes one word in Block 2 offline; User C changes the **same word** in Block 2 online.  
   → Conflict UI **incorrect**: shows User C **removed Block 2** instead of an inline/word-level edit conflict.

### Expected

Block 2 should surface as a **text/span conflict** on the edited word (same class as single-block word overlap), not a block-deletion conflict.

### Suspected code paths (starting points)

- [peer-edit-contributions.ts](apps/web/src/lib/offline/peer-edit-contributions.ts) — peer attribution when multiple deferred updates exist
- [span-conflict-clusters.ts](apps/web/src/lib/offline/span-conflict-clusters.ts) / [conflict-cluster-coalesce.ts](apps/web/src/lib/offline/conflict-cluster-coalesce.ts) — cluster boundaries across blocks
- [useOfflineYjsConflict.ts](apps/web/src/hooks/useOfflineYjsConflict.ts) — review session state when multiple clusters are queued
- [base-aligned-review.ts](apps/web/src/lib/offline/base-aligned-review.ts) — base-relative diff for multi-block batches

### Why deferred until after M1b

M1b changes how document bytes are stored and restored from IndexedDB (encryption, single `rhodes-db` Yjs persistence). Fixing conflict classification now risks duplicate work and makes it harder to separate **crypto/persistence regressions** from **conflict-logic bugs** during M1b UAT. Re-run full M1 + multi-conflict UAT once in [09.2](implementation_plan/09.2-offline-conflict-quality.md).

---

## TD-002 — Conflict debug console logs

**Status:** planned (cleanup in Phase 09.2, after M1b crypto)  
**Severity:** Low — noise only; no functional impact  
**Discovered:** Phase 09.1 UAT (July 27, 2026)

### Description

Verbose logging added during Phase 09 conflict implementation still prints during normal reconnect and conflict review. Examples:

| File | Pattern |
|------|---------|
| [useOfflineYjsConflict.ts](apps/web/src/hooks/useOfflineYjsConflict.ts) | `[offline-patch]` commit / bail logs |
| [peer-edit-contributions.ts](apps/web/src/lib/offline/peer-edit-contributions.ts) | `[peer-edit-contributions] start` |
| [block-audit.ts](apps/web/src/lib/collaboration/block-audit.ts) | `[block-audit] recorded` / `read` |
| [yjs-offline-restore.ts](apps/web/src/lib/offline/yjs-offline-restore.ts) | `[offline-patch] plan summary` |
| [supabase-yjs-provider.ts](apps/web/src/lib/collaboration/supabase-yjs-provider.ts) | `[supabase-yjs-provider] connect` / reconnect (dev-only `NODE_ENV !== 'production'` — keep or gate behind a debug flag) |

### Fix approach (09.2)

- Remove or gate behind `process.env.NODE_ENV === 'development'` **and** an explicit debug flag (e.g. `localStorage.rhodes_debug_conflict`) so production and normal dev sessions stay quiet.
- Keep **one** structured error path for real failures (auth, commit bail on non-owner).

### Why deferred

Logs are still useful while M1b persistence/encryption work is active. Clean up together with TD-001 when conflict flow is re-UAT’d as a batch.

---

## TD-003 — y-indexeddb per-document plaintext store

**Status:** done (shipped in M1b.1 slices 6–11, verified in slice 12)  
**Severity:** Medium — live Yjs CRDT bytes sit in a second, unencrypted IndexedDB database outside `rhodes-db`  
**Discovered:** M1b.1 slice 3 manual QA (July 27, 2026)  
**Not a slice 3 regression** — slice 3 correctly encrypts `rhodes-db.documents`; this was the pre-existing third storage location from Phase 09.

### What you see in DevTools

When a document is open, IndexedDB contains a **separate database named the document UUID** (e.g. `c4d00a5c-3057-4bf6-8feb-5c43864693f2`), created by `y-indexeddb`'s `IndexeddbPersistence` in [useYjsCollaboration.ts](apps/web/src/hooks/useYjsCollaboration.ts):

| Store | Contents |
|-------|----------|
| `updates` | Plaintext `Uint8Array` Yjs update log for the live editing session |
| `custom` | y-indexeddb metadata (often empty) |

Meanwhile `rhodes-db` → `documents` holds the **encrypted JSON snapshot** (`content_enc`, `content_plain_enc`, `metadata_enc`) — that part is working as designed.

### Why it still appears while online

On online reload the hook calls [clearYjsIndexedDbPersistence](apps/web/src/lib/collaboration/yjs-idb.ts) **then immediately** constructs a new `IndexeddbPersistence(documentId, doc)`. The UUID database is deleted and recreated for each editor session — it is expected to exist while the doc is open.

### Fix (shipped)

[M1b.1 slices 6–11](implementation_plan/25-offline-app-shell.md): replaced `IndexeddbPersistence` with `RhodesYjsPersistence` writing encrypted state to `rhodes-db` → `yjs_state` only; removed `y-indexeddb` dependency and added legacy per-doc DB cleanup (slice 10). Grep confirms no remaining `IndexeddbPersistence` / `y-indexeddb` usage in app code (slice 12).

---

## TD-004 — Temp offline client error log

**Status:** in progress — **remove as soon as offline open/create editor bug is diagnosed and fixed**  
**Severity:** Low — debug-only; no product feature  
**Added:** July 27, 2026 (M1b offline QA)

### Purpose

Capture React crashes and unhandled errors to a **file in the repo** (`rhodes-app/logs/client-errors.log`) via a dev-only API route. Survives IndexedDB wipes on crash. In-memory ring buffer for the current browser session (`await __rhodesErrors()`).

**Note:** DevTools “Offline” blocks POST to localhost — keep the Next dev server running and use Network throttling instead of full Offline if you need file capture while simulating a dead backend.

### Removal checklist (delete all of this when bug is fixed)

| Action | Path |
|--------|------|
| Delete | [client-error-log.ts](apps/web/src/lib/dev/client-error-log.ts) |
| Delete | [client-error-log.test.ts](apps/web/src/lib/dev/client-error-log.test.ts) |
| Delete | [client-error-log-server.ts](apps/web/src/lib/dev/client-error-log-server.ts) |
| Delete | [client-error-log-server.test.ts](apps/web/src/lib/dev/client-error-log-server.test.ts) |
| Delete | [client-error-log-types.ts](apps/web/src/lib/dev/client-error-log-types.ts) |
| Delete | [client-error-log-path.ts](apps/web/src/lib/dev/client-error-log-path.ts) |
| Delete | [api/dev/client-errors/route.ts](apps/web/src/app/api/dev/client-errors/route.ts) |
| Delete | [EditorErrorBoundary.tsx](apps/web/src/components/EditorErrorBoundary.tsx) |
| Revert | [AppShell.tsx](apps/web/src/components/AppShell.tsx) — remove `installClientErrorLog()` |
| Revert | [AppErrorBoundary.tsx](apps/web/src/components/AppErrorBoundary.tsx) — remove `appendClientError` + log hint |
| Revert | [EditorView.tsx](apps/web/src/views/EditorView.tsx) — remove `EditorErrorBoundary`, `sessionError` UI, log copy |
| Revert | [EditorView.css](apps/web/src/views/EditorView.css) — remove `.editor-content__load-error*` rules |
| Delete | [logs/.gitkeep](logs/.gitkeep) (optional) |
| Delete | [OfflineDebugBanner.tsx](apps/web/src/components/OfflineDebugBanner.tsx) |
| Delete | [debug-banner.ts](apps/web/src/lib/dev/debug-banner.ts) |
| Revert | [AppShell.tsx](apps/web/src/components/AppShell.tsx) — remove `<OfflineDebugBanner />` |
| Revert | [global.css](apps/web/src/styles/global.css) — remove `.offline-debug-banner*` rules |
| Revert | [client-error-log-init.ts](apps/web/src/lib/dev/client-error-log-init.ts) — remove `installDebugBannerConsoleHelpers()` |

Log file on disk: `rhodes-app/logs/client-errors.log` (gitignored via `*.log`)

### Why temporary

Production error reporting should use a proper pipeline (Sentry, etc.), not a dev log file in the repo.

---

## TD-005 — Unbounded IndexedDB document cache

**Status:** done (M1c / Phase 27, July 28, 2026)  
**Severity:** High — users with many documents will exhaust browser storage quota  
**Discovered:** M1b polish + roadmap planning (July 28, 2026)

### Resolution

- LRU eviction per workspace (cap 100 synced docs); `last_accessed_at` on read/write.
- Background `pullWorkspaceDocuments` advances cursor only (`include_body=false`).
- Settings → Storage → Offline cache panel + quota banner at ~50MB.

See [implementation_plan/27-client-cache-lifecycle.md](implementation_plan/27-client-cache-lifecycle.md).

---

## TD-006 — Offline debug banner (dev-only UI)

**Status:** open — **default off** in dev as of July 28, 2026; **delete before M13**  
**Severity:** Low — blocks bottom of app when enabled  
**Related:** TD-004 error-log stack

### Component

| File | Role |
|------|------|
| [OfflineDebugBanner.tsx](apps/web/src/components/OfflineDebugBanner.tsx) | Red sticky strip |
| [debug-banner.ts](apps/web/src/lib/dev/debug-banner.ts) | Opt-in flag + console helpers |
| [AppShell.tsx](apps/web/src/components/AppShell.tsx) | Mount point |

### Dev usage

- Show: `await __rhodesShowDebugBanner()` (or `localStorage.setItem("rhodes:debug_banner", "1")` + reload)
- Hide: `await __rhodesHideDebugBanner()`

### Production gate

Must not ship to end users. Remove component and styles in M13 pre-launch cleanup (with TD-004).

---

## TD-007 — Offline → online conflict UI regression

**Status:** open  
**Severity:** High — users may silently lose merge control after reconnect  
**Discovered:** Ad-hoc QA (July 29, 2026)

### Description

The offline → online **conflict review UI** (Keep / Take / review flow) is **not showing up** in scenarios where it previously did. This is a **regression** on top of TD-001 (misclassification when UI *does* show).

### Expected

When offline edits conflict with online changes on reconnect, the conflict review surface should appear so the returner can resolve before continuing.

### Suspected code paths (starting points)

- [useOfflineYjsConflict.ts](apps/web/src/hooks/useOfflineYjsConflict.ts)
- [yjs-offline-restore.ts](apps/web/src/lib/offline/yjs-offline-restore.ts)
- [EditorView.tsx](apps/web/src/views/EditorView.tsx) — conflict overlay mount
- M1b persistence path (`RhodesYjsPersistence`) — restore may skip conflict detection

### Fix after

- **Hotfix** if repro is stable and blocks M1 exit retest.
- Otherwise batch with [09.2](implementation_plan/09.2-offline-conflict-quality.md) alongside TD-001 / TD-002.

### Notes

- Repro steps TBD — capture: scope, doc id, offline duration, who edited online, whether UI never appears vs appears then dismisses.

---

## TD-008 — Properties editor: type-specific UI

**Status:** open  
**Severity:** Medium — wrong control affordances confuse authors and break data entry at scale  
**Discovered:** Ad-hoc QA (July 29, 2026)

### Description

The document **Properties** editor does not yet reflect property **types** in the UI. Controls should match semantic type, not a one-size-fits-all pattern.

### Known gap (example)

| Property type | Current (approx.) | Desired |
|---------------|-------------------|---------|
| **Options** (single/multi select) | Clickable chips | **Dropdown** (or select menu) — chips are noisy for long option lists; confirm multi-select pattern in design |

### Product / design needed

- Per-type control map: text, number, date, boolean, options (single vs multi), relation, etc.
- Align with [implementation_plan/07b-ux-properties-studio.md](implementation_plan/07b-ux-properties-studio.md) and sticker-sheet patterns.

### Fix after

Properties Studio polish or **M6** views/templates work — whichever owns Properties tab UX next.

---

## TD-009 — Document sharing model and UX

**Status:** open  
**Severity:** High — private-scope sharing blocked; team share discoverability unclear  
**Discovered:** Ad-hoc QA (July 29, 2026)  
**Fix after:** **M2.5b** (share-to-team UX) + **M2.6** (guests, invite-by-link, delegate-invite)

### Context

Share today is tied to `document_shares` and workspace membership. M2 product model: documents stay in the author’s scope; share = live grant (see [docs/07-individual-vs-team.md](docs/07-individual-vs-team.md)).

### Sub-issues

#### TD-009a — Who can be invited via Share popover?

**Current pain:** Sharing appears limited to users already in the **same team scope** (or visible membership), which blocks sensible private-scope sharing.

**Options to decide (not mutually exclusive):**

| Option | Behavior |
|--------|----------|
| **A — Same team only** | Share popover lists only members of the active team scope. Simple ACL; private docs cannot share to arbitrary emails. |
| **B — Discoverable by email/name** | User types email or display name; system resolves **if** policy allows (org/scope `external_collaborators`, guest invite, etc.). Required for private → person share. |

**Needed:** Policy gates per scope/org ([docs/30-scope-settings-matrix.md](docs/30-scope-settings-matrix.md)) + SharePopover search API.

#### TD-009b — Visibility vs prior share grants

**Observed / reported:** Users who were shared a document may still **see each other** (or remain visible in share UI) after one party sets their own visibility to **invisible** / hidden.

**Expected (TBD):** Clarify product rule:

- Does “invisible” affect **directory discoverability** only, or **revoke** existing share relationships?
- Should prior grantees remain on the document’s share list even if they hide themselves from global user search?

**Needed:** Spec visibility flag on `profiles` vs `document_shares` lifecycle; UI copy in Share popover.

#### TD-009c — Private-scope vs team-scope document sharing

**Current pain:** In practice **only team documents** can be shared — consistent with TD-009a/b (membership + visibility), but **contradicts M2** goal: share **from private scope** to people or teams without moving the doc.

**Expected (M2.5b):**

- **Private scope:** Share to users (email) and/or teams via `document_shares`; doc stays in private scope.
- **Team scope:** Share within policy (team members, linked teams, guests per M2.6).

**Needed:** SharePopover team picker, “Shared with us” list, enforce scope policies on share API — see [implementation_plan/15-scopes-org-teams-settings.md](implementation_plan/15-scopes-org-teams-settings.md) M2.5b.

### Suspected code paths

- [SharePopover.tsx](apps/web/src/components/SharePopover.tsx)
- Document share API routes + `document_shares` RLS
- Workspace member listing vs cross-scope collaborator search

---

## Related documents

- [implementation_plan/09.2-offline-conflict-quality.md](implementation_plan/09.2-offline-conflict-quality.md) — planned fix phase (after M1b)
- [implementation_plan/09-m1-exit-collab-offline.md](implementation_plan/09-m1-exit-collab-offline.md) — M1 UAT script to extend for multi-conflict cases
- [implementation_plan/09.1-realtime-transport-hardening.md](implementation_plan/09.1-realtime-transport-hardening.md) — transport UAT that surfaced TD-001 / TD-002
- [implementation_plan/25-offline-app-shell.md](implementation_plan/25-offline-app-shell.md) — current milestone (M1b)
- [docs/28-product-roadmap-to-production.md](docs/28-product-roadmap-to-production.md) — sequencing
- [implementation_plan/15-scopes-org-teams-settings.md](implementation_plan/15-scopes-org-teams-settings.md) — M2.5b sharing UX
- [implementation_plan/07b-ux-properties-studio.md](implementation_plan/07b-ux-properties-studio.md) — properties type UI
