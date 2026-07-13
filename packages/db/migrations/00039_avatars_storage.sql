-- Avatar uploads (public read, per-user write path).

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Users upload own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users update own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users delete own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Workspace member list includes avatar paths.
drop function if exists public.list_workspace_members(uuid);

create function public.list_workspace_members(ws_id uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_workspace_member(ws_id) then
    raise exception 'Forbidden';
  end if;

  return query
  select
    wm.user_id,
    coalesce(nullif(trim(p.display_name), ''), 'Teammate') as display_name,
    p.avatar_url,
    wm.role,
    wm.created_at
  from workspace_members wm
  left join profiles p on p.id = wm.user_id
  where wm.workspace_id = ws_id
  order by wm.created_at asc;
end;
$$;

grant execute on function public.list_workspace_members(uuid) to authenticated;

-- Share / activity actor lookup includes avatar paths.
drop function if exists public.user_display_names_for_document_shares(uuid[]);

create function public.user_display_names_for_document_shares(user_ids uuid[])
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
      'Someone'
    )::text as display_name,
    p.avatar_url
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
