# 31 — Scope bundles catalog

**Status:** complete — all 10 planned bundles shipped (M2.5.3–M2.5.12)

Authoritative bundle definitions live in [`packages/shared/src/scope-bundles.ts`](../packages/shared/src/scope-bundles.ts) (`BUNDLE_CATALOG`). This doc tracks product copy and rollout status.

## Composition model

- **Bundles** — convenience groupings (views + templates + metadata)
- **View↔template affinity** — [`view-template-affinity.ts`](../packages/shared/src/view-template-affinity.ts)
- **Resolver** — [`scope-composition.ts`](../packages/shared/src/scope-composition.ts) (`resolveScopeComposition`)

Users can combine multiple bundles, pick views only, pick templates only, or mix freely. The wizard guides; it does not gate.

## Bundle rollout

| ID | Label | Status | Wave |
|----|-------|--------|------|
| `wizard-starter` | Starter pack | available | M2.5.1 (wizard test) |
| `knowledge-base-ops` | Knowledge Base & Operations | available | M2.5.3 |
| `growth-experimentation` | Growth & Experimentation | available | M2.5.4 |
| `product-architecture` | Product Architecture & Decisions | available | M2.5.5 |
| `product-discovery-ux` | Product Discovery & UX | available | M2.5.6 |
| `gtm-project-execution` | GTM & Project Execution | available | M2.5.7 |
| `content-marketing` | Content & Campaign Marketing | available | M2.5.8 |
| `strategy-consulting` | Strategy & Consulting | available | M2.5.9 |
| `people-ops` | People Operations & HR | available | M2.5.10 |
| `legal-compliance-finance` | Legal, Compliance & Finance | available | M2.5.11 |
| `academic-research` | Academic & Scientific Research | available | M2.5.12 |

Reordered from the original brief so Growth & Experimentation (a foundational, cross-audience use
case flowing Insight/Problem → Experiment) ships right after Knowledge Base & Ops, ahead of the more
niche discovery/GTM bundles.

Every bundle ships: a set of system templates (TipTap body + Properties-native `schema_fields`, seeded via a
dedicated `packages/db/migrations/000NN_*.sql`), one or more view presets tuned to that bundle's status/date
fields, and shared bundle-level metadata fields wired through `seed_scope_metadata_fields`. Custom `status`-type
fields are always keyed distinctly from the essential `status` (e.g. `experiment_status`, `decision_status`,
`workflow_status`, `feature_status`, `flow_status`, `gtm_status`, `launch_status`, `campaign_status`,
`content_status`, `seo_status`, `batch_status`, `audit_status`, `pdp_status`, `review_status`, `legal_status`,
`compliance_status`, `paper_status`, `thesis_status`, `essay_status`) to avoid collisions with `withEssentials`
deduplication. Cross-document traceability uses the `relation` field type (e.g. A/B Experiment → Insight/Problem
`origin`, Content Calendar/SEO Brief/Social Post Batch → Campaign Brief `campaign`).

## Related

- [29-use-cases-views-templates.md](29-use-cases-views-templates.md)
- [implementation_plan/15-scopes-org-teams-settings.md](../implementation_plan/15-scopes-org-teams-settings.md)
