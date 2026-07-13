-- Share picker: search co-members by display name or auth email.

create or replace function public.search_document_share_targets(p_query text default '')
returns table (
  kind text,
  target_id uuid,
  label text,
  subtitle text
)
language sql
security definer
set search_path = public
stable
as $$
  with viewer as (
    select auth.uid() as uid
  ),
  q as (
    select lower(trim(coalesce(p_query, ''))) as term
  ),
  my_workspaces as (
    select wm.workspace_id
    from workspace_members wm
    cross join viewer v
    where wm.user_id = v.uid
  ),
  workspace_hits as (
    select
      'workspace'::text as kind,
      w.id as target_id,
      w.name::text as label,
      case when w.is_team_workspace then 'Team scope' else 'Personal scope' end as subtitle,
      0 as sort_key
    from workspaces w
    join my_workspaces mw on mw.workspace_id = w.id
    cross join q
    where q.term = '' or lower(w.name) like '%' || q.term || '%'
  ),
  people_hits as (
    select distinct on (other.user_id)
      'user'::text as kind,
      other.user_id as target_id,
      coalesce(
        nullif(trim(p.display_name), ''),
        split_part(u.email, '@', 1),
        'Teammate'
      )::text as label,
      coalesce(u.email, '')::text as subtitle,
      1 as sort_key
    from workspace_members self
    cross join viewer v
    join workspace_members other
      on other.workspace_id = self.workspace_id
      and other.user_id <> v.uid
    left join profiles p on p.id = other.user_id
    join auth.users u on u.id = other.user_id
    cross join q
    where self.user_id = v.uid
      and (
        q.term = ''
        or lower(coalesce(p.display_name, '')) like '%' || q.term || '%'
        or lower(coalesce(u.email, '')) like '%' || q.term || '%'
      )
    order by other.user_id, lower(coalesce(u.email, ''))
  )
  select kind, target_id, label, subtitle
  from (
    select kind, target_id, label, subtitle, sort_key from workspace_hits
    union all
    select kind, target_id, label, subtitle, sort_key from people_hits
  ) combined
  order by sort_key, lower(label)
  limit 20;
$$;

grant execute on function public.search_document_share_targets(text) to authenticated;
