-- Resolve actor display names for document activity viewers (including share recipients).

create or replace function public.user_display_names_for_document_activity(
  user_ids uuid[],
  document_id uuid
)
returns table (
  id uuid,
  display_name text,
  avatar_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select distinct
    u.id,
    coalesce(
      nullif(trim(p.display_name), ''),
      split_part(u.email, '@', 1),
      left(u.id::text, 8)
    )::text as display_name,
    p.avatar_url
  from auth.users u
  left join profiles p on p.id = u.id
  where u.id = any(user_ids)
    and exists (
      select 1
      from documents d
      where d.id = document_id
        and (
          public.is_workspace_member(d.workspace_id)
          or public.is_document_shared_with_user(d.id)
        )
    );
$$;

grant execute on function public.user_display_names_for_document_activity(uuid[], uuid) to authenticated;
