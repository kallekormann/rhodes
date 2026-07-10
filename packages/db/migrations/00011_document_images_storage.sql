-- Dev bucket for inline document images.

insert into storage.buckets (id, name, public)
values ('document-images', 'document-images', false)
on conflict (id) do nothing;

create policy "Workspace members can upload document images"
  on storage.objects for insert
  with check (
    bucket_id = 'document-images'
    and auth.uid() is not null
  );

create policy "Workspace members can read document images"
  on storage.objects for select
  using (
    bucket_id = 'document-images'
    and auth.uid() is not null
  );
