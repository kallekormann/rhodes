# 01 — Vision and Scope

**Status:** draft

## Context

Rhodes is a Quinsy app — an intelligent team second brain that merges passive knowledge (Library) with active thinking (Editor) through local semantic AI. It targets knowledge workers and product teams who lose insights in fragmented documents.

## Decision

Build Rhodes as a **self-hosted, editor-first workspace** with real-time semantic context — not another SaaS note app with a sidebar file tree.

## Specification

### Vision

Rhodes is a distraction-free, collaborative workspace where writing and rediscovering knowledge happen in one place. While you write, the system surfaces relevant internal documents and uploaded PDFs — breaking the barrier between search and composition.

Visual and functional references: Apple Keynote precision, [Obsidian](https://obsidian.md/) focus, iA Writer minimalism, Linear performance.

### Core problems

1. **Knowledge fragmentation** — insights buried in PDFs, meeting notes, old specs
2. **Cold start in the editor** — no bridge to existing context when starting new work
3. **Team silos** — parallel work without visibility into colleagues' knowledge
4. **Cloud lock-in & privacy** — sensitive data sent to third-party AI APIs is unacceptable for many EU teams

### Solution

A **local-first web application** fully operated on a private VPS (Coolify). Native integration of `pgvector` and local LLM inference (Ollama, CPU-only) scans writing context in real time and presents matches in an on-demand insight sidebar.

### Personas

**Solo Strategist (Product / Growth Leader)**  
Creates frameworks, specs, experiment concepts. Hundreds of articles and PDFs. Rhodes surfaces old validations and frameworks while writing new specs — without manual search.

**Product & Tech Team**  
Decentralized POs, UX architects, engineers. When a PO writes a requirement doc, Rhodes connects it to architecture notes a colleague wrote two weeks ago in the team space.

### In scope (V1)

- Private and Team Spaces with RLS isolation
- TipTap editor with templates and slash commands
- Library ingestion (PDF, DOCX, TXT)
- Semantic insight sidebar with citation/backlinks
- Local-first offline writing with sync
- CPU-only Ollama (embeddings + summaries + chat)
- EN UI + ES/DE/FR/IT support
- Light/Dark mode
- Managed email relay for transactional mail

### Out of scope (V1)

- Real-time collaborative editing (CRDT)
- Cross-space AI retrieval without explicit consent
- Web crawling / external URL ingestion
- Mobile native apps
- GPU inference
- Self-hosted SMTP from app VPS

## Open questions

- Product name domain: launch on `rhodes.quinsy.app` (D-012); standalone `rhodes.app` not yet validated (O-018).
- Legal entity for GDPR/Imprint (reuse Quinsy placeholder pattern from Clara)?

## Dependencies

- [02-information-architecture.md](02-information-architecture.md)
- [03-ux-ui-design.md](03-ux-ui-design.md)
- [05-ai-and-rag.md](05-ai-and-rag.md)
