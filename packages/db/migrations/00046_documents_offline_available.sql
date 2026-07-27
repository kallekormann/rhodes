-- Owner-opt-in offline availability (M1b.2 slice 1).
-- Row-level RLS still governs who may update a document; this trigger enforces
-- that only the document owner may change offline_available.

alter table public.documents
  add column if not exists offline_available boolean not null default false;

comment on column public.documents.offline_available is
  'When true, the document owner has opted in to encrypted offline caching. Only created_by may toggle.';

create or replace function public.guard_documents_offline_available()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.offline_available is true and new.created_by is distinct from auth.uid() then
      raise exception using
        errcode = '42501',
        message = 'only document owner can set offline_available';
    end if;
    return new;
  end if;

  if new.offline_available is distinct from old.offline_available
     and old.created_by is distinct from auth.uid() then
    raise exception using
      errcode = '42501',
      message = 'only document owner can change offline_available';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_documents_offline_available on public.documents;

create trigger guard_documents_offline_available
  before insert or update on public.documents
  for each row
  execute function public.guard_documents_offline_available();
