# M1 — Phase 09 exit: Collab + offline

**Status:** ready to execute  
**Milestone:** M1 (roadmap)  
**Parent plan:** [Collaboration & roadmap status](../../.cursor/plans/collaboration_and_roadmap_status_e3e5744e.plan.md)  
**Phase spec:** [09-offline-sync.md](09-offline-sync.md) · [docs/12-offline-sync.md](../docs/12-offline-sync.md)  
**Branch:** `feature/phase-09-offline-wave-a` (checkpoint `e98f76a`)  
**Environment:** Local Docker only — no VPS  
**Goal:** Close Phase 09 with verified UAT, green tests, doc sync, merge to `dev`

---

## Exit definition

M1 is **done** when all of the following are true:

1. Manual UAT steps 1–5 in [docs/12-offline-sync.md](../docs/12-offline-sync.md) pass on local Docker with two users.
2. `pnpm test:offline` passes in `apps/web`.
3. Open decisions below are recorded (spec updated if needed).
4. Stale code/docs cleaned up (orphan files, outdated Wave B/C references).
5. [09-offline-sync.md](09-offline-sync.md) testing checklist checked; status → complete.
6. Branch merged to `dev` (PR or direct merge per your workflow).

**Not required for M1 exit (defer to M4 / Phase 17):**

- Offline comment union + re-anchor on Yjs reconnect (unless you explicitly pull into tomorrow).
- Inline variant rows below blocks (if float + modal UX is accepted).
- Write-third-variant conflict card.
- E2E conflict spec — run if fixture exists; **not a hard gate** if manual UAT passes and env is not set up.

---

## Before you start (5 min)

### Stack

```bash
cd rhodes-app
docker compose up -d   # Postgres, Supabase, Redis, Ollama, worker, Mailpit, etc.
cd apps/web && pnpm dev   # or root dev script — app on :3001
```

Confirm migration `00045_document_yjs_state.sql` is applied.

### Two test users

You need **User A** and **User B** in the **same team workspace**, with a **shared document** both can edit.

| Item | How |
|------|-----|
| Users | Two accounts (or create via Supabase / signup) |
| Shared doc | Share document from User A to team; User B opens same doc URL |
| Doc ID | Copy UUID from URL for optional E2E |

### Browsers

- **Browser 1:** User A (normal window)
- **Browser 2:** User B (incognito or second browser profile)

Optional: DevTools → Network → **Offline** checkbox for User A only.

---

## Morning decisions (15 min — do first)

Record answers in this doc or in a commit message before heavy UAT.

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| D1 | Conflict review UX | A) Accept **float + compare modal + inline highlights** · B) Build variant rows below blocks | **A** — ship what’s built; update `docs/12-offline-sync.md` table |
| D2 | Offline comment re-anchor | A) Fix in M1 · B) Defer to Phase 17 | **B** unless UAT step 5 fails badly |
| D3 | `ConflictReviewBar.tsx` | A) Delete orphan · B) Wire as thin top bar | **A** if D1 = float/modal |
| D4 | E2E conflict spec | Run with `RHODES_E2E_CONFLICT=1` or skip | Run if `.env.e2e.local` + shared doc fixture ready |

---

## Execution schedule (tomorrow)

| Block | Time | Task |
|-------|------|------|
| 1 | 30 min | Decisions D1–D4; start Docker; open shared doc in two browsers |
| 2 | 45 min | UAT steps 1–2 (live collab) |
| 3 | 60 min | UAT steps 3–4 (offline merge + conflict) — core of the day |
| 4 | 30 min | UAT step 5 (comments) + hard refresh / reload checks |
| 5 | 20 min | `pnpm test:offline`; fix regressions if any |
| 6 | 20 min | Cleanup + doc updates |
| 7 | 15 min | Merge to `dev`; tick M1 in roadmap plan |

---

## Manual UAT script

Use the same document for all steps. Note **PASS / FAIL** and a one-line note per step.

### Step 1 — Live typing (both online)

1. User A and User B open the shared document.
2. User A clicks a paragraph and types several characters.
3. **Expect:** User B sees characters appear in the same place within ~2s. No conflict float. Collaboration cursors may show.

