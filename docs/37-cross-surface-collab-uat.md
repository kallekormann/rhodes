# Cross-surface collaboration UAT

**Status:** Matrix for proving live co-edit across Documents `/editor` and Wiki; documents Mind Map panel limitations.

Room id for Yjs = `ydoc:{documentId}`. Wiki embeds [`EmbeddedDocumentEditor`](../apps/web/src/views/EditorView.tsx), which shares the full Yjs + presence stack with `/editor`. Mind Map’s [`ViewDocumentPanel`](../apps/web/src/components/views/ViewDocumentPanel.tsx) edits via TipTap JSON + `PATCH` — **not** live collab.

**Requirement:** Use **two different users** (or two browser profiles). Same account × two tabs will **not** open the Realtime provider for the second session (presence filters self).

## UAT matrix

| ID | Surfaces | Expectation | Pass? |
|----|----------|-------------|-------|
| **T1** | `/editor` ↔ `/editor` | Live characters ≤2s; remote cursors/presence | |
| **T2** | `/editor` ↔ Wiki embed | Same as T1 (primary ask) | |
| **T3** | Wiki ↔ Wiki | Same as T1 | |
| **T4** | `/editor` ↔ Mind Map panel | **No** live cursors; independent JSON/PATCH vs Yjs — divergence risk if both write | N/A (documented gap) |
| **T5** | Mind Map “Open full page” then collab like T1 | After opening full editor, behaves like T1 | |

## How to run (T2)

1. User A: open the fixture document in **Documents → Open full page** (`/editor?doc=…`).
2. User B: open the same document from a **Wiki** Space tab (center pane embed).
3. DevTools → Network / Realtime: both should join `document-session:{id}` then `ydoc:{id}`.
4. Type on each side; confirm remote text appears within ~2s and cursors show.
5. Happy path should not raise unexpected offline conflict floats.

## Mind Map gap (follow-up)

`ViewDocumentPanel` is intentional explore/edit-without-Yjs for board surfaces. Live Mind Map collab is **out of scope** here — either port the panel to `EmbeddedDocumentEditor` / Yjs, or keep Mind Map as read/explore + “Open full page” for real-time.

## Code-path verification (agent)

Without two live browser profiles in CI/agent sessions:

- **T2 path:** Wiki `EmbeddedDocumentEditor` → `EditorViewContent` `embedded` → same `useEditorSession` / `useYjsCollaboration` as `/editor` → Realtime channel `ydoc:{documentId}`.
- **T4 path:** Mind Map `ViewDocumentPanel` persists body via `PATCH` TipTap JSON (no Yjs provider) — confirmed non-collab.

Operators should still run T1–T3 manually with two users before calling a release done. Mark rows in the matrix above when executed.

## Fix policy

Only fix regressions on the Wiki↔editor path (Yjs/presence). Do not expand Mind Map panel to Yjs under this UAT unless T2 itself is blocked.
