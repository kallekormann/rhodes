-- Document activity log for shared collaboration and history UI.

create table document_activity (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid references documents(id) on delete cascade not null,
  workspace_id uuid references workspaces(id) on delete cascade not null,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (
    event_type in (
      'comment_added',
      'comment_removed',
      'property_changed',
      'block_removed',
      'title_changed',
      'content_edited',
      'version_restored',
      'shared_with',
      'share_removed'
    )
  ),
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now() not null
);

create index document_activity_document_created_idx
  on document_activity (document_id, created_at desc);

alter table document_activity enable row level security;
alter table document_activity force row level security;

create policy "Readers can select document activity"
  on document_activity for select
  using (
    public.is_workspace_member(workspace_id)
    or public.is_document_shared_with_user(document_id)
  );

create policy "Writers can insert document activity"
  on document_activity for insert
  with check (public.can_write_document(document_id));

do $$
begin
  alter publication supabase_realtime add table public.document_activity;
exception
  when duplicate_object then
    null;
  when undefined_object then
    raise notice 'supabase_realtime publication not found';
end $$;
