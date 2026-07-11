-- Private bucket for library source files (PDF, DOCX, TXT).

insert into storage.buckets (id, name, public)
values ('library-files', 'library-files', false)
on conflict (id) do nothing;

create policy "Workspace members can upload library files"
  on storage.objects for insert
  with check (
    bucket_id = 'library-files'
    and auth.uid() is not null
  );

create policy "Workspace members can read library files"
  on storage.objects for select
  using (
    bucket_id = 'library-files'
    and auth.uid() is not null
  );
