# 09 — Document History

**Status:** draft

## Context

The PRD schema has no versioning. Users and teams need undo, audit, and the system needs diff-based re-embedding.

## Decision

Implement `document_versions` with automatic snapshots on debounced save — not full real-time CRDT in V1.

## Specification

### Schema

See [04-data-model.md](04-data-model.md) — `document_versions` table.

### Snapshot triggers

| Trigger | When |
|---------|------|
| Auto | 5 minutes after last edit if content changed |
| Manual | User clicks "Save version" in ⓘ sidebar (optional label) |
| Milestone | Title change or template apply |

Not on every keystroke — debounced to reduce storage.

### Retention

| Tier | Retention |
|------|-----------|
| Free | Last 10 versions per document |
| Pro | Last 50 versions |
| Team | Last 100 versions + audit export |

Older versions pruned by nightly cron.

### UI

- ⓘ sidebar → "History" section → list with timestamp + author
- Click version → read-only preview in split panel
- "Restore this version" → creates new version from current, then applies old content

### Value by stakeholder

| Stakeholder | Value |
|-------------|-------|
| **User** | Undo mistakes; compare drafts; safe experimentation |
| **Team** | See how a spec evolved; onboarding context |
| **System** | Diff plain text → re-embed only if >15% changed; better retention emails |

### Re-embedding integration

```typescript
const diffRatio = levenshtein(oldPlain, newPlain) / oldPlain.length;
if (diffRatio > 0.15) {
  queueEmbed(documentId);
}
```

### Library sources

Library files are immutable after ingest — no version history. Re-upload creates new source.

## Open questions

- Named versions ("v1.0", "Final")?
- Team-wide activity feed from version events (V2)?

## Dependencies

- [04-data-model.md](04-data-model.md)
- [05-ai-and-rag.md](05-ai-and-rag.md)
- [12-offline-sync.md](12-offline-sync.md)
