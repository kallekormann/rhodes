-- Resolve workspace names for document share badges (recipients may not be workspace members).

create or replace function public.workspace_names_for_share_context(ws_ids uuid[])
returns table (
  id uuid,
  name text
)
language sql
security definer
set search_path = public
stable
as $$
  select distinct w.id, w.name
  from workspaces w
  where w.id = any(ws_ids)
    and (
      public.is_workspace_member(w.id)
      or exists (
        select 1
        from documents d
        join document_shares ds on ds.document_id = d.id
        where d.workspace_id = w.id
          and (
            ds.grantee_user_id = auth.uid()
            or (
              ds.grantee_type = 'workspace'
              and public.is_workspace_member(ds.grantee_workspace_id)
            )
          )
      )
    );
$$;

grant execute on function public.workspace_names_for_share_context(uuid[]) to authenticated;
