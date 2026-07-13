-- Display names for users who shared documents with the current viewer.

create or replace function public.user_display_names_for_document_shares(user_ids uuid[])
returns table (
  id uuid,
  display_name text
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
      'Someone'
    )::text as display_name
  from auth.users u
  left join profiles p on p.id = u.id
  where u.id = any(user_ids)
    and exists (
      select 1
      from document_shares ds
      where ds.shared_by = u.id
        and (
          ds.grantee_user_id = auth.uid()
          or (
            ds.grantee_type = 'workspace'
            and public.is_workspace_member(ds.grantee_workspace_id)
          )
        )
    );
$$;

grant execute on function public.user_display_names_for_document_shares(uuid[]) to authenticated;