**If fail:** Check browser console for Realtime/auth errors; verify both users are authenticated; see [useYjsCollaboration.ts](../apps/web/src/hooks/useYjsCollaboration.ts), [supabase-yjs-provider.ts](../apps/web/src/lib/collaboration/supabase-yjs-provider.ts).

### Step 2 — Live block add (both online)

1. User A adds a new paragraph or heading (Enter / slash).
2. **Expect:** User B sees the new block without conflict UI.

### Step 3 — Offline different blocks (auto-merge)

1. User A: DevTools → **Offline**.
2. User A edits **block 1** (distinct text).
3. User B (online): edits **block 2** (different block).
4. User A: go **Online**; wait ~5–10s.
5. **Expect:** Both edits present. **No** conflict float for User A. User B never saw conflict UI.

### Step 4 — Offline overlapping edit (Mode C)

1. User A: **Offline**.
2. User A: edit block X — e.g. select all, type `User A overlap text`.
3. User B (online): edit **same block** — e.g. `User B overlap text`.
4. User A: **Online**; wait for conflict detection.
5. **Expect:**
   - User A sees conflict float (“conflicting change”) and yellow highlights on affected span(s).
   - Click highlight → compare modal opens.
   - Keep / Dismiss resolves cluster; after all resolved, doc converges for both users.
   - User B does **not** see conflict float during A’s review.
6. **Expect:** User B’s view is not garbled mid-review; after A finishes, both see consistent body.

**If fail:** [useOfflineYjsConflict.ts](../apps/web/src/hooks/useOfflineYjsConflict.ts) — shield timing, `flushPendingBroadcasts`, deferred peer updates.

### Step 5 — Comments (optional / defer)

1. User A offline: add comment on a block.
2. User B online: add comment on another block.
3. User A online: merge completes.
4. **Expect:** Both comments visible with correct authors and anchors.

If step 5 fails and D2 = defer: note as known gap for Phase 17; do not block M1.

### Extra checks (quick)

| Check | Expect |
|-------|--------|
| Hard refresh (User A, online) | Content matches server; no flash-revert |
| Sync indicator | Shows Offline / Saving / Synced appropriately |
| Title/metadata edit online | Saves (outbox path; not Yjs body) |

---

## Automated tests

```bash
cd rhodes-app/apps/web

# Unit — required
pnpm test:offline

# E2E — optional if fixture configured
# Create tests/e2e/.env.e2e.local with:
#   RHODES_E2E_USER_A_EMAIL=...
#   RHODES_E2E_USER_A_PASSWORD=...
#   RHODES_E2E_USER_B_EMAIL=...
#   RHODES_E2E_USER_B_PASSWORD=...
#   RHODES_E2E_DOC_ID=<shared-doc-uuid>
# Then:
RHODES_E2E_CONFLICT=1 pnpm test:e2e:offline
```

Spec: [offline-conflict.spec.ts](../apps/web/tests/e2e/offline/offline-conflict.spec.ts) — asserts User A sees conflict text, User B does not.

---

## Fix playbook (if UAT fails)

| Symptom | Likely area | Files |
|---------|-------------|-------|
| B never sees A’s live edits | Realtime auth / provider | `useYjsCollaboration.ts`, `supabase-yjs-provider.ts` |
| Hard refresh reverts body | IDB vs server merge order | `useYjsCollaboration.ts`, `yjs-idb.ts` |
| Merge before conflict UI | Shield race on `online` | `useOfflineYjsConflict.ts` (capture-phase listener) |
| Wrong highlight position | Block char → doc mapping | `block-positions.ts`, `conflict-highlight-ranges.ts`, `ConflictInlineExtension.ts` |
| Click highlight no modal | Event wiring | `ConflictInlineExtension.ts`, `EditorView.tsx` |
| B sees A’s conflict UI | Awareness / broadcast leak | `supabase-yjs-provider.ts`, deferred `pendingBroadcastsRef` |
| Both cursors while A offline | Provider never disconnected on `offline` | `supabase-yjs-provider.ts` — **fixed**: disconnect transport + gate outbound |
| Merged A+B text during A’s review | Reconnect race before shield | `useOfflineYjsConflict.ts`, `supabase-yjs-provider.ts` — **fixed**: `offlineSessionPending` defers inbound |
| Compare modal shows base-relative diff | Modal diffed vs original | `ConflictCompareModal.tsx`, `conflict-compare-panes.ts` — **fixed**: mine vs theirs |
| Comment highlight but empty sidebar | Metadata not synced when `isDirty` | `useDocumentRealtime.ts`, `useEditorSession.ts` — **fixed** |
| DevTools Offline still syncs (intermittent) | localhost WS quirk | Hard refresh helps hygiene; provider disconnect is the real fix |

