# ADR 002 — Ollama CPU-Only (No GPU)

**Status:** accepted  
**Date:** July 2026

## Context

Hetzner standard Cloud VPS instances do not include GPU. Adding GPU instances significantly increases cost and complexity. Rhodes must deliver acceptable AI features on CPU only.

## Decision

Run Ollama with **quantized models only** (Q4_K_M). Use a Redis queue to limit concurrent inference. Stream LLM output to mask latency. No GPU dependency in architecture.

## Model selection

| Role | Model |
|------|-------|
| Embeddings | `nomic-embed-text` |
| Fast | `llama3.2:3b-instruct-q4_K_M` |
| Chat/Summary | `llama3.1:8b-instruct-q4_K_M` |

`OLLAMA_MAX_LOADED_MODELS=1` to conserve RAM.

## Consequences

**Positive:**
- Runs on standard Hetzner CPX/CCX instances
- Predictable infrastructure cost

**Negative:**
- 8–20s chat latency without streaming
- Max ~2 concurrent LLM users before queue backlog
- May need model downgrade (3B only) under RAM pressure

## Dependencies

- [05-ai-and-rag.md](../05-ai-and-rag.md)
- [13-infrastructure-vps.md](../13-infrastructure-vps.md)
