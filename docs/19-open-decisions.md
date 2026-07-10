# 19 — Open Decisions

**Status:** living document

## Context

Track unresolved questions across the Rhodes spec. Update as decisions are made and move to ADRs when final.

## Accepted decisions

| ID | Decision | ADR / Doc |
|----|----------|-----------|
| D-001 | Full VPS self-hosted | [adr/001](adr/001-full-vps-self-hosted.md) |
| D-002 | CPU-only Ollama, no GPU | [adr/002](adr/002-ollama-cpu-only.md) |
| D-003 | TipTap editor | [adr/003](adr/003-tiptap-editor.md) |
| D-004 | nomic-embed-text 768D | [adr/004](adr/004-embedding-model-768d.md) |
| D-005 | Managed email relay (Resend/SES) | [adr/005](adr/005-managed-email-relay.md) |
| D-006 | Editor-first On-Demand-Chrome UI | [adr/006](adr/006-editor-first-on-demand-chrome.md) |
| D-007 | EN primary, ES/DE/FR/IT | [21-i18n.md](21-i18n.md) |
| D-009 | Supabase Auth for identity | [22-authentication-and-accounts.md](22-authentication-and-accounts.md) |
| D-010 | LemonSqueezy billing | [25-billing-lemonsqueezy.md](25-billing-lemonsqueezy.md) |
| D-011 | Custom GDPR export/delete (not third-party lib) | [24-privacy-user-tools.md](24-privacy-user-tools.md) |
| D-012 | Launch domain: `rhodes.quinsy.app` — marketing at `/`, product at `/app` | [14-marketing-website.md](../implementation_plan/14-marketing-website.md) |

**Note on D-012:** `rhodes.quinsy.app` is the **validated launch domain** (Quinsy owns `quinsy.app`). Standalone `rhodes.app` is **not yet acquired** — see O-018. Build all URLs from env vars so a future domain cutover does not require code changes.

## Open — product

| ID | Question | Options | Owner |
|----|----------|---------|-------|
| O-018 | Acquire standalone `rhodes.app`? | Not yet validated / If acquired: promote to primary + redirect `rhodes.quinsy.app` / Keep subdomain only | Founder |
| O-002 | Library UI: full-screen browse vs slide-over? | Full-screen / Overlay | UX |
| O-003 | Onboarding tour for first-time users? | 3-step tooltip / None | UX |
| O-004 | Pro/Team pricing exact amounts? | TBD | Founder |
| O-017 | Account deletion: 7-day grace vs immediate? | Grace / Immediate | Legal |

## Open — technical

| ID | Question | Options | Notes |
|----|----------|---------|-------|
| O-005 | Embedding model upgrade to mxbai/bge-m3? | Stay nomic / Evaluate | If multilingual retrieval weak |
| O-006 | Cross-space Bridge Mode (V2)? | Yes / No / Later | Privacy implications |
| O-007 | Real-time collaboration (Yjs)? | V2 / Never | Major scope |
| O-008 | OCR for scanned PDFs? | Tesseract sidecar / V2 | |
| O-009 | Resend vs AWS SES for MVP? | Resend (DX) / SES (EU) | Both valid |
| O-010 | PWA / Service Worker install? | V1.5 / No | Offline enhancement |

## Open — design (deferred session)

| ID | Question |
|----|----------|
| O-011 | Exact color palette light + dark |
| O-012 | Font pairing (UI + editor) |
| O-013 | Icon set selection |
| O-014 | Component sticker sheet |

## Open — legal

| ID | Question |
|----|----------|
| O-015 | Legal entity for Imprint / Privacy (reuse Quinsy?) |
| O-016 | Penetration test before public launch? |

## How to close a decision

1. Discuss and decide
2. Update relevant spec doc
3. If architectural: create/update ADR
4. Move row from Open → Accepted table above
