# ADR 003 — TipTap Editor

**Status:** accepted  
**Date:** July 2026

## Context

Rhodes needs a headless, extensible rich-text editor with slash commands, JSON storage, tables, images, and custom citation blocks — while staying minimal in the UI.

## Decision

Use **TipTap** (ProseMirror-based) with `@tiptap/react`. Curated extension set; bubble menu only; custom CitationBlock extension.

## Alternatives considered

| Option | Rejected because |
|--------|------------------|
| Lexical | Larger migration; less mature table story |
| BlockNote | Too opinionated block UI — feels like Notion |
| Plate | Tightly coupled to shadcn patterns |
| Raw ProseMirror | Too much boilerplate |

## Consequences

**Positive:**
- PRD alignment; slash commands out of the box
- JSON maps directly to `documents.content jsonb`

**Negative:**
- ProseMirror learning curve for custom extensions
- Bundle size — mitigate with dynamic imports

## Dependencies

- [11-editor-tiptap.md](../11-editor-tiptap.md)
