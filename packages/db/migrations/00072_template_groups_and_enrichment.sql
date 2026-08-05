-- Best-in-class template enrichment + template-seeded metadata groups.
-- Adds seed_scope_metadata_groups RPC and refreshes A/B, user-flow, GTM, launch,
-- and content-marketing system templates (docs/36 + research pass).

create or replace function public.seed_scope_metadata_groups(
  ws_id uuid,
  groups jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  group_def jsonb;
  field_def jsonb;
  group_id uuid;
  sort_idx int;
begin
  if groups is null or jsonb_typeof(groups) <> 'array' then
    return;
  end if;

  for group_def in select * from jsonb_array_elements(groups)
  loop
    insert into metadata_schema_groups (
      workspace_id,
      group_key,
      group_label,
      repeatable,
      sort_order
    )
    values (
      ws_id,
      group_def->>'group_key',
      group_def->>'group_label',
      coalesce((group_def->>'repeatable')::boolean, false),
      coalesce((group_def->>'sort_order')::int, 0)
    )
    on conflict (workspace_id, group_key) do update
      set group_label = excluded.group_label
    returning id into group_id;

    if group_id is null then
      select id into group_id
      from metadata_schema_groups
      where workspace_id = ws_id
        and group_key = group_def->>'group_key';
    end if;

    sort_idx := 0;
    for field_def in select * from jsonb_array_elements(coalesce(group_def->'fields', '[]'::jsonb))
    loop
      insert into metadata_schemas (
        workspace_id,
        field_key,
        field_label,
        field_type,
        options,
        ai_fill_enabled,
        group_id,
        sub_key,
        sort_order
      )
      values (
        ws_id,
        coalesce(field_def->>'field_key', (group_def->>'group_key') || '_' || (field_def->>'sub_key')),
        field_def->>'field_label',
        coalesce(field_def->>'field_type', 'text'),
        case
          when field_def ? 'options' and field_def->'options' is not null and jsonb_typeof(field_def->'options') <> 'null'
            then field_def->'options'
          else null
        end,
        coalesce((field_def->>'ai_fill_enabled')::boolean, false),
        group_id,
        field_def->>'sub_key',
        coalesce((field_def->>'sort_order')::int, sort_idx)
      )
      on conflict (workspace_id, field_key) do nothing;
      sort_idx := sort_idx + 1;
    end loop;
  end loop;
end;
$$;

grant execute on function public.seed_scope_metadata_groups(uuid, jsonb) to authenticated;

update templates
set
  name = 'A/B Experiment',
  description = 'Hypothesis-driven experiment brief with ICE scoring, KPIs, variants, and decision',
  structure_json = '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Problem / Insight"}]},{"type":"paragraph","content":[{"type":"text","text":"Link the Problem or Insight document in Properties → Origin, then summarize the evidence that motivates this test.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[What did we learn or observe that justifies running this experiment?]"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Problem Statement"}]},{"type":"paragraph","content":[{"type":"text","text":"State the business or user symptom — not the solution.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[e.g. Trial-to-paid conversion is flat despite traffic growth.]"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"How Might We"}]},{"type":"paragraph","content":[{"type":"text","text":"Frame the opportunity as a How Might We question before locking the change.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[How might we …?]"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Hypothesis"}]},{"type":"paragraph","content":[{"type":"text","text":"If we [change], then [primary metric] will [direction], because [behavioral mechanism]. Capture Product / Market / Audience / Surface in Properties → Targeting.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"If we "},{"type":"text","text":"[change]","marks":[{"type":"bold"}]},{"type":"text","text":", then "},{"type":"text","text":"[primary metric]","marks":[{"type":"bold"}]},{"type":"text","text":" will "},{"type":"text","text":"[increase/decrease]","marks":[{"type":"bold"}]},{"type":"text","text":", because "},{"type":"text","text":"[underlying reasoning].","marks":[{"type":"bold"}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Rationale"}]},{"type":"paragraph","content":[{"type":"text","text":"Evidence, prior tests, or behavioral theory that supports the mechanism.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[Why this change should move the metric.]"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Falsification"}]},{"type":"paragraph","content":[{"type":"text","text":"What result would prove the hypothesis wrong? Write this before you launch.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[We will reject the hypothesis if …]"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Decision Rule"}]},{"type":"paragraph","content":[{"type":"text","text":"Pre-commit Win / Lose / Inconclusive actions (and financial framing) before seeing results. Capture Result + Decision selects in Properties after the run.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Win — [action, e.g. roll out to 100%]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Lose — [action, e.g. revert / do nothing]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Inconclusive — [action, e.g. iterate or gather more evidence]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Sample Size & MDE"}]},{"type":"paragraph","content":[{"type":"text","text":"Minimum detectable effect and expected traffic/duration needed for statistical power. Also set Launch date and Duration in Properties.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"MDE: [smallest lift worth detecting]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Eligible traffic / day: [n]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Planned duration: [days or weeks]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Variants"}]},{"type":"paragraph","content":[{"type":"text","text":"Describe Control and Treatment. Add screenshots or mockups as images in this section.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Control — [current experience]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Variant — [what changes; attach image if helpful]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Risks & Dependencies"}]},{"type":"paragraph","content":[{"type":"text","text":"Material blockers only — eng capacity, analytics, legal, conflicting tests.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Risk or dependency]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Results: Insight, Learning & Decision"}]},{"type":"paragraph","content":[{"type":"text","text":"After the run, record the outcome narrative here. Fill KPI result groups and Result / Decision in Properties.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[Insight:]"}]},{"type":"paragraph","content":[{"type":"text","text":"[Learning:]"}]},{"type":"paragraph","content":[{"type":"text","text":"[Decision:]"}]}]}'::jsonb,
  metadata = '{"document_type":"ab_experiment","use_cases":["A/B tests","Growth experiments","Feature rollout validation"],"supported_views":["kanban","dashboard","gantt"],"schema_fields":[{"field_key":"status","field_label":"Status","field_type":"select","options":["draft","in_progress","done"],"ai_fill_enabled":true},{"field_key":"owner","field_label":"Owner","field_type":"text","ai_fill_enabled":true},{"field_key":"summary","field_label":"Summary","field_type":"textarea","ai_fill_enabled":true},{"field_key":"origin","field_label":"Origin","field_type":"relation","ai_fill_enabled":false},{"field_key":"experiment_status","field_label":"Experiment status","field_type":"status","options":[{"value":"backlog","label":"Backlog","category":"unstarted"},{"value":"design","label":"Design","category":"unstarted"},{"value":"engineering","label":"Engineering","category":"started"},{"value":"live","label":"Live","category":"started"},{"value":"analyzing","label":"Analyzing","category":"started"},{"value":"concluded","label":"Concluded","category":"completed"}],"ai_fill_enabled":true},{"field_key":"launch_date","field_label":"Launch date","field_type":"date","ai_fill_enabled":true},{"field_key":"date_active","field_label":"Duration","field_type":"date_range","ai_fill_enabled":true},{"field_key":"target_sprint","field_label":"Target sprint/quarter","field_type":"text","ai_fill_enabled":false},{"field_key":"funnel_stage","field_label":"Funnel stage (AARRR)","field_type":"select","options":["acquisition","activation","retention","referral","revenue"],"ai_fill_enabled":true},{"field_key":"growth_loop","field_label":"Growth loop","field_type":"text","ai_fill_enabled":true},{"field_key":"psychological_layer","field_label":"Psychological layer","field_type":"text","ai_fill_enabled":true},{"field_key":"target_segment","field_label":"Target segment","field_type":"text","ai_fill_enabled":true},{"field_key":"mde","field_label":"Minimum detectable effect","field_type":"text","ai_fill_enabled":true},{"field_key":"sample_size","field_label":"Sample size (per variant)","field_type":"number","ai_fill_enabled":false},{"field_key":"cost_of_experimentation","field_label":"Cost of experimentation","field_type":"number","options":{"unit":"days"},"ai_fill_enabled":false},{"field_key":"experiment_result","field_label":"Result","field_type":"select","options":["winner","loser","stopped","inconclusive"],"ai_fill_enabled":false},{"field_key":"experiment_decision","field_label":"Decision","field_type":"select","options":["roll_out","do_nothing","iterate"],"ai_fill_enabled":false},{"field_key":"erosion_risk","field_label":"Long-term erosion tracking","field_type":"checkbox","ai_fill_enabled":false}],"schema_groups":[{"group_key":"targeting","group_label":"Targeting","repeatable":false,"fields":[{"sub_key":"product","field_label":"Product","field_type":"text","ai_fill_enabled":true},{"sub_key":"market","field_label":"Market","field_type":"text","ai_fill_enabled":true},{"sub_key":"audience","field_label":"Audience","field_type":"text","ai_fill_enabled":true},{"sub_key":"surface","field_label":"Surface","field_type":"text","ai_fill_enabled":true},{"sub_key":"country","field_label":"Country","field_type":"text","ai_fill_enabled":true}]},{"group_key":"ice","group_label":"ICE","repeatable":false,"fields":[{"sub_key":"impact","field_label":"Impact (1–10)","field_type":"number","ai_fill_enabled":false},{"sub_key":"confidence","field_label":"Confidence (1–10)","field_type":"number","ai_fill_enabled":false},{"sub_key":"ease","field_label":"Ease / effort (1–10)","field_type":"number","ai_fill_enabled":false}]},{"group_key":"primary_kpi","group_label":"Primary KPI","repeatable":false,"fields":[{"sub_key":"label","field_label":"Label","field_type":"text","ai_fill_enabled":true},{"sub_key":"baseline","field_label":"Baseline","field_type":"text","ai_fill_enabled":true},{"sub_key":"target","field_label":"Target","field_type":"text","ai_fill_enabled":true}]},{"group_key":"secondary_kpi","group_label":"Secondary KPI","repeatable":false,"fields":[{"sub_key":"label","field_label":"Label","field_type":"text","ai_fill_enabled":true},{"sub_key":"baseline","field_label":"Baseline","field_type":"text","ai_fill_enabled":true},{"sub_key":"target","field_label":"Target","field_type":"text","ai_fill_enabled":true}]},{"group_key":"guardrail_kpi","group_label":"Guardrail KPI","repeatable":false,"fields":[{"sub_key":"label","field_label":"Label","field_type":"text","ai_fill_enabled":true},{"sub_key":"baseline","field_label":"Baseline","field_type":"text","ai_fill_enabled":true},{"sub_key":"target","field_label":"Target","field_type":"text","ai_fill_enabled":true}]},{"group_key":"primary_kpi_result","group_label":"Primary KPI result","repeatable":false,"fields":[{"sub_key":"label","field_label":"Label","field_type":"text","ai_fill_enabled":false},{"sub_key":"value","field_label":"Observed value","field_type":"text","ai_fill_enabled":false}]},{"group_key":"secondary_kpi_result","group_label":"Secondary KPI result","repeatable":false,"fields":[{"sub_key":"label","field_label":"Label","field_type":"text","ai_fill_enabled":false},{"sub_key":"value","field_label":"Observed value","field_type":"text","ai_fill_enabled":false}]}],"default_properties":{"status":"draft","experiment_status":"backlog","funnel_stage":"activation"}}'::jsonb
where slug = 'ab-experiment'
  and coalesce(is_system, false) = true
  and workspace_id is null;

update templates
set
  name = 'User Flow Definition',
  description = 'Goal, happy path, decisions, edge cases, and success state for one user task',
  structure_json = '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"User & Goal"}]},{"type":"paragraph","content":[{"type":"text","text":"Who is this for and what single task are they completing? Set Product / Market / Audience / Surface in Properties → Targeting.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[Persona or role + goal in one sentence.]"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Entry Point"}]},{"type":"paragraph","content":[{"type":"text","text":"How the user arrives — URL, CTA, notification, deep link, or prior flow.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[Entry point and trigger.]"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Happy Path"}]},{"type":"paragraph","content":[{"type":"text","text":"Ordered screens and actions from entry to success. One goal per flow.","marks":[{"type":"italic"}]}]},{"type":"orderedList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Screen / action 1]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Screen / action 2]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Screen / action 3]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Decision Points"}]},{"type":"paragraph","content":[{"type":"text","text":"Branches that change the path (auth, permissions, empty states, pricing tiers).","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Decision] — Yes → [path] / No → [path]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Edge Cases & Error States"}]},{"type":"paragraph","content":[{"type":"text","text":"What can go wrong, and what the user sees when it does. No dead ends.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Edge case] — [System response / recovery]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Success State"}]},{"type":"paragraph","content":[{"type":"text","text":"What the user sees and can do once the flow completes (confirmation, next CTA).","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[Success state.]"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Handoff Notes"}]},{"type":"paragraph","content":[{"type":"text","text":"Analytics events, data passed between steps, and open product/eng questions.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Event or data note]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Open question]"}]}]}]}]}'::jsonb,
  metadata = '{"document_type":"user_flow_definition","use_cases":["UX flows","Interaction design","Feature handoff to engineering"],"supported_views":["wiki","kanban"],"schema_fields":[{"field_key":"status","field_label":"Status","field_type":"select","options":["draft","in_progress","done"],"ai_fill_enabled":true},{"field_key":"due_date","field_label":"Due","field_type":"date","ai_fill_enabled":true},{"field_key":"owner","field_label":"Owner","field_type":"text","ai_fill_enabled":true},{"field_key":"summary","field_label":"Summary","field_type":"textarea","ai_fill_enabled":true},{"field_key":"origin","field_label":"Origin","field_type":"relation","ai_fill_enabled":false},{"field_key":"flow_status","field_label":"Flow status","field_type":"status","options":[{"value":"draft","label":"Draft","category":"unstarted"},{"value":"in_review","label":"In review","category":"started"},{"value":"approved","label":"Approved","category":"completed"}],"ai_fill_enabled":true},{"field_key":"product_area","field_label":"Product area","field_type":"select","options":["core_app","browser_extension","admin_panel","api"],"ai_fill_enabled":true},{"field_key":"target_release","field_label":"Target release","field_type":"text","ai_fill_enabled":false}],"schema_groups":[{"group_key":"targeting","group_label":"Targeting","repeatable":false,"fields":[{"sub_key":"product","field_label":"Product","field_type":"text","ai_fill_enabled":true},{"sub_key":"market","field_label":"Market","field_type":"text","ai_fill_enabled":true},{"sub_key":"audience","field_label":"Audience","field_type":"text","ai_fill_enabled":true},{"sub_key":"surface","field_label":"Surface","field_type":"text","ai_fill_enabled":true}]}],"default_properties":{"status":"draft","flow_status":"draft"}}'::jsonb
where slug = 'user-flow-definition'
  and coalesce(is_system, false) = true
  and workspace_id is null;

update templates
set
  name = 'GTM Plan',
  description = 'ICP, positioning, channels, launch sequencing, and success metrics for go-to-market',
  structure_json = '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Business Goal"}]},{"type":"paragraph","content":[{"type":"text","text":"What business outcome this GTM motion must deliver (pipeline, adoption, revenue). Set Market and Audience in Properties → Targeting.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[Primary business goal and time horizon.]"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"ICP & Beachhead"}]},{"type":"paragraph","content":[{"type":"text","text":"Ideal customer profile and the first segment you will win — industry, size, trigger events. Avoid ''everyone''.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"ICP: [firmographics / role / pains]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Beachhead: [narrow first market]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Exclusions: [who this is not for]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Positioning & Messaging"}]},{"type":"paragraph","content":[{"type":"text","text":"Value proposition vs status quo, and the core message every channel reinforces.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[Positioning statement.]"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Message pillar 1]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Message pillar 2]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Proof point / case study]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Channel Strategy"}]},{"type":"paragraph","content":[{"type":"text","text":"Where you acquire demand — for each channel: offer, asset, owner, and success metric.","marks":[{"type":"italic"}]}]},{"type":"table","content":[{"type":"tableRow","content":[{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Channel"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Offer / Asset"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Owner"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Success metric"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Channel]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Offer]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Owner]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Metric]"}]}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Launch Sequencing"}]},{"type":"paragraph","content":[{"type":"text","text":"Pre-launch → launch → post-launch milestones with owners and dates.","marks":[{"type":"italic"}]}]},{"type":"table","content":[{"type":"tableRow","content":[{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Phase"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Milestone"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Owner"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Target date"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"Pre-launch"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Milestone]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Owner]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Date]"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"Launch"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Milestone]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Owner]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Date]"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"Post-launch"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[30/60/90 review]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Owner]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Date]"}]}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Enablement & Proof"}]},{"type":"paragraph","content":[{"type":"text","text":"Sales/CS assets required: deck, one-pager, FAQ, objection handling, demo script.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Enablement asset]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Success Metrics & Decision Rules"}]},{"type":"paragraph","content":[{"type":"text","text":"Leading and lagging KPIs, plus what you do if the motion underperforms at day 30/60/90.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Primary KPI: [metric + target]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Guardrails: [CAC, win rate, cycle time]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"If off-track: [decision rule]"}]}]}]}]}'::jsonb,
  metadata = '{"document_type":"gtm_plan","use_cases":["Product launches","Campaign planning","Market entry"],"supported_views":["wiki","kanban","gantt","dashboard"],"schema_fields":[{"field_key":"status","field_label":"Status","field_type":"select","options":["draft","in_progress","done"],"ai_fill_enabled":true},{"field_key":"due_date","field_label":"Due","field_type":"date","ai_fill_enabled":true},{"field_key":"owner","field_label":"Owner","field_type":"text","ai_fill_enabled":true},{"field_key":"summary","field_label":"Summary","field_type":"textarea","ai_fill_enabled":true},{"field_key":"origin","field_label":"Origin","field_type":"relation","ai_fill_enabled":false},{"field_key":"gtm_status","field_label":"GTM status","field_type":"status","options":[{"value":"draft","label":"Draft","category":"unstarted"},{"value":"approved","label":"Approved","category":"unstarted"},{"value":"executing","label":"Executing","category":"started"},{"value":"complete","label":"Complete","category":"completed"}],"ai_fill_enabled":true},{"field_key":"target_launch_date","field_label":"Target launch date","field_type":"date","ai_fill_enabled":true},{"field_key":"primary_kpi","field_label":"Primary KPI","field_type":"text","ai_fill_enabled":true},{"field_key":"sponsor","field_label":"Sponsor","field_type":"text","ai_fill_enabled":true}],"schema_groups":[{"group_key":"targeting","group_label":"Targeting","repeatable":false,"fields":[{"sub_key":"market","field_label":"Market","field_type":"text","ai_fill_enabled":true},{"sub_key":"audience","field_label":"Audience","field_type":"text","ai_fill_enabled":true}]}],"default_properties":{"status":"draft","gtm_status":"draft"}}'::jsonb
where slug = 'gtm-plan'
  and coalesce(is_system, false) = true
  and workspace_id is null;

update templates
set
  name = 'Launch Checklist',
  description = 'Cross-functional readiness, go/no-go criteria, rollback, and post-launch review',
  structure_json = '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Launch Scope"}]},{"type":"paragraph","content":[{"type":"text","text":"What is shipping, to whom, and at what tier. Set Product and Market in Properties → Targeting.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[Scope, audience, and launch tier (soft / GA / major).]"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Readiness Checklist"}]},{"type":"paragraph","content":[{"type":"text","text":"Every gate needs a DRI, status, and evidence. ''In progress'' is not ready at T-72h.","marks":[{"type":"italic"}]}]},{"type":"table","content":[{"type":"tableRow","content":[{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Area"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Task"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"DRI"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Status"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Evidence"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"Product / QA"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Gate]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Owner]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Not started]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Link]"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"Engineering"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Monitoring / rollback]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Owner]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Not started]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Link]"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"Marketing / GTM"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Assets / pages]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Owner]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Not started]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Link]"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"Sales / CS"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Enablement / macros]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Owner]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Not started]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Link]"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"Legal / Privacy"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Review]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Owner]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Not started]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Link]"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"Analytics"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Events / dashboards]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Owner]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Not started]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Link]"}]}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Go / No-Go Criteria"}]},{"type":"paragraph","content":[{"type":"text","text":"Conditions that must be true to launch. Named authority decides go, delay, or reduced scope.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Criterion — must be true]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Go/no-go meeting: [date, T-72h]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Decision authority: [role/name]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Launch Day Plan"}]},{"type":"paragraph","content":[{"type":"text","text":"Comms timing, war-room coverage, feature flags / rollout phases.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Internal announce: [when / channel]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"External announce: [when / channel]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"On-call / war room: [who]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Rollout phases: [%, criteria to expand]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Rollback Plan"}]},{"type":"paragraph","content":[{"type":"text","text":"Trigger, owner who can execute, and customer-facing recovery steps.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[Rollback trigger, owner, and steps.]"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Post-Launch Review"}]},{"type":"paragraph","content":[{"type":"text","text":"Retro within 72h and T+30 review against success criteria.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Retro owner / date: […]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Success criteria vs actuals: […]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Follow-ups: […]"}]}]}]}]}'::jsonb,
  metadata = '{"document_type":"launch_checklist","use_cases":["Product launches","Feature rollouts","Release management"],"supported_views":["kanban","wiki"],"schema_fields":[{"field_key":"status","field_label":"Status","field_type":"select","options":["draft","in_progress","done"],"ai_fill_enabled":true},{"field_key":"due_date","field_label":"Due","field_type":"date","ai_fill_enabled":true},{"field_key":"owner","field_label":"Owner","field_type":"text","ai_fill_enabled":true},{"field_key":"summary","field_label":"Summary","field_type":"textarea","ai_fill_enabled":true},{"field_key":"origin","field_label":"Origin","field_type":"relation","ai_fill_enabled":false},{"field_key":"launch_date","field_label":"Launch date","field_type":"date","ai_fill_enabled":true},{"field_key":"launch_status","field_label":"Launch status","field_type":"status","options":[{"value":"planning","label":"Planning","category":"unstarted"},{"value":"ready","label":"Ready","category":"started"},{"value":"launched","label":"Launched","category":"completed"},{"value":"rolled_back","label":"Rolled back","category":"canceled"}],"ai_fill_enabled":true},{"field_key":"launch_tier","field_label":"Launch tier","field_type":"select","options":["soft","ga","major"],"ai_fill_enabled":true},{"field_key":"go_nogo_date","field_label":"Go/no-go meeting","field_type":"date","ai_fill_enabled":false}],"schema_groups":[{"group_key":"targeting","group_label":"Targeting","repeatable":false,"fields":[{"sub_key":"product","field_label":"Product","field_type":"text","ai_fill_enabled":true},{"sub_key":"market","field_label":"Market","field_type":"text","ai_fill_enabled":true}]}],"default_properties":{"status":"draft","launch_status":"planning"}}'::jsonb
where slug = 'launch-checklist'
  and coalesce(is_system, false) = true
  and workspace_id is null;

update templates
set
  name = 'Campaign Brief',
  description = 'Objective, audience, message, channels, budget, assets, and success metrics',
  structure_json = '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Objective"}]},{"type":"paragraph","content":[{"type":"text","text":"One campaign goal tied to a business outcome. Set Channel / Market / Audience in Properties → Targeting.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[Campaign objective.]"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Audience & Insight"}]},{"type":"paragraph","content":[{"type":"text","text":"Who this is for, and the insight that makes the message land.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[Audience + insight.]"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Key Message"}]},{"type":"paragraph","content":[{"type":"text","text":"The single message every asset should reinforce — plus proof points.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[Key message.]"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Proof point 1]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Proof point 2]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Channels & Tactics"}]},{"type":"paragraph","content":[{"type":"text","text":"Channel mix with tactic, owner, and timing. Keep primary Channel in Properties.","marks":[{"type":"italic"}]}]},{"type":"table","content":[{"type":"tableRow","content":[{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Channel"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Tactic"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Owner"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Timing"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Channel]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Tactic]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Owner]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Dates]"}]}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Creative & Assets"}]},{"type":"paragraph","content":[{"type":"text","text":"Required deliverables — formats, quantities, landing pages, forms.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Asset — format / owner / due]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Budget & Timeline"}]},{"type":"paragraph","content":[{"type":"text","text":"Total budget split and campaign window. Capture Budget in Properties.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Window: [start → end]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Paid / creative / tools / contingency: [split]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Success Metrics & Reporting"}]},{"type":"paragraph","content":[{"type":"text","text":"One primary metric, a few secondary, and reporting cadence.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Primary: [metric + target + baseline]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Secondary: [metric]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Reporting: [daily / weekly / final]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Approvals"}]},{"type":"paragraph","content":[{"type":"text","text":"Who must sign off before launch, and by when.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Stakeholder] — [what they approve] — Due: [date]"}]}]}]}]}'::jsonb,
  metadata = '{"document_type":"campaign_brief","use_cases":["Marketing campaigns","Product launches","Brand initiatives"],"supported_views":["wiki","kanban","gantt","dashboard"],"schema_fields":[{"field_key":"status","field_label":"Status","field_type":"select","options":["draft","in_progress","done"],"ai_fill_enabled":true},{"field_key":"due_date","field_label":"Due","field_type":"date","ai_fill_enabled":true},{"field_key":"owner","field_label":"Owner","field_type":"text","ai_fill_enabled":true},{"field_key":"summary","field_label":"Summary","field_type":"textarea","ai_fill_enabled":true},{"field_key":"origin","field_label":"Origin","field_type":"relation","ai_fill_enabled":false},{"field_key":"campaign_status","field_label":"Campaign status","field_type":"status","options":[{"value":"planning","label":"Planning","category":"unstarted"},{"value":"live","label":"Live","category":"started"},{"value":"complete","label":"Complete","category":"completed"}],"ai_fill_enabled":true},{"field_key":"channels","field_label":"Channel mix","field_type":"multi_select","options":["email","social","paid","organic","pr","events","partners"],"ai_fill_enabled":true},{"field_key":"budget","field_label":"Budget","field_type":"number","ai_fill_enabled":false},{"field_key":"campaign_window","field_label":"Campaign window","field_type":"date_range","ai_fill_enabled":true},{"field_key":"primary_metric","field_label":"Primary metric","field_type":"text","ai_fill_enabled":true}],"schema_groups":[{"group_key":"targeting","group_label":"Targeting","repeatable":false,"fields":[{"sub_key":"channel","field_label":"Channel","field_type":"text","ai_fill_enabled":true},{"sub_key":"market","field_label":"Market","field_type":"text","ai_fill_enabled":true},{"sub_key":"audience","field_label":"Audience","field_type":"text","ai_fill_enabled":true}]}],"default_properties":{"status":"draft","campaign_status":"planning"}}'::jsonb
where slug = 'campaign-brief'
  and coalesce(is_system, false) = true
  and workspace_id is null;

update templates
set
  name = 'Content Calendar Item',
  description = 'Angle, outline, SEO, distribution, and success metric for one content piece',
  structure_json = '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Brief & Angle"}]},{"type":"paragraph","content":[{"type":"text","text":"What this piece is about and the unique angle. Set Market / Audience / Channel in Properties → Targeting.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[Brief and angle.]"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Audience Job-to-Be-Done"}]},{"type":"paragraph","content":[{"type":"text","text":"What the reader is trying to accomplish after consuming this piece.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[JTBD / reader outcome.]"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Outline"}]},{"type":"paragraph","content":[{"type":"text","text":"The structure this piece will follow (H2s as promises to the reader).","marks":[{"type":"italic"}]}]},{"type":"orderedList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Section 1]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Section 2]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Section 3]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"SEO & Query Intent"}]},{"type":"paragraph","content":[{"type":"text","text":"Primary query, intent, and cluster/pillar this supports.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Primary query: [keyword]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Intent: [informational / commercial / …]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Cluster / pillar: [name]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Internal Links & CTA"}]},{"type":"paragraph","content":[{"type":"text","text":"Planned links in/out and the conversion action.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Link from/to]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"CTA: [action]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Distribution Plan"}]},{"type":"paragraph","content":[{"type":"text","text":"Where this gets published and promoted after ship.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Channel / date / owner]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Success Metric"}]},{"type":"paragraph","content":[{"type":"text","text":"One primary metric for this URL or asset — not vanity alone.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[Primary metric + target.]"}]}]}'::jsonb,
  metadata = '{"document_type":"editorial_calendar","use_cases":["Blog posts","Newsletters","Video/podcast planning"],"supported_views":["calendar","kanban","wiki"],"schema_fields":[{"field_key":"status","field_label":"Status","field_type":"select","options":["draft","in_progress","done"],"ai_fill_enabled":true},{"field_key":"due_date","field_label":"Due","field_type":"date","ai_fill_enabled":true},{"field_key":"owner","field_label":"Owner","field_type":"text","ai_fill_enabled":true},{"field_key":"summary","field_label":"Summary","field_type":"textarea","ai_fill_enabled":true},{"field_key":"origin","field_label":"Origin","field_type":"relation","ai_fill_enabled":false},{"field_key":"publish_date","field_label":"Publish date","field_type":"date","ai_fill_enabled":true},{"field_key":"content_status","field_label":"Content status","field_type":"status","options":[{"value":"idea","label":"Idea","category":"unstarted"},{"value":"brief","label":"Brief","category":"unstarted"},{"value":"drafting","label":"Drafting","category":"started"},{"value":"review","label":"Review","category":"started"},{"value":"scheduled","label":"Scheduled","category":"started"},{"value":"published","label":"Published","category":"completed"}],"ai_fill_enabled":true},{"field_key":"content_type","field_label":"Content type","field_type":"select","options":["blog","video","social","newsletter","podcast","guide"],"ai_fill_enabled":true},{"field_key":"target_query","field_label":"Target query","field_type":"text","ai_fill_enabled":true},{"field_key":"primary_metric","field_label":"Primary metric","field_type":"text","ai_fill_enabled":true},{"field_key":"campaign","field_label":"Campaign","field_type":"relation","ai_fill_enabled":false}],"schema_groups":[{"group_key":"targeting","group_label":"Targeting","repeatable":false,"fields":[{"sub_key":"market","field_label":"Market","field_type":"text","ai_fill_enabled":true},{"sub_key":"audience","field_label":"Audience","field_type":"text","ai_fill_enabled":true},{"sub_key":"channel","field_label":"Channel","field_type":"text","ai_fill_enabled":true}]}],"default_properties":{"status":"draft","content_status":"idea"}}'::jsonb
where slug = 'editorial-calendar'
  and coalesce(is_system, false) = true
  and workspace_id is null;

update templates
set
  name = 'SEO Brief',
  description = 'Keyword, intent, SERP analysis, outline, links, and on-page requirements',
  structure_json = '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Target Keyword & Search Intent"}]},{"type":"paragraph","content":[{"type":"text","text":"Primary keyword and what the searcher actually wants. Set Market / Audience / Channel in Properties → Targeting.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[Target keyword + intent.]"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"SERP & Competitor Analysis"}]},{"type":"paragraph","content":[{"type":"text","text":"What''s ranking now — word count, angle, gaps you will win.","marks":[{"type":"italic"}]}]},{"type":"table","content":[{"type":"tableRow","content":[{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"URL"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Word count"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Angle / gap"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Competing URL]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[n]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Notes]"}]}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Semantic Coverage"}]},{"type":"paragraph","content":[{"type":"text","text":"Secondary keywords, entities, and People Also Ask questions to address.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Secondary / related term]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[PAA question]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Content Outline"}]},{"type":"paragraph","content":[{"type":"text","text":"H2/H3 structure that satisfies intent better than the current SERP.","marks":[{"type":"italic"}]}]},{"type":"orderedList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[H2]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[H2]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[H2]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"On-Page Requirements"}]},{"type":"paragraph","content":[{"type":"text","text":"Title, meta description, schema, word-count range, and CTA.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Title: […]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Meta: […]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Schema: [type]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Word count target: [range]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"CTA: […]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Internal Linking Plan"}]},{"type":"paragraph","content":[{"type":"text","text":"Which existing pages should link to this, and what this page should link out to.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Page to link from/to]"}]}]}]}]}'::jsonb,
  metadata = '{"document_type":"seo_brief","use_cases":["SEO content","Page optimization","Content strategy"],"supported_views":["kanban","wiki"],"schema_fields":[{"field_key":"status","field_label":"Status","field_type":"select","options":["draft","in_progress","done"],"ai_fill_enabled":true},{"field_key":"due_date","field_label":"Due","field_type":"date","ai_fill_enabled":true},{"field_key":"owner","field_label":"Owner","field_type":"text","ai_fill_enabled":true},{"field_key":"summary","field_label":"Summary","field_type":"textarea","ai_fill_enabled":true},{"field_key":"origin","field_label":"Origin","field_type":"relation","ai_fill_enabled":false},{"field_key":"target_keyword","field_label":"Target keyword","field_type":"text","ai_fill_enabled":true},{"field_key":"search_intent","field_label":"Search intent","field_type":"select","options":["informational","navigational","transactional","commercial"],"ai_fill_enabled":true},{"field_key":"word_count_target","field_label":"Word count target","field_type":"number","ai_fill_enabled":false},{"field_key":"seo_status","field_label":"SEO status","field_type":"status","options":[{"value":"research","label":"Research","category":"unstarted"},{"value":"drafting","label":"Drafting","category":"started"},{"value":"optimizing","label":"Optimizing","category":"started"},{"value":"published","label":"Published","category":"completed"}],"ai_fill_enabled":true},{"field_key":"campaign","field_label":"Campaign","field_type":"relation","ai_fill_enabled":false}],"schema_groups":[{"group_key":"targeting","group_label":"Targeting","repeatable":false,"fields":[{"sub_key":"market","field_label":"Market","field_type":"text","ai_fill_enabled":true},{"sub_key":"audience","field_label":"Audience","field_type":"text","ai_fill_enabled":true},{"sub_key":"channel","field_label":"Channel","field_type":"text","ai_fill_enabled":true}]}],"default_properties":{"status":"draft","seo_status":"research"}}'::jsonb
where slug = 'seo-brief'
  and coalesce(is_system, false) = true
  and workspace_id is null;

update templates
set
  name = 'Social Post Batch',
  description = 'Campaign-aligned post batch with platforms, copy, schedule, and learnings',
  structure_json = '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Batch Objective"}]},{"type":"paragraph","content":[{"type":"text","text":"What this batch should achieve for the campaign or pillar. Set Market / Audience / Channel in Properties → Targeting.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[Objective + link to campaign if any.]"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Posts"}]},{"type":"paragraph","content":[{"type":"text","text":"Every post: platform constraints, copy, creative, CTA, and schedule. Respect character limits per network.","marks":[{"type":"italic"}]}]},{"type":"table","content":[{"type":"tableRow","content":[{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Post"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Platform"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Copy"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Creative"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"CTA"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Scheduled"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Status"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Post 1]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Platform]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Copy]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Asset]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[CTA]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Date]"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"[Not started]"}]}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Hashtags & Mentions"}]},{"type":"paragraph","content":[{"type":"text","text":"Reusable tags and accounts — keep lists short and relevant.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[#hashtag]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[@mention]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Compliance & Approvals"}]},{"type":"paragraph","content":[{"type":"text","text":"Claims, disclosures, and who must approve before scheduling.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Reviewer] — [what they check]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Performance Notes"}]},{"type":"paragraph","content":[{"type":"text","text":"What worked, what didn''t — feed this into the next batch.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[Wins, misses, and next experiments.]"}]}]}'::jsonb,
  metadata = '{"document_type":"social_post_batch","use_cases":["Social scheduling","Campaign amplification","Always-on content"],"supported_views":["calendar","kanban","wiki"],"schema_fields":[{"field_key":"status","field_label":"Status","field_type":"select","options":["draft","in_progress","done"],"ai_fill_enabled":true},{"field_key":"due_date","field_label":"Due","field_type":"date","ai_fill_enabled":true},{"field_key":"owner","field_label":"Owner","field_type":"text","ai_fill_enabled":true},{"field_key":"summary","field_label":"Summary","field_type":"textarea","ai_fill_enabled":true},{"field_key":"origin","field_label":"Origin","field_type":"relation","ai_fill_enabled":false},{"field_key":"batch_status","field_label":"Batch status","field_type":"status","options":[{"value":"drafting","label":"Drafting","category":"unstarted"},{"value":"scheduled","label":"Scheduled","category":"started"},{"value":"published","label":"Published","category":"completed"}],"ai_fill_enabled":true},{"field_key":"platforms","field_label":"Platforms","field_type":"multi_select","options":["linkedin","x","instagram","tiktok","facebook","youtube"],"ai_fill_enabled":true},{"field_key":"batch_window","field_label":"Batch window","field_type":"date_range","ai_fill_enabled":true},{"field_key":"campaign","field_label":"Campaign","field_type":"relation","ai_fill_enabled":false}],"schema_groups":[{"group_key":"targeting","group_label":"Targeting","repeatable":false,"fields":[{"sub_key":"market","field_label":"Market","field_type":"text","ai_fill_enabled":true},{"sub_key":"audience","field_label":"Audience","field_type":"text","ai_fill_enabled":true},{"sub_key":"channel","field_label":"Channel","field_type":"text","ai_fill_enabled":true}]}],"default_properties":{"status":"draft","batch_status":"drafting"}}'::jsonb
where slug = 'social-post-batch'
  and coalesce(is_system, false) = true
  and workspace_id is null;

-- Additive flat fields for workspaces that already use experiment_status
insert into metadata_schemas (workspace_id, field_key, field_label, field_type, options, ai_fill_enabled)
select
  ms.workspace_id,
  v.field_key,
  v.field_label,
  v.field_type,
  v.options,
  v.ai_fill_enabled
from (
  select distinct workspace_id
  from metadata_schemas
  where field_key = 'experiment_status'
) ms
cross join (
  values
    ('launch_date', 'Launch date', 'date', null::jsonb, true),
    ('growth_loop', 'Growth loop', 'text', null::jsonb, true),
    ('psychological_layer', 'Psychological layer', 'text', null::jsonb, true),
    ('target_segment', 'Target segment', 'text', null::jsonb, true),
    ('mde', 'Minimum detectable effect', 'text', null::jsonb, true),
    ('sample_size', 'Sample size (per variant)', 'number', null::jsonb, false),
    ('experiment_result', 'Result', 'select', '["winner","loser","stopped","inconclusive"]'::jsonb, false),
    ('experiment_decision', 'Decision', 'select', '["roll_out","do_nothing","iterate"]'::jsonb, false)
) as v(field_key, field_label, field_type, options, ai_fill_enabled)
where not exists (
  select 1 from metadata_schemas existing
  where existing.workspace_id = ms.workspace_id and existing.field_key = v.field_key
);

-- Additive flat fields for workspaces that already use launch_status
insert into metadata_schemas (workspace_id, field_key, field_label, field_type, options, ai_fill_enabled)
select
  ms.workspace_id,
  v.field_key,
  v.field_label,
  v.field_type,
  v.options,
  v.ai_fill_enabled
from (
  select distinct workspace_id
  from metadata_schemas
  where field_key = 'launch_status'
) ms
cross join (
  values
    ('launch_tier', 'Launch tier', 'select', '["soft","ga","major"]'::jsonb, true),
    ('go_nogo_date', 'Go/no-go meeting', 'date', null::jsonb, false)
) as v(field_key, field_label, field_type, options, ai_fill_enabled)
where not exists (
  select 1 from metadata_schemas existing
  where existing.workspace_id = ms.workspace_id and existing.field_key = v.field_key
);

-- Additive flat fields for workspaces that already use campaign_status
insert into metadata_schemas (workspace_id, field_key, field_label, field_type, options, ai_fill_enabled)
select
  ms.workspace_id,
  v.field_key,
  v.field_label,
  v.field_type,
  v.options,
  v.ai_fill_enabled
from (
  select distinct workspace_id
  from metadata_schemas
  where field_key = 'campaign_status'
) ms
cross join (
  values
    ('channels', 'Channel mix', 'multi_select', '["email","social","paid","organic","pr","events","partners"]'::jsonb, true),
    ('campaign_window', 'Campaign window', 'date_range', null::jsonb, true),
    ('primary_metric', 'Primary metric', 'text', null::jsonb, true)
) as v(field_key, field_label, field_type, options, ai_fill_enabled)
where not exists (
  select 1 from metadata_schemas existing
  where existing.workspace_id = ms.workspace_id and existing.field_key = v.field_key
);

-- Additive flat fields for workspaces that already use content_status
insert into metadata_schemas (workspace_id, field_key, field_label, field_type, options, ai_fill_enabled)
select
  ms.workspace_id,
  v.field_key,
  v.field_label,
  v.field_type,
  v.options,
  v.ai_fill_enabled
from (
  select distinct workspace_id
  from metadata_schemas
  where field_key = 'content_status'
) ms
cross join (
  values
    ('target_query', 'Target query', 'text', null::jsonb, true),
    ('primary_metric', 'Primary metric', 'text', null::jsonb, true)
) as v(field_key, field_label, field_type, options, ai_fill_enabled)
where not exists (
  select 1 from metadata_schemas existing
  where existing.workspace_id = ms.workspace_id and existing.field_key = v.field_key
);

-- Additive flat fields for workspaces that already use seo_status
insert into metadata_schemas (workspace_id, field_key, field_label, field_type, options, ai_fill_enabled)
select
  ms.workspace_id,
  v.field_key,
  v.field_label,
  v.field_type,
  v.options,
  v.ai_fill_enabled
from (
  select distinct workspace_id
  from metadata_schemas
  where field_key = 'seo_status'
) ms
cross join (
  values
    ('word_count_target', 'Word count target', 'number', null::jsonb, false)
) as v(field_key, field_label, field_type, options, ai_fill_enabled)
where not exists (
  select 1 from metadata_schemas existing
  where existing.workspace_id = ms.workspace_id and existing.field_key = v.field_key
);

-- Additive flat fields for workspaces that already use batch_status
insert into metadata_schemas (workspace_id, field_key, field_label, field_type, options, ai_fill_enabled)
select
  ms.workspace_id,
  v.field_key,
  v.field_label,
  v.field_type,
  v.options,
  v.ai_fill_enabled
from (
  select distinct workspace_id
  from metadata_schemas
  where field_key = 'batch_status'
) ms
cross join (
  values
    ('platforms', 'Platforms', 'multi_select', '["linkedin","x","instagram","tiktok","facebook","youtube"]'::jsonb, true),
    ('batch_window', 'Batch window', 'date_range', null::jsonb, true)
) as v(field_key, field_label, field_type, options, ai_fill_enabled)
where not exists (
  select 1 from metadata_schemas existing
  where existing.workspace_id = ms.workspace_id and existing.field_key = v.field_key
);

-- Additive flat fields for workspaces that already use gtm_status
insert into metadata_schemas (workspace_id, field_key, field_label, field_type, options, ai_fill_enabled)
select
  ms.workspace_id,
  v.field_key,
  v.field_label,
  v.field_type,
  v.options,
  v.ai_fill_enabled
from (
  select distinct workspace_id
  from metadata_schemas
  where field_key = 'gtm_status'
) ms
cross join (
  values
    ('primary_kpi', 'Primary KPI', 'text', null::jsonb, true)
) as v(field_key, field_label, field_type, options, ai_fill_enabled)
where not exists (
  select 1 from metadata_schemas existing
  where existing.workspace_id = ms.workspace_id and existing.field_key = v.field_key
);

-- Seed merged Targeting / ICE / KPI groups onto workspaces that use experiment or campaign fields.
do $$
declare
  ws record;
  groups_json jsonb := '[{"group_key":"targeting","group_label":"Targeting","repeatable":false,"fields":[{"sub_key":"product","field_key":"targeting_product","field_label":"Product","field_type":"text","sort_order":0,"ai_fill_enabled":true},{"sub_key":"market","field_key":"targeting_market","field_label":"Market","field_type":"text","sort_order":1,"ai_fill_enabled":true},{"sub_key":"audience","field_key":"targeting_audience","field_label":"Audience","field_type":"text","sort_order":2,"ai_fill_enabled":true},{"sub_key":"surface","field_key":"targeting_surface","field_label":"Surface","field_type":"text","sort_order":3,"ai_fill_enabled":true},{"sub_key":"country","field_key":"targeting_country","field_label":"Country","field_type":"text","sort_order":4,"ai_fill_enabled":true},{"sub_key":"channel","field_key":"targeting_channel","field_label":"Channel","field_type":"text","sort_order":5,"ai_fill_enabled":true}]},{"group_key":"ice","group_label":"ICE","repeatable":false,"fields":[{"sub_key":"impact","field_key":"ice_impact","field_label":"Impact (1–10)","field_type":"number","sort_order":0,"ai_fill_enabled":false},{"sub_key":"confidence","field_key":"ice_confidence","field_label":"Confidence (1–10)","field_type":"number","sort_order":1,"ai_fill_enabled":false},{"sub_key":"ease","field_key":"ice_ease","field_label":"Ease / effort (1–10)","field_type":"number","sort_order":2,"ai_fill_enabled":false}]},{"group_key":"primary_kpi","group_label":"Primary KPI","repeatable":false,"fields":[{"sub_key":"label","field_key":"primary_kpi_label","field_label":"Label","field_type":"text","sort_order":0,"ai_fill_enabled":true},{"sub_key":"baseline","field_key":"primary_kpi_baseline","field_label":"Baseline","field_type":"text","sort_order":1,"ai_fill_enabled":true},{"sub_key":"target","field_key":"primary_kpi_target","field_label":"Target","field_type":"text","sort_order":2,"ai_fill_enabled":true}]},{"group_key":"secondary_kpi","group_label":"Secondary KPI","repeatable":false,"fields":[{"sub_key":"label","field_key":"secondary_kpi_label","field_label":"Label","field_type":"text","sort_order":0,"ai_fill_enabled":true},{"sub_key":"baseline","field_key":"secondary_kpi_baseline","field_label":"Baseline","field_type":"text","sort_order":1,"ai_fill_enabled":true},{"sub_key":"target","field_key":"secondary_kpi_target","field_label":"Target","field_type":"text","sort_order":2,"ai_fill_enabled":true}]},{"group_key":"guardrail_kpi","group_label":"Guardrail KPI","repeatable":false,"fields":[{"sub_key":"label","field_key":"guardrail_kpi_label","field_label":"Label","field_type":"text","sort_order":0,"ai_fill_enabled":true},{"sub_key":"baseline","field_key":"guardrail_kpi_baseline","field_label":"Baseline","field_type":"text","sort_order":1,"ai_fill_enabled":true},{"sub_key":"target","field_key":"guardrail_kpi_target","field_label":"Target","field_type":"text","sort_order":2,"ai_fill_enabled":true}]},{"group_key":"primary_kpi_result","group_label":"Primary KPI result","repeatable":false,"fields":[{"sub_key":"label","field_key":"primary_kpi_result_label","field_label":"Label","field_type":"text","sort_order":0,"ai_fill_enabled":false},{"sub_key":"value","field_key":"primary_kpi_result_value","field_label":"Observed value","field_type":"text","sort_order":1,"ai_fill_enabled":false}]},{"group_key":"secondary_kpi_result","group_label":"Secondary KPI result","repeatable":false,"fields":[{"sub_key":"label","field_key":"secondary_kpi_result_label","field_label":"Label","field_type":"text","sort_order":0,"ai_fill_enabled":false},{"sub_key":"value","field_key":"secondary_kpi_result_value","field_label":"Observed value","field_type":"text","sort_order":1,"ai_fill_enabled":false}]}]'::jsonb;
begin
  for ws in
    select distinct workspace_id
    from metadata_schemas
    where field_key in ('experiment_status', 'campaign_status', 'gtm_status', 'launch_status', 'flow_status', 'content_status', 'seo_status', 'batch_status')
  loop
    perform public.seed_scope_metadata_groups(ws.workspace_id, groups_json);
  end loop;
end;
$$;

-- Rename Timeline → Duration where still labeled Timeline.
update metadata_schemas
set field_label = 'Duration'
where field_key = 'date_active'
  and field_label = 'Timeline';
