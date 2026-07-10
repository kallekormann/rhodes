# 03a — Design Language

**Status:** draft — tokens finalized in [03b-design-references.md](03b-design-references.md)

## Context

Rhodes should feel elegant, high-quality, and calm — like Obsidian, iA Writer, or Linear. UI component spacing must be comfortable: not too small, not oversized.

## Decision

Establish a **structural design framework** in this doc. **Concrete tokens, wireframes, and component states** live in [03b-design-references.md](03b-design-references.md).

## Specification

### Principles

1. **Typography carries hierarchy** — minimal reliance on icons and color
2. **Violet accent + neutral base** — brand `#7C5CF6`; light from Apple, dark from xAI (see 03b)
3. **Generous whitespace** — editor breathes; chrome is thin
4. **Progressive disclosure** — advanced controls hidden until needed
5. **Light and Dark** — both modes first-class from V1
6. **Lucide icons only** — no emojis, no custom SVG shapes

### Spacing scale

| Token | Value | Use |
|-------|-------|-----|
| `--space-xs` | 4px | Tight inline gaps |
| `--space-sm` | 8px | Icon padding |
| `--space-md` | 16px | Component internal padding |
| `--space-lg` | 24px | Section gaps |
| `--space-xl` | 40px | Min touch/click target |
| `--space-2xl` | 64px | Editor vertical rhythm |

**Rule:** interactive targets minimum **40×40px** effective click area.

### Typography

| Role | Size | Weight |
|------|------|--------|
| Document title | 28px | 600 |
| Editor body | 18px | 400 |
| UI labels | 15px | 400–500 |
| Caption / meta | 13px | 400 |

Editor max line width: **720px** (~65–75 characters per line).

### Light / Dark mode

| Aspect | Behavior |
|--------|----------|
| Default | `prefers-color-scheme` from OS |
| Override | Header `sun` / `moon` toggle + Settings |
| Implementation | CSS custom properties — see 03b |
| Elevation | Hairlines in light; surface steps in dark (no heavy chrome shadows) |

### Color framework

See [03b-design-references.md](03b-design-references.md) for full CSS custom properties (light + dark), status colors, buttons, links, and interaction states.

### Motion

| Interaction | Duration | Easing |
|-------------|----------|--------|
| Header show/hide | 200ms | ease-out |
| Right panel slide | 250ms | ease-out |
| Overlay fade | 150ms | ease |
| Insight indicator | 400ms | ease-in-out (once) |
| Button press | 100ms | scale 0.98 |

`prefers-reduced-motion: reduce` → instant transitions.

### References

- [Obsidian](https://obsidian.md/) — calm, text-first, command palette as power layer
- [iA Writer](https://ia.net/de/writer) — single-column focus, minimal chrome
- Linear — mechanical precision, fast interactions
- [03b-design-references.md](03b-design-references.md) — Apple/xAI token mapping, wireframes

### Still open

- Custom editor mono font option (iA-style)?
- Insight indicator: `lightbulb` icon vs numeric badge?
- Custom accent per Team Space (V2)?

## Dependencies

- [03-ux-ui-design.md](03-ux-ui-design.md)
- [03b-design-references.md](03b-design-references.md)
- [21-i18n.md](21-i18n.md)
