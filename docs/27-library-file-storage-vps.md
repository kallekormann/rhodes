# 27 — Library file storage on VPS (open architecture)

**Status:** open — must resolve before / during production VPS deploy  
**Related:** [13-infrastructure-vps.md](13-infrastructure-vps.md), [15-security-and-privacy.md](15-security-and-privacy.md), [16-ingestion-pipeline.md](16-ingestion-pipeline.md), account-owner library quotas (product)

## Context

Local development stores library originals via **Supabase Storage** with a **local filesystem fallback** (`.data/library-files`). That is fine on a laptop. Moving to a **real VPS** (Coolify / Hetzner production or shared staging) needs a deliberate storage architecture so:

- Disk next to Postgres does not fill with PDFs/DOCX
- Quotas (100 MB–50 GB per account) remain economically viable
- Team / company customers can meet security and residency expectations
- Optional **customer-owned (BYO) buckets** are possible later without rewriting ingest

## Decision needed (before production cutover)

Define and implement a **full library object-storage architecture** for VPS deploy, including a path to **BYO bucket** for enterprise/team customers.

This is **not** solved by “keep using the laptop `.data` folder” or by putting file bytes in Postgres.

## Current state (dev)

| Layer | Today |
|-------|--------|
| Originals | Supabase Storage bucket `library-files` (+ local fallback) |
| Paths | `{workspace_id}/library/{source_id}/{filename}` |
| Metadata / RLS | `library_sources` in Postgres |
| Search index | `library_source_chunks` + embeddings in Postgres |

## Target directions (to choose / phase)

1. **Managed object storage on VPS deploy**  
   Point Supabase Storage (or a thin adapter) at **S3-compatible** storage (Hetzner Object Storage, AWS S3, R2, MinIO). Keep the same app API; originals leave the Postgres volume.

2. **BYO bucket (enterprise / Team)**  
   Team owner connects their own bucket (credentials or IAM role). Rhodes upload/serve/worker use a **storage adapter**; customer data stays in their cloud account / region. DPA and encryption (SSE/CMK) must be explicit.

3. **Fully self-hosted Rhodes**  
   Customer runs the stack; storage is already “theirs.” Still prefer object storage or a dedicated volume for originals vs DB disk.

## Security / privacy checklist (must answer in the architecture)

- Encryption in transit (TLS) and at rest (volume + object SSE / CMK)
- Workspace isolation (path prefix + RLS); no cross-tenant reads
- EU / residency options for Team
- How BYO credentials are stored (encrypted, owner-scoped)
- Backup / retention of originals vs DB dumps
- What happens on account deletion (purge object keys)

## Out of scope for a quick note

- Implementing BYO UI
- Migrating existing local `.data` files (runbook when architecture is chosen)

## Action

When promoting from **development machine → VPS (staging/production)**, treat library file storage as a **blocking architecture task**: pick managed S3-compatible backend for Rhodes-hosted deploys, and document the BYO adapter contract for later enterprise.

Track product/engineering follow-up alongside account-owner storage quotas and chunk packing (keeps Postgres growth bounded while originals scale in object storage).
