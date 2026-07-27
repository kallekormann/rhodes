# 32 — Technical debt register

**Status:** living document — add items as we discover them during implementation  
**Last updated:** July 27, 2026  
**Owner:** fill in during active milestones; review when closing a milestone or before VPS (M13)

> **Purpose:** One place to track known bugs, debug cruft, and deferred quality work discovered while executing the roadmap. Items here are **intentionally not fixed immediately** when fixing them would collide with in-flight work (e.g. M1b crypto) or when several related issues should be addressed together after a foundational change lands.

---

## How to use this doc

1. **Add** a row when QA, UAT, or implementation finds something we are deferring — include repro steps and the milestone we expect to fix it in.
2. **Update status** when work starts (`planned` → `in progress` → `done`) or when an item is superseded/cancelled.
3. **Link** to the phase plan that will own the fix (e.g. [09.2-offline-conflict-quality.md](../implementation_plan/09.2-offline-conflict-quality.md)).
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
| [TD-001](#td-001-multi-conflict-misclassification) | Offline conflict UI | High | planned | M1b complete → [09.2](../implementation_plan/09.2-offline-conflict-quality.md) | Second+ conflicts in one review session misclassified (block delete vs inline edit) |
| [TD-002](#td-002-conflict-debug-console-logs) | Offline / collab logging | Low | planned | M1b complete → [09.2](../implementation_plan/09.2-offline-conflict-quality.md) | Verbose `console.info`/`console.debug` from Phase 09 conflict implementation |

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

- [peer-edit-contributions.ts](../apps/web/src/lib/offline/peer-edit-contributions.ts) — peer attribution when multiple deferred updates exist
- [span-conflict-clusters.ts](../apps/web/src/lib/offline/span-conflict-clusters.ts) / [conflict-cluster-coalesce.ts](../apps/web/src/lib/offline/conflict-cluster-coalesce.ts) — cluster boundaries across blocks
- [useOfflineYjsConflict.ts](../apps/web/src/hooks/useOfflineYjsConflict.ts) — review session state when multiple clusters are queued
- [base-aligned-review.ts](../apps/web/src/lib/offline/base-aligned-review.ts) — base-relative diff for multi-block batches

### Why deferred until after M1b

M1b changes how document bytes are stored and restored from IndexedDB (encryption, single `rhodes-db` Yjs persistence). Fixing conflict classification now risks duplicate work and makes it harder to separate **crypto/persistence regressions** from **conflict-logic bugs** during M1b UAT. Re-run full M1 + multi-conflict UAT once in [09.2](../implementation_plan/09.2-offline-conflict-quality.md).

---

## TD-002 — Conflict debug console logs

**Status:** planned (cleanup in Phase 09.2, after M1b crypto)  
**Severity:** Low — noise only; no functional impact  
**Discovered:** Phase 09.1 UAT (July 27, 2026)

### Description

Verbose logging added during Phase 09 conflict implementation still prints during normal reconnect and conflict review. Examples:

| File | Pattern |
|------|---------|
| [useOfflineYjsConflict.ts](../apps/web/src/hooks/useOfflineYjsConflict.ts) | `[offline-patch]` commit / bail logs |
| [peer-edit-contributions.ts](../apps/web/src/lib/offline/peer-edit-contributions.ts) | `[peer-edit-contributions] start` |
| [block-audit.ts](../apps/web/src/lib/collaboration/block-audit.ts) | `[block-audit] recorded` / `read` |
| [yjs-offline-restore.ts](../apps/web/src/lib/offline/yjs-offline-restore.ts) | `[offline-patch] plan summary` |
| [supabase-yjs-provider.ts](../apps/web/src/lib/collaboration/supabase-yjs-provider.ts) | `[supabase-yjs-provider] connect` / reconnect (dev-only `NODE_ENV !== 'production'` — keep or gate behind a debug flag) |

### Fix approach (09.2)

- Remove or gate behind `process.env.NODE_ENV === 'development'` **and** an explicit debug flag (e.g. `localStorage.rhodes_debug_conflict`) so production and normal dev sessions stay quiet.
- Keep **one** structured error path for real failures (auth, commit bail on non-owner).

### Why deferred

Logs are still useful while M1b persistence/encryption work is active. Clean up together with TD-001 when conflict flow is re-UAT’d as a batch.

---

## Related documents

- [09.2-offline-conflict-quality.md](../implementation_plan/09.2-offline-conflict-quality.md) — planned fix phase (after M1b)
- [09-m1-exit-collab-offline.md](../implementation_plan/09-m1-exit-collab-offline.md) — M1 UAT script to extend for multi-conflict cases
- [09.1-realtime-transport-hardening.md](../implementation_plan/09.1-realtime-transport-hardening.md) — transport UAT that surfaced TD-001 / TD-002
- [25-offline-app-shell.md](../implementation_plan/25-offline-app-shell.md) — current milestone (M1b)
- [28-product-roadmap-to-production.md](28-product-roadmap-to-production.md) — sequencing
