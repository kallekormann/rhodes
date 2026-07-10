# Rhodes — Documentation Index

**Status:** draft  
**Last updated:** July 2026  
**Source PRD:** [incubator/SecondBrain/Rhodes.md](../../incubator/SecondBrain/Rhodes.md)

This folder is the **canonical specification** for building Rhodes. The incubator PRD is the origin document; these docs extend and correct it.

---

## Reading order

### 1. Product & UX (start here)

| Doc | Topic |
|-----|-------|
| [01-vision-and-scope.md](01-vision-and-scope.md) | Vision, personas, problem/solution |
| [02-information-architecture.md](02-information-architecture.md) | Spaces, Documents, Library, Views |
| [03-ux-ui-design.md](03-ux-ui-design.md) | Editor-first, On-Demand-Chrome, layout states |
| [03a-design-language.md](03a-design-language.md) | Principles, spacing, motion |
| [03b-design-references.md](03b-design-references.md) | Tokens, colors, wireframes, Lucide icons |
| [26-ui-mock-reference.md](26-ui-mock-reference.md) | **UI mock inventory — canonical reference for production UI** |
| [20-workflows.md](20-workflows.md) | Happy paths, mouse + Cmd+K |
| [21-i18n.md](21-i18n.md) | EN primary, ES/DE/FR/IT |

### 2. Data & AI

| Doc | Topic |
|-----|-------|
| [04-data-model.md](04-data-model.md) | SQL schema, RLS, new tables |
| [05-ai-and-rag.md](05-ai-and-rag.md) | CPU-only Ollama, embeddings, RAG pipeline |
| [06-ai-chat.md](06-ai-chat.md) | Chat mode, prompts, guardrails |
| [07-individual-vs-team.md](07-individual-vs-team.md) | Multi-tenancy, isolation |
| [08-metadata-system.md](08-metadata-system.md) | System, AI, user metadata |
| [09-document-history.md](09-document-history.md) | Versioning, snapshots |

### 3. Features

| Doc | Topic |
|-----|-------|
| [10-templates-and-views.md](10-templates-and-views.md) | Templates, saved views |
| [11-editor-tiptap.md](11-editor-tiptap.md) | TipTap stack, extensions |
| [12-offline-sync.md](12-offline-sync.md) | IndexedDB, conflict strategy |

### 4. Identity, Settings & Billing

| Doc | Topic |
|-----|-------|
| [22-authentication-and-accounts.md](22-authentication-and-accounts.md) | Register, login, MFA, account deletion, Supabase Auth |
| [23-user-settings-and-spaces.md](23-user-settings-and-spaces.md) | Profile, security, spaces, team invites |
| [24-privacy-user-tools.md](24-privacy-user-tools.md) | Data export, consent, GDPR self-service |
| [25-billing-lemonsqueezy.md](25-billing-lemonsqueezy.md) | Subscriptions, webhooks, feature gates |

### 5. Infrastructure & Ops

| Doc | Topic |
|-----|-------|
| [13-infrastructure-vps.md](13-infrastructure-vps.md) | Coolify, Hetzner, CPU-only, storage |
| [14-email-delivery.md](14-email-delivery.md) | Resend/SES relay, IP protection |
| [15-security-and-privacy.md](15-security-and-privacy.md) | Auth, encryption, GDPR |
| [16-ingestion-pipeline.md](16-ingestion-pipeline.md) | Tika, chunking, worker queue |
| [17-business-model.md](17-business-model.md) | LemonSqueezy tiers |
| [18-non-functional-requirements.md](18-non-functional-requirements.md) | Performance, DoD |

### 6. Decisions

| Doc | Topic |
|-----|-------|
| [19-open-decisions.md](19-open-decisions.md) | Decision log |
| [adr/](adr/) | Architecture Decision Records (001–007) |

---

## Key decisions (summary)

| Area | Decision |
|------|----------|
| Deployment | Full VPS self-hosted (Coolify) |
| GPU | No — CPU-only Ollama, quantized models |
| UI | Editor-first, On-Demand-Chrome (not SaaS dashboard, not Cmd+K-only) |
| UI reference | [`ui-mock/`](../ui-mock/) + [26-ui-mock-reference.md](26-ui-mock-reference.md) — mandatory for production implementation |
| i18n | EN primary; ES, DE, FR, IT |
| Email | Managed relay (Resend or AWS SES EU) — never SMTP from app VPS |
| Auth | Supabase Auth (self-hosted GoTrue) — see [22-authentication-and-accounts.md](22-authentication-and-accounts.md) |
| Billing | LemonSqueezy — see [25-billing-lemonsqueezy.md](25-billing-lemonsqueezy.md) |

---

## Document template

Every spec file follows:

1. **Status** — draft | accepted | deprecated  
2. **Context** — why this matters  
3. **Decision** — what we chose (if applicable)  
4. **Specification** — details, diagrams, SQL  
5. **Open questions**  
6. **Dependencies** — links to other docs
