# 20 — User Workflows

**Status:** draft

## Context

Every core action must be achievable in ≤3 steps. Workflows document both **mouse paths** (primary, for orientation) and **Cmd+K paths** (power users).

## Decision

Mouse-accessible header anchors are the primary navigation; Cmd+K mirrors the same actions.

## Specification

### W1 — Resume writing (default)

| Step | Action |
|------|--------|
| 1 | Open app → last document loads in editor |
| 2 | Type |

**Steps:** 0 clicks before writing.

---

### W2 — New document

| Path | Steps |
|------|-------|
| **Mouse** | Header `+` → "Blank" → type |
| **Cmd+K** | "New document" → Enter → type |
| **With template** | `+` → "From template" → pick card → type |

---

### W3 — Discover insight (core USP)

| Step | Action |
|------|--------|
| 1 | Type (3s debounce triggers background embedding + search) |
| 2 | Click `• N` indicator on right edge |
| 3 | Read matches → optional expand split-screen → "Insert quote" |

**Insight without click:** indicator only appears; user chooses when to look.

---

### W4 — Import PDF / DOCX

| Path | Steps |
|------|-------|
| **Drag-drop** | Drop file on editor or library area → toast "Indexing…" → done |
| **Mouse** | Scope → Library → drag file into drop zone |
| **Cmd+K** | "Import file" → file picker |

Next writing session: file appears in insight matches automatically.

---

### W5 — Switch to team knowledge

| Path | Steps |
|------|-------|
| **Mouse** | Header Space ▾ → select team space |
| **Cmd+K** | "Switch to [Team Name]" |

AI retrieval scoped to selected space only. No cross-space leakage.

---

### W6 — Find a document

| Path | Steps |
|------|-------|
| **Mouse** | Header 🔍 → type query → Enter |
| **Cmd+K** | Type query (fuzzy + semantic) → Enter |

Recent documents also appear in template page and search when query empty.

---

### W7 — Edit metadata

| Path | Steps |
|------|-------|
| **Mouse** | Header ⓘ → right sidebar → edit fields → click outside to close |
| **Cmd+K** | "Document info" → same sidebar |

---

### W8 — Choose template

| Path | Steps |
|------|-------|
| **Mouse** | `+` → "From template" → template page → select |
| **Cmd+K** | "New from template" → select |

Returns to editor with injected section structure. Not shown on app launch.

---

### W9 — Knowledge Bridge email (passive)

| Step | Action |
|------|--------|
| 1 | System emails weekly connections (if enabled) |
| 2 | User clicks deep link → opens document with insight pre-selected |

---

### W10 — Offline writing

| Step | Action |
|------|--------|
| 1 | Network lost → one-time toast: "Offline — saved locally" |
| 2 | Continue writing |
| 3 | Reconnect → silent background sync |

---

### W11 — Change language

| Path | Steps |
|------|-------|
| **Mouse** | Avatar → Settings → Profile → Language → Save |
| Effect | UI relabels immediately; LLM uses new locale for system messages |

---

### W12 — Toggle dark mode

| Path | Steps |
|------|-------|
| **Mouse** | Avatar → Settings → Preferences → Theme → Light / Dark / System |

---

### W13 — Create team space

| Path | Steps |
|------|-------|
| **Mouse** | Settings → Spaces → Create team → name → Create |
| **Requires** | [Team billing tier](25-billing-lemonsqueezy.md) |

---

### W14 — Invite team member

| Path | Steps |
|------|-------|
| **Mouse** | Settings → Team → Invite → email + role → Send |

---

### W15 — Export my data (GDPR)

| Path | Steps |
|------|-------|
| **Mouse** | Settings → Privacy → Download my data |
| **Result** | Email with ZIP link when ready — [24-privacy-user-tools.md](24-privacy-user-tools.md) |

---

### W16 — Delete account

| Path | Steps |
|------|-------|
| **Mouse** | Settings → Privacy → Delete account → type email to confirm |
| **See** | [22-authentication-and-accounts.md](22-authentication-and-accounts.md) |

---

### W17 — Upgrade plan

| Path | Steps |
|------|-------|
| **Mouse** | Settings → Billing → Upgrade → LemonSqueezy checkout |
| **See** | [25-billing-lemonsqueezy.md](25-billing-lemonsqueezy.md) |

## Workflow principles

1. **Writing never blocks** — AI and sync are always background
2. **Same action, two paths** — mouse and keyboard equivalent
3. **Transient UI** — sidebars and overlays close after task completion
4. **No dead ends** — every overlay has Back, Escape, or outside-click close

## Open questions

- Onboarding tour for first-time users (3-step tooltip)?
- Default insight sidebar: open on first match ever (once)?

## Dependencies

- [03-ux-ui-design.md](03-ux-ui-design.md)
- [05-ai-and-rag.md](05-ai-and-rag.md)
- [12-offline-sync.md](12-offline-sync.md)
- [22-authentication-and-accounts.md](22-authentication-and-accounts.md)
- [23-user-settings-and-spaces.md](23-user-settings-and-spaces.md)
- [24-privacy-user-tools.md](24-privacy-user-tools.md)
- [25-billing-lemonsqueezy.md](25-billing-lemonsqueezy.md)
