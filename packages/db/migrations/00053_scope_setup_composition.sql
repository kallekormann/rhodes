-- M2.5.0: scope setup composition — bundle_ids, setup_config, template slugs

alter table workspaces
  add column if not exists bundle_ids text[] not null default '{}',
  add column if not exists setup_config jsonb not null default '{}';

alter table templates
  add column if not exists slug text;

create unique index if not exists templates_slug_unique
  on templates (slug)
  where slug is not null;

-- Backfill system template slugs and supported_views metadata
update templates
set
  slug = case name
    when 'Blank' then 'blank'
    when 'Meeting Minutes' then 'meeting-notes'
    when 'Report' then 'report'
    when 'Product Spec' then 'product-spec'
    else slug
  end,
  metadata = coalesce(metadata, '{}'::jsonb) || case name
    when 'Blank' then '{"supported_views":["wiki","kanban","calendar","gantt","dashboard"]}'::jsonb
    when 'Meeting Minutes' then '{"supported_views":["calendar","kanban"]}'::jsonb
    when 'Report' then '{"supported_views":["dashboard","calendar","gantt"]}'::jsonb
    when 'Product Spec' then '{"supported_views":["kanban","gantt","dashboard"]}'::jsonb
    else '{}'::jsonb
  end
where is_system = true
  and workspace_id is null;

-- Seed default metadata schemas on every new scope (not only bootstrap).
create or replace function public.create_user_workspace(
  ws_name text,
  is_team boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  uid uuid := auth.uid();
  personal_count int;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if ws_name is null or trim(ws_name) = '' then
    raise exception 'Scope name is required';
  end if;

  if not is_team then
    select count(*)::int
    into personal_count
    from workspace_members wm
    join workspaces w on w.id = wm.workspace_id
    where wm.user_id = uid
      and wm.role = 'owner'
      and w.is_team_workspace = false;

    if personal_count >= 10 then
      raise exception 'Personal scope limit reached';
    end if;
  end if;

  insert into public.workspaces (name, is_team_workspace)
  values (trim(ws_name), is_team)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, uid, 'owner');

  perform public.seed_default_metadata_schemas(ws_id);

  return ws_id;
end;
$$;

grant execute on function public.create_user_workspace(text, boolean) to authenticated;

-- Apply bundle metadata fields to a workspace (idempotent).
create or replace function public.seed_scope_metadata_fields(
  ws_id uuid,
  fields jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  field jsonb;
begin
  if fields is null or jsonb_typeof(fields) <> 'array' then
    return;
  end if;

  for field in select * from jsonb_array_elements(fields)
  loop
    insert into metadata_schemas (
      workspace_id,
      field_key,
      field_label,
      field_type,
      options
    )
    values (
      ws_id,
      field->>'field_key',
      field->>'field_label',
      coalesce(field->>'field_type', 'text'),
      case
        when field ? 'options' and jsonb_typeof(field->'options') = 'array'
          then field->'options'
        else null
      end
    )
    on conflict (workspace_id, field_key) do nothing;
  end loop;
end;
$$;

grant execute on function public.seed_scope_metadata_fields(uuid, jsonb) to authenticated;
