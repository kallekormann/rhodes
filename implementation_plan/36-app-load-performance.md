# App-wide load performance

**Status:** planned — do this before further view polish  
**Symptom:** 10–15s+ loads on every page/view despite little data

## Likely root causes (priority)

### 1. Mega shared client bundle (highest impact)
`AppViewSwitch` statically imports Documents / Editor / Library / Settings / Templates / StickerSheet. `DocumentsView` then statically imports **all six engines** (Kanban, Dashboard, Calendar, Gantt, MindMap, Graph). That pulls TipTap, @xyflow, Gantt, and recharts into the AppShell path for every `(app)` route.

**Fix:** `next/dynamic` per view/engine; never import TipTap/xyflow/gantt/recharts from shared layout. Lazy-load Ask charts only when Ask opens.

### 2. `scopesLoading` blocks first paint
`useWorkspaces` starts `loading: true` and does not hydrate from cache for first paint. Every board view gates on `!workspaceId || scopesLoading`.

**Fix:** Seed scopes from cache with `loading: false`, background-refresh; if `workspaceId` is already known, paint the view immediately.

### 3. Per-view waterfall + no shared cache
Each remount AND-gates scopes ∥ documents ∥ schemas ∥ instances, and hooks refetch with no shared cache:

- `useDocuments(workspaceId, "all")` — API has **no default limit** for `filter=all`, plus share enrichment
- `useMetadataSchemas`, `useScopeViewInstances` — refetch every mount

**Fix:** Workspace-scoped cache (React Query / SWR / small context) for documents, schemas, view-instances; stale-while-revalidate; stop blocking UI when cached data exists.

### 4. Heavy documents payload for boards
Board views request all docs then `enrichDocumentListForWorkspace` + offline vault merge.

**Fix:** Cap/paginate board list payloads; skip share enrichment for board queries; make vault/IDB merge non-blocking for first paint.

### 5. AppProvider + double auth (secondary)
Vault unlock / legacy Yjs cleanup / template fetch on every session; middleware `getUser` then layout `getUser` again.

**Fix:** Defer vault/cleanup to idle or first offline write; reduce duplicate auth round-trips.

## Execution phases

| Phase | Outcome | Verify |
|-------|---------|--------|
| **P0 Measure** | Chrome Performance + Network on `/documents` and `/calendar` | Baseline numbers |
| **P1 Code-split** | Dynamic imports for engines + Editor/Library/Settings | Only active view chunk loads |
| **P2 Scopes first paint** | Cache hydrate; don’t block when `workspaceId` known | Calendar paints &lt;1s warm |
| **P3 Shared data cache** | One cache for docs/schemas/instances across remounts | Docs ↔ Calendar does not re-download everything |
| **P4 Lean board fetch** | Limit/`fields` for board list; optional skip enrich | Smaller `/api/documents?filter=all` |
| **P5 Defer AppProvider work** | Idle vault/cleanup | No multi-second main-thread block on login |

## Success criteria
- Cold navigate to Calendar or Documents: interactive chrome in **&lt;2s** on a normal laptop/dev network
- Warm navigate between views: **&lt;500ms** perceived; no full JS re-parse of TipTap/xyflow
- Network: no duplicate scopes + full document list on every tab switch

## Out of scope
- Further Calendar/Gantt/etc. feature polish until P1–P3 land
