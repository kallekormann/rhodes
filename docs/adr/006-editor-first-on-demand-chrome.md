# ADR 006 — Editor-First On-Demand Chrome

**Status:** accepted  
**Date:** July 2026

## Context

Rhodes must be usable without power-user shortcuts yet as reduced as possible. Pure Cmd+K navigation is too steep. Classic SaaS layouts (permanent sidebar file tree, dashboard home) contradict the writing-focused vision.

## Decision

**Editor-first with On-Demand-Chrome:**

| Always (slim) | On-demand |
|---------------|-----------|
| Header: Space, title, search, +, ⓘ | Insight sidebar |
| | Metadata/tools sidebar |
| | Template page |
| | Search overlay |

- App opens last document — no dashboard grid
- No left sidebar file tree
- Cmd+K supplements visible header controls
- Header auto-hides during writing (Zen)
- Light/Dark mode from V1; exact colors deferred to design session

## References

Inspired by [Obsidian](https://obsidian.md/) (calm, command layer), iA Writer (focus), Linear (precision) — not copied wholesale.

## Consequences

**Positive:**
- Orientable for mouse users; fast for keyboard users
- Writing stays central; chrome disappears when not needed

**Negative:**
- More UI state management than pure Cmd+K app
- Library browse pattern still TBD (O-002)

## Dependencies

- [03-ux-ui-design.md](../03-ux-ui-design.md)
- [03a-design-language.md](../03a-design-language.md)
- [20-workflows.md](../20-workflows.md)
