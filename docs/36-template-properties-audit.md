# Template properties — UI component & field review

**Status:** decisions locked for open questions — ready for family sign-off, then seed implementation  
**Gate:** Approve each template family checklist before changing seeds / migrations.  
**Scope:** Which metadata points belong on each template, and which **UI component** each point uses. Content/body H2 review is out of scope here (see git history of this file for prior content matrices).

---

## How to review

For each row, approve or edit:

| Column | Meaning |
|--------|---------|
| **Key** | `field_key` or `group_key` |
| **UI** | Exact control to render (from catalog below) |
| **Verdict** | **Keep** / **Change** (UI or shape) / **Remove** / **Add** / **Rename** |
| **Notes** | Why / collision / follow-up |

**Essentials** (`status`, `due_date`, `owner`, `summary`, `origin`) appear once in [Shared essentials](#shared-essentials). Template tables only list **extras** + essential **overrides**.

**Misplaced rule:** if a field’s domain belongs to another template family → **Remove** from this seed (even if the workspace row stays for other templates).

---

## UI component catalog (use only these)

| UI name | `field_type` / shape | Control |
|---------|----------------------|---------|
| Input | `text` | plain Input |
| URL | `url` | Input (URL) |
| TextArea | `textarea` | TextArea |
| Dropdown | `select` | Dropdown + options |
| Status | `status` | Status dropdown (value/label/category) |
| Multi-select | `multi_select` | Checkbox list + options |
| Date | `date` | Date picker |
| Date range | `date_range` | Date range |
| Tags | `tags` | Tags editor |
| Number | `number` | Input; optional `options.unit` |
| Checkbox | `checkbox` | Checkbox |
| Relation | `relation` | Document picker |
| **Group** | `schema_groups[]` | GroupLabel + subfield row(s) |

### When to use a Group

Use a **Group** when values are a fixed composite (not independent facts):

| Pattern | Subfields | Examples |
|---------|-----------|----------|
| Targeting | product / market / audience / surface / channel / country (subset) | A/B, GTM, content |
| ICE | impact, confidence, ease (Number 1–10) | A/B only |
| KPI definition | label, baseline, **lift_pct** (Number, unit `%`) — **no target** | A/B primary; GTM/campaign/editorial primary metric |
| KPI result | label, value (Input) | A/B post-run |
| Power / MDE | mde, sample_size, traffic_per_day | A/B |
| Money | amount (Number) + currency (**Input**) | budget, funding, contract value |
| Traffic split | Input freeform ratio | A/B `traffic_split` / scientific `allocation_split` |

**Tags vs Dropdown:** If the option set is **not** a closed, universal vocabulary the product owns → use **Tags** (or Input for a single free string). Prefixed option lists only when values are truly known (AARRR, employment type, citation style, etc.).

**Do not** flatten ICE or KPI def into three separate Properties rows.

Group subfields may use: text, textarea, number, select, multi_select, date, tags, url, checkbox — **not** status, relation, or date_range.

---

## Platform fixes (approve once — affects all templates)

| Issue | Verdict | Notes |
|-------|---------|-------|
| Missing `template_slug` → view shows **all** workspace fields | **Fix** | Fail closed: essentials only (or empty extras), never full union |
| Shared `group_key: targeting` with different subfields → workspace **union** | **Change** | Prefer unique keys per family: `targeting_experiment`, `targeting_gtm`, `targeting_content`, `targeting_flow` — **or** filter view by template’s sub_keys |
| Shared `field_key` with conflicting options/types (`priority`, `product_area`, `experiment_status`, `review_status`) | **Rename** | Namespace keys (see tables) so first-seed wins doesn’t corrupt options |
| Manage / Add shows full workspace schema | **Keep** | By design; view mode must stay filtered |

---

## Shared essentials

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `status` | Dropdown | **Keep** | Kanban affinity. Override/omit only where a domain Status replaces it (A/B). |
| `due_date` | Date | **Keep** | Omit when a domain timeline replaces it (A/B, project charter). |
| `owner` | Input | **Keep** | |
| `summary` | TextArea | **Keep** | List/dashboard blurb |
| `origin` | Relation | **Keep** | Soft-locked; link parent Insight/Problem/etc. |

---

## 1. Growth & experiment

### `ab-experiment` — A/B Experiment

**Purpose:** Growth experiment brief — hypothesis, ICE, KPIs, variants, decision.  
**Gold standard** for groups. Essentials: omit `status`, omit `due_date`.

#### Design decisions (runtime, lift, split, Gantt) — **locked**

| Topic | Decision | Notes |
|-------|----------|-------|
| **Lift** | Primary KPI = `label` + `baseline` + **`lift_pct`** (Number, unit `%`). **Remove `target`.** | Lift drives sample size / duration; no separate target field |
| **Duration (days)** | **Add** `planned_duration_days` Number (unit: days), **AI-fill enabled** | From power + traffic + lift + split via Ask A/B calculator; user can override |
| **Dates / Gantt** | **Keep** `launch_date` only. **Remove** `date_active`. End = start + `planned_duration_days` in Gantt/views | No stored end date |
| **Traffic split** | **Add** `traffic_split` Input (e.g. `50/50`, `80/20`, `33/33/34`) | Properties for Intel/Ask; variant prose stays in body |
| **AI fill** | Enable on `planned_duration_days` (and calculator-backed power fields as needed) | Do not invent numbers without inputs |

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `experiment_status` | Status | **Rename** | → `ab_experiment_status` |
| `launch_date` | Date | **Keep** | Planned start / go-live (Gantt anchor) |
| `date_active` | Date range | **Remove** | End derived from launch + duration |
| `planned_duration_days` | Number (unit: days) | **Add** | AI/tool-assisted from power + lift + split |
| `traffic_split` | Input | **Add** | e.g. 50/50 |
| `target_sprint` | Input | **Keep** | Nice-to-have |
| `funnel_stage` | Dropdown | **Keep** | AARRR |
| `growth_loop` | Input | **Keep** | |
| `psychological_layer` | Input | **Keep** | |
| `target_segment` | Input | **Remove** | Redundant with Targeting.audience |
| `cost_of_experimentation` | Number (unit: days) | **Change** | Add unit |
| `experiment_result` | Dropdown | **Keep** | |
| `experiment_decision` | Dropdown | **Keep** | |
| `erosion_risk` | Checkbox | **Keep** | |
| `targeting` | Group (product, market, audience, surface, country) | **Rename** | → `targeting_experiment` |
| `ice` | Group (impact, confidence, ease Number) | **Keep** | |
| `primary_kpi` | Group (label, baseline, **lift_pct**) | **Change** | Remove target; Lift (%) |
| `secondary_kpi` | Group (label, baseline, **lift_pct**) | **Change** | Same shape as primary |
| `guardrail_kpi` | Group (label, baseline, **lift_pct**) | **Change** | Same shape (lift bound / change limit) |
| `power` | Group (mde, sample_size, traffic_per_day) | **Keep** | Inputs to duration calculator |
| `primary_kpi_result` | Group (label, value) | **Keep** | |
| `secondary_kpi_result` | Group (same) | **Keep** | |
| `guardrail_kpi_result` | Group (same) | **Keep** | |
| Meeting / HR / legal fields | — | **N/A** | Filter bug if visible |

---

### `scientific-experiment` — Scientific Experiment

**Purpose:** Lab/science method — hypothesis, method, variables, results. **Not** growth A/B (no ICE/KPI/funnel).

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `status` | Dropdown | **Keep** | Essential |
| `due_date` | Date | **Keep** | |
| `experiment_status` | Status | **Rename** | → `science_experiment_status` |
| `date_active` | Date range | **Keep** | Study timeline (different from A/B power runtime) |
| `allocation_split` | Input | **Add** | Control/treatment (e.g. `50/50`) — Properties for Intel/Ask |
| ICE / KPI / funnel / targeting | — | **Remove** if ever added | Misplaced growth fields |
| Independent / dependent variable | Input ×2 | **Add** (optional) | Nice-to-have |

---

### `insight` — Insight

**Purpose:** Evidence-backed insight that feeds experiment backlog.

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `state` | Status | **Keep** | raw → discarded |
| `source_type` | Dropdown | **Keep** | Closed-ish research sources — OK |
| `confidence_level` | Dropdown | **Keep** | low/medium/high |
| `product_area` | **Input** | **Change** | Free string — we don’t know the user’s product taxonomy |

---

### `problem` — Problem

**Purpose:** Problem statement + impact evidence for backlog.

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `state` | Status | **Keep** | |
| `source_type` | Dropdown | **Keep** | |
| `confidence_level` | Dropdown | **Keep** | |
| `product_area` | **Input** | **Change** | Same as insight — free string |

---

### `gtm-plan` — GTM Plan

**Purpose:** ICP, positioning, channels, enablement, launch metrics.

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `gtm_status` | Status | **Keep** | |
| `target_launch_date` | Date | **Keep** | |
| `gtm_tier` | Dropdown | **Keep** | |
| `sponsor` | Input | **Keep** | |
| `primary_kpi` (flat text) | — | **Change** | → **Group** `primary_kpi` (label, baseline, **lift_pct**) |
| `targeting` | Group (market, audience) | **Rename** | → `targeting_gtm` |

---

### `launch-checklist` — Launch Checklist

**Purpose:** Cross-functional go/no-go readiness.

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `launch_date` | Date | **Rename?** | Shares key with A/B — OK if same meaning; else `checklist_launch_date` |
| `launch_status` | Status | **Keep** | |
| `launch_tier` | Dropdown | **Keep** | |
| `go_nogo_date` | Date | **Keep** | |
| `targeting` | Group (product, market) | **Rename** | → `targeting_launch` |

---

### `campaign-brief` — Campaign Brief

**Purpose:** Message, channels, budget, window, success metric.

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `campaign_status` | Status | **Keep** | |
| `channels` | **Tags** | **Change** | User-defined channel names — not a fixed Multi-select |
| `budget` (flat number) | — | **Change** | → **Group** `budget` (amount Number + currency **Input**) |
| `campaign_window` | Date range | **Keep** | |
| `primary_metric` (flat text) | — | **Change** | → **Group** `primary_kpi` (label, baseline, **lift_pct**) |
| `targeting` | Group (channel, market, audience) | **Rename** | → `targeting_content` |

---

### `editorial-calendar` — Content Calendar Item

**Purpose:** One content piece — angle, SEO, distribute, measure.

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `publish_date` | Date | **Keep** | |
| `content_status` | Status | **Keep** | |
| `content_type` | Dropdown | **Keep** | |
| `funnel_stage` | Dropdown | **Keep** | Same AARRR options as A/B — OK |
| `target_query` | Input | **Keep** | |
| `primary_metric` (flat text) | — | **Change** | → **Group** `primary_kpi` (label, baseline, **lift_pct**) |
| `campaign` | Relation | **Keep** | Link campaign brief |
| `targeting` | Group | **Rename** | → `targeting_content` |

---

### `seo-brief` — SEO Brief

**Purpose:** SERP/pillar brief — intent, competitors, on-page requirements.

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `target_keyword` | Input | **Keep** | |
| `search_intent` | Dropdown | **Keep** | |
| `search_volume` | Number | **Keep** | Standalone OK (not a label+value+unit triple with the others) |
| `keyword_difficulty` | Number | **Keep** | |
| `word_count_target` | Number (unit: words) | **Change** | Add unit; **Rename** → `seo_word_count_target` vs essay |
| `seo_status` | Status | **Keep** | |
| `campaign` | Relation | **Keep** | |
| `targeting` | Group | **Rename** | → `targeting_content` |
| Keyword metrics as one Group | — | **Optional** | Only if you want volume+difficulty+wordcount under one “Keyword stats” group |

---

### `social-post-batch` — Social Post Batch

**Purpose:** Batch of posts for platforms + schedule.

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `batch_status` | Status | **Keep** | |
| `platforms` | **Tags** | **Change** | User-defined platforms — not fixed Multi-select |
| `batch_window` | Date range | **Keep** | |
| `campaign` | Relation | **Keep** | |
| `targeting` | Group | **Rename** | → `targeting_content` |

---

## 2. Product & delivery

### `blank` — Blank

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| *(extras)* | — | **Keep empty** | Essentials only |

---

### `ticket` — Ticket

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `priority` | Dropdown | **Rename** | → `ticket_priority` (urgent…low) — closed set OK |
| `ticket_type` | **Tags** | **Change** | Orgs invent types (bug/chore/spike/…) — Tags more flexible than fixed Dropdown |

---

### `meeting-notes` — Meeting Notes

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `meeting_date` | Date | **Keep** | |
| `meeting_type` | Dropdown | **Keep** | |
| `attendees` | TextArea | **Keep** | Or Tags later |
| `meeting_link` | **URL** | **Change** | Today `text` → `url` |
| `location` | Input | **Keep** | |

---

### `product-spec` — Product Spec

**Purpose:** Hypothesis-driven feature/growth spec (not full epic PRD).

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `priority` | Dropdown | **Rename** | → `spec_priority` (p0–p3) |
| `milestone` | Input | **Keep** | |
| Primary success metric | Group `primary_kpi` | **Add** | label, baseline, **lift_pct** |

---

### `report` — Report

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `period_end` | Date | **Keep** | |
| `confidence` | Dropdown | **Keep** | Finding confidence — not ICE |

---

### `prd` — Product Requirements Document

**Purpose:** Delivery PRD for larger epics (MoSCoW / stories) — not growth A/B.

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `priority` | Dropdown | **Rename** | → `prd_priority` (low…critical) |
| `strategic_alignment` | Dropdown | **Keep** | Closed product strategy set — OK |
| `product_area` | **Tags** | **Change** | We don’t know the user’s areas |
| `target_release` | Input | **Keep** | |

---

### `product-feature` — Product Feature

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `feature_status` | Status | **Keep** | |
| `product_area` | **Tags** | **Change** | Same as PRD — user taxonomy |
| `target_release` | Input | **Keep** | |

---

### `user-flow-definition` — User Flow Definition

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `flow_status` | Status | **Keep** | |
| `product_area` | **Tags** | **Change** | Same as PRD |
| `target_release` | Input | **Keep** | |
| `targeting` | Group (product, market, audience, surface) | **Rename** | → `targeting_flow` |

---

### `technical-requirements-document` — TRD

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `priority` | Dropdown | **Rename** | → `trd_priority` |
| `target_release` | Input | **Keep** | |
| `impact_area` | **Tags** | **Change** | User-defined surfaces — not fixed Multi-select |

---

### `adr` — Architecture Decision Record

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `decision_date` | Date | **Keep** | |
| `decision_status` | Status | **Keep** | |
| `requires_downtime` | Checkbox | **Keep** | |
| `impact_area` | **Tags** | **Change** | Same as TRD |

---

### `workflow-definition` — Workflow Definition

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `workflow_status` | Status | **Keep** | |

---

### `project-charter` — Project Charter

**Essentials:** omit `due_date` (use timeframe + target launch).

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `project_timeframe` | Date range | **Keep** | |
| `target_launch` | Date | **Keep** | |
| `sponsor` | Input | **Keep** | |

---

### `swot-analysis` — SWOT Analysis

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `analysis_scope` | Input | **Keep** | |
| `competitor_name` | Input | **Keep** | |
| `last_audited` | Date | **Keep** | Shared key with KB ops — OK if same meaning |
| `valid_until` | Date | **Keep** | |

---

### `weekly-status` — Status Report

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `period_end` | Date | **Keep** | |
| `report_period` | Input | **Rename?** | → `status_report_period` vs financial `report_period` |
| `health` | Status | **Keep** | on_track / at_risk / off_track |

---

## 3. Operations & policies

### `sop` / `onboarding-guide` / `policy-document`

Same extras for all three (living policy / procedure docs — not “KB” jargon):

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `verification_status` | Dropdown | **Keep** | |
| `last_audited` | Date | **Keep** | |
| `review_cycle` | Dropdown | **Keep** | |

---

## 4. Money, audit, business

### `business-plan` — Business Plan

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `stage` | Dropdown | **Keep** | |
| `industry` | Input | **Keep** | |
| `funding_target` (flat number) | — | **Change** | → **Group** `funding` (amount Number + currency **Input**) |
| `arr_target` (flat number) | — | **Change** | → **Group** `arr` (amount Number + currency **Input**) |
| `client` | Relation | **Keep** | |

**Money shape (locked):** Group = amount (Number) + currency (**Input**, free ISO or symbol — we don’t maintain a currency list).

---

### `campaign-brief` budget

Already covered in §1 — Money Group.

---

### `contract-review` — Contract Review

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `contract_value` (flat number) | — | **Change** | → **Group** `contract_value` (amount Number + currency **Input**) |
| `renewal_date` | Date | **Keep** | |
| `review_status` | Status | **Rename** | → `contract_review_status` |
| `jurisdiction` | **Tags** | **Change** | User-defined jurisdictions — not fixed DE/EU/US list |
| `counterparty` | Relation | **Keep** | |

---

### `financial-report` — Financial Report

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `report_period` | Input | **Rename** | → `financial_report_period` |
| `report_type` | Dropdown | **Keep** | |
| `currency` (orphan text) | **Input** | **Change** | Document-level currency as Input; or drop if all money lives in Money groups |

---

### `digital-maturity-audit` — Digital Maturity Audit

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `audit_status` | Status | **Keep** | Shared with general-audit — OK |
| `maturity_domain` | **Tags** | **Change** | User-defined domains |
| `maturity_score` | Number | **Keep** | Optional unit 1–5 |
| `client` | Relation | **Keep** | |

---

### `general-audit` — General Audit

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `audit_status` | Status | **Keep** | |
| `audit_type` | **Tags** | **Change** | Audit kinds vary widely — Tags |
| `client` | Relation | **Keep** | |

---

### `professional-business-letter` — Professional Business Letter

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `letter_type` | **Tags** | **Change** | User-defined letter kinds |
| `subject_line` | Input | **Keep** | |
| `recipient` | Relation | **Keep** | |

---

## 5. People & HR

### `one-on-one-notes` — 1:1 Notes

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `meeting_date` | Date | **Keep** | Shared with meeting-notes — OK |
| `participant` | Relation | **Keep** | |
| `manager` | Relation | **Keep** | |
| `requires_hr_followup` | Checkbox | **Keep** | |
| `visibility` | Dropdown | **Keep** | |

---

### `personal-development-plan` — PDP

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `pdp_status` | Status | **Keep** | |
| `employee` | Relation | **Keep** | |
| `manager` | Relation | **Keep** | |
| `review_period` | Input | **Keep** | |

---

### `job-description` — Job Description

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `department` | **Tags** | **Change** | Org-specific naming |
| `seniority` | Dropdown | **Keep** | junior→principal is a known ladder |
| `employment_type` | Dropdown | **Keep** | FT / PT / contract / intern |
| Compensation | Group (amount + currency Input) | **Add** (optional) | Often needed |

---

### `performance-review` — Performance Review

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `review_status` | Status | **Rename** | → `performance_review_status` |
| `rating` | Dropdown | **Keep** | |
| `employee` | Relation | **Keep** | |
| `manager` | Relation | **Keep** | |
| `review_period` | Input | **Keep** | |

---

## 6. Legal & compliance

### `legal-document` — Legal Document

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `effective_date` | Date | **Keep** | |
| `legal_status` | Status | **Keep** | |
| `jurisdiction` | **Tags** | **Change** | Same as contract-review |
| `counterparty` | Relation | **Keep** | |

---

### `compliance-checklist` — Compliance Checklist

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `framework` | **Tags** | **Change** | User-defined frameworks |
| `compliance_status` | Status | **Keep** | |
| `related_audit` | Relation | **Keep** | |

---

## 7. Academic

### `research-paper`

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `paper_status` | Status | **Keep** | |
| `journal_or_venue` | Input | **Keep** | |
| `citation_style` | Dropdown | **Keep** | |

---

### `thesis`

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `thesis_level` | Dropdown | **Keep** | |
| `thesis_status` | Status | **Keep** | |
| `advisor` | Relation | **Keep** | Seed says relation; older audit said text — **Keep Relation** |
| `defense_date` | Date | **Keep** | |
| `citation_style` | Dropdown | **Keep** | |

---

### `student-essay`

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `course` | Input | **Keep** | |
| `word_count_target` | Number (unit: words) | **Rename** | → `essay_word_count_target` + unit |
| `essay_status` | Status | **Keep** | |

---

### `literature-review`

| Key | UI | Verdict | Notes |
|-----|-----|---------|-------|
| `research_area` | **Tags** | **Change** | User-defined research domains |
| `review_status` | Status | **Rename** | → `literature_review_status` |
| `citation_style` | Dropdown | **Keep** | APA/MLA/Chicago/IEEE — closed set we own |

---

## Locked decisions (from review)

| # | Decision |
|---|----------|
| 1 | A/B: only `launch_date` + `planned_duration_days`; **remove** `date_active`; Gantt derives end |
| 2 | KPI groups: **remove target**; use **Lift (%)** (`lift_pct`) with label + baseline |
| 3 | Scientific: **Add** `allocation_split` Input in Properties |
| 4 | `maturity_domain` → **Tags** |
| 5 | `framework` → **Tags** |
| 6 | `employment_type` → **Keep** Dropdown |
| 7 | `letter_type` → **Tags** |
| 8 | Money currency → **Input** (not Dropdown) |

---

## Approval checklist (tick when done)

### Platform

- [x] Fail-closed view filter when `template_slug` missing  
- [x] Unique targeting group keys (or sub_key filter)  
- [x] Namespaced collision keys (`priority`, `product_area`, `experiment_status`, `review_status`, word_count, report_period)

### Groups to introduce / fix

- [x] Money Group pattern (amount + currency **Input**) for budget / funding / ARR / contract value  
- [x] KPI groups use label + baseline + **lift_pct** (no target)  
- [x] A/B: remove `date_active`; add `planned_duration_days` + `traffic_split`  
- [x] `meeting_link` → URL  
- [x] Number units where listed (cost days, word counts, lift %)

### Families signed off

- [x] Growth & experiment (§1)  
- [x] Product & delivery (§2)  
- [x] Operations & policies (§3)  
- [x] Money / audit / business (§4)  
- [x] People & HR (§5)  
- [x] Legal & compliance (§6)  
- [x] Academic (§7)  

### Implementation status

Implemented in `SYSTEM_TEMPLATE_SEEDS` + Properties fail-closed view filter + migration `00079_template_properties_ui_audit.sql` (mirrored under supabase).

---

## Slug coverage (43)

`blank`, `ticket`, `meeting-notes`, `product-spec`, `report`, `sop`, `onboarding-guide`, `policy-document`, `ab-experiment`, `insight`, `problem`, `scientific-experiment`, `adr`, `technical-requirements-document`, `workflow-definition`, `prd`, `product-feature`, `user-flow-definition`, `swot-analysis`, `project-charter`, `gtm-plan`, `launch-checklist`, `weekly-status`, `campaign-brief`, `editorial-calendar`, `seo-brief`, `social-post-batch`, `digital-maturity-audit`, `general-audit`, `business-plan`, `professional-business-letter`, `one-on-one-notes`, `personal-development-plan`, `job-description`, `performance-review`, `legal-document`, `contract-review`, `compliance-checklist`, `financial-report`, `research-paper`, `thesis`, `student-essay`, `literature-review`.

---

## After approval

1. Update `SYSTEM_TEMPLATE_SEEDS` + SQL mirror for approved Change/Remove/Add/Rename.  
2. Extend group helpers (`moneyGroup`, namespaced `targeting_*`).  
3. Harden Properties view filter (fail closed + optional sub_key filter).  
4. Tests: per-template field keys, groups, and no cross-family keys in view mode.
