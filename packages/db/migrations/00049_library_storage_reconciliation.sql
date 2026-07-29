-- 28.4 — Compare library_sources.metadata.byte_size vs storage.objects bytes.

create or replace function public.library_source_byte_size(p_metadata jsonb)
returns bigint
language sql
immutable
as $$
  select coalesce(
    case
      when (p_metadata->>'byte_size') ~ '^\d+$'
        then (p_metadata->>'byte_size')::bigint
      else 0::bigint
    end,
    0::bigint
  );
$$;

create or replace function public.storage_object_byte_size(p_metadata jsonb)
returns bigint
language sql
immutable
as $$
  select coalesce(
    nullif(p_metadata->>'size', '')::bigint,
    nullif(p_metadata->>'contentLength', '')::bigint,
    0::bigint
  );
$$;

revoke all on function public.library_source_byte_size(jsonb) from public;
revoke all on function public.storage_object_byte_size(jsonb) from public;
grant execute on function public.library_source_byte_size(jsonb) to service_role;
grant execute on function public.storage_object_byte_size(jsonb) to service_role;

-- Workspace rollup: metadata totals vs storage.objects totals.
create or replace function public.library_storage_reconciliation(
  p_workspace_id uuid default null
)
returns table (
  workspace_id uuid,
  metadata_bytes bigint,
  storage_bytes bigint,
  source_count bigint,
  object_count bigint,
  drift_bytes bigint
)
language sql
stable
security definer
set search_path = public, storage
as $$
  with metadata_totals as (
    select
      ls.workspace_id,
      coalesce(sum(public.library_source_byte_size(ls.metadata)), 0)::bigint as metadata_bytes,
      count(*)::bigint as source_count
    from library_sources ls
    where p_workspace_id is null or ls.workspace_id = p_workspace_id
    group by ls.workspace_id
  ),
  storage_totals as (
    select
      public.storage_object_workspace_id(o.name) as workspace_id,
      coalesce(sum(public.storage_object_byte_size(o.metadata)), 0)::bigint as storage_bytes,
      count(*)::bigint as object_count
    from storage.objects o
    where o.bucket_id = 'library-files'
      and (
        p_workspace_id is null
        or public.storage_object_workspace_id(o.name) = p_workspace_id
      )
    group by 1
  ),
  workspace_ids as (
    select workspace_id from metadata_totals
    union
    select workspace_id from storage_totals where workspace_id is not null
  )
  select
    w.workspace_id,
    coalesce(m.metadata_bytes, 0) as metadata_bytes,
    coalesce(s.storage_bytes, 0) as storage_bytes,
    coalesce(m.source_count, 0) as source_count,
    coalesce(s.object_count, 0) as object_count,
    coalesce(s.storage_bytes, 0) - coalesce(m.metadata_bytes, 0) as drift_bytes
  from workspace_ids w
  left join metadata_totals m on m.workspace_id = w.workspace_id
  left join storage_totals s on s.workspace_id = w.workspace_id
  where w.workspace_id is not null
  order by abs(coalesce(s.storage_bytes, 0) - coalesce(m.metadata_bytes, 0)) desc;
$$;

-- Per-source drift for ops / repair scripts.
create or replace function public.library_source_storage_drift(
  p_workspace_id uuid default null
)
returns table (
  source_id uuid,
  workspace_id uuid,
  file_path text,
  metadata_bytes bigint,
  storage_bytes bigint,
  drift_bytes bigint,
  status text
)
language sql
stable
security definer
set search_path = public, storage
as $$
  with joined as (
    select
      ls.id as source_id,
      ls.workspace_id,
      ls.file_path,
      public.library_source_byte_size(ls.metadata) as metadata_bytes,
      public.storage_object_byte_size(o.metadata) as storage_bytes
    from library_sources ls
    left join storage.objects o
      on o.bucket_id = 'library-files'
      and o.name = ls.file_path
    where p_workspace_id is null or ls.workspace_id = p_workspace_id
  )
  select
    source_id,
    workspace_id,
    file_path,
    metadata_bytes,
    storage_bytes,
    storage_bytes - metadata_bytes as drift_bytes,
    case
      when storage_bytes = 0 and metadata_bytes > 0 then 'missing_object'
      when storage_bytes > 0 and metadata_bytes = 0 then 'missing_metadata'
      when storage_bytes <> metadata_bytes then 'size_mismatch'
      else 'ok'
    end as status
  from joined
  order by abs(storage_bytes - metadata_bytes) desc, file_path;
$$;

-- Upload-time verify: object exists with expected byte size.
create or replace function public.verify_library_storage_object(
  p_object_name text,
  p_expected_bytes bigint
)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'library-files'
      and o.name = p_object_name
      and public.storage_object_byte_size(o.metadata) = p_expected_bytes
  );
$$;

revoke all on function public.library_storage_reconciliation(uuid) from public;
revoke all on function public.library_source_storage_drift(uuid) from public;
revoke all on function public.verify_library_storage_object(text, bigint) from public;
grant execute on function public.library_storage_reconciliation(uuid) to service_role;
grant execute on function public.library_source_storage_drift(uuid) to service_role;
grant execute on function public.verify_library_storage_object(text, bigint) to service_role;