**Rule:** Prefer minimal fixes; no new features during M1.

---

## Cleanup checklist

- [ ] Delete [ConflictReviewBar.tsx](../apps/web/src/components/ConflictReviewBar.tsx) if D3 = delete
- [ ] Remove orphan [DocumentRemoteConflictBanner.css](../apps/web/src/components/DocumentRemoteConflictBanner.css) if unused (grep first)
- [ ] Update [09-offline-sync.md](09-offline-sync.md):
  - Wave C → **implemented**
  - Remove references to deleted `DocumentRemoteConflictBanner.tsx` / `DocumentConflictReview.tsx`
  - Revise exit criteria for Yjs body (not outbox 409 for content)
  - Check testing checklist items
- [ ] Update [docs/12-offline-sync.md](../docs/12-offline-sync.md) conflict UI row if D1 = float/modal
- [ ] Update [00-README.md](00-README.md): Phase 09 → complete; remove “blocks Phase 13” (VPS last per roadmap)

---

## Key files reference

| Area | Path |
|------|------|
| Yjs init + server merge | `apps/web/src/hooks/useYjsCollaboration.ts` |
| Offline conflict lifecycle | `apps/web/src/hooks/useOfflineYjsConflict.ts` |
| Single commit builder | `apps/web/src/lib/offline/offline-conflict-commit.ts` |
| Detection / structural kinds | `apps/web/src/lib/offline/yjs-offline-divergence.ts` |
| Per-block peer attribution | `apps/web/src/lib/offline/peer-edit-contributions.ts` |
| Realtime provider | `apps/web/src/lib/collaboration/supabase-yjs-provider.ts` |
| Editor wiring | `apps/web/src/hooks/useEditorSession.ts`, `apps/web/src/views/EditorView.tsx` |
| Conflict UI | `DocumentConflictFloat.tsx`, `ConflictCompareModal.tsx`, `ConflictInlineExtension.ts` |
| Span clusters | `apps/web/src/lib/offline/span-conflict-clusters.ts` |
| Yjs persistence API | `apps/web/src/app/api/documents/[id]/yjs/route.ts` |
| Migration | `supabase/migrations/00045_document_yjs_state.sql` |
| Title/metadata sync | `apps/web/src/lib/offline/sync-engine.ts` |
| Runtime conflict docs | `docs/12-offline-sync.md` (§ Yjs offline conflict) |

---

## Merge checklist

- [ ] All M1 exit criteria above met
- [ ] `pnpm test:offline` green
- [ ] No debug logging left in collab hooks
- [ ] UAT results noted (PASS/FAIL per step) in PR description or this doc
- [ ] Merge `feature/phase-09-offline-wave-a` → `dev`
- [ ] Mark M1 todos complete in [roadmap plan](../../.cursor/plans/collaboration_and_roadmap_status_e3e5744e.plan.md)

---

## UAT results (fill in tomorrow)

| Step | Result | Notes |
|------|--------|-------|
| 1 Live typing | PASS | |
| 2 Live block add | PASS | |
| 3 Offline different blocks | PASS | Auto-merge, both edits, both cursors after reconnect |
| 4 Offline overlap (Mode C) | PASS | Structural Y.Doc restore during review; Keep applies full mine text; no drift on modal close |
| 5 Comments | FAIL → **re-test** | Inline highlight without sidebar until hard refresh. Code fix applied. |
| Hard refresh | | |
| `pnpm test:offline` | PASS | 23 tests |
| E2E conflict (optional) | | |

**Decisions taken:** D1 __ · D2 __ · D3 __ · D4 __

**Merged to `dev`:** date __ · commit __
