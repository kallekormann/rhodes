# 31 — Scope bundles catalog

**Status:** scaffold (M2.5.0)

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
| `strategy-consulting` | Strategy & Consulting | pending | M2.5.9 |
| `people-ops` | People Operations & HR | pending | M2.5.10 |
| `legal-compliance-finance` | Legal, Compliance & Finance | pending | M2.5.11 |
| `academic-research` | Academic & Scientific Research | pending | M2.5.12 (post-M7) |

Reordered from the original brief so Growth & Experimentation (a foundational, cross-audience use
case flowing Insight/Problem → Experiment) ships right after Knowledge Base & Ops, ahead of the more
niche discovery/GTM bundles.

Full bundle specs (templates, metadata, view presets) to be transcribed from product brief into `BUNDLE_CATALOG` entries per wave.

## Related

- [29-use-cases-views-templates.md](29-use-cases-views-templates.md)
- [implementation_plan/15-scopes-org-teams-settings.md](../implementation_plan/15-scopes-org-teams-settings.md)
