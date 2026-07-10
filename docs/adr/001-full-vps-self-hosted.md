# ADR 001 — Full VPS Self-Hosted

**Status:** accepted  
**Date:** July 2026

## Context

Rhodes handles sensitive company knowledge. Users and the PRD require data sovereignty — no third-party AI APIs, no Vercel-hosted app with data leaving the EU VPS.

## Decision

Deploy the entire Rhodes application stack on a private VPS managed via Coolify. No Vercel app hosting. No cloud LLM (OpenAI, Anthropic) in V1.

## Consequences

**Positive:**
- Full data control and GDPR story
- No per-token cloud AI costs
- Aligns with privacy-first positioning

**Negative:**
- Ops responsibility (updates, backups, monitoring)
- CPU inference slower than GPU/cloud
- Single-region unless multi-VPS later

## Dependencies

- [13-infrastructure-vps.md](../13-infrastructure-vps.md)
- [adr/002-ollama-cpu-only.md](002-ollama-cpu-only.md)
