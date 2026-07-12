-- Enable Supabase Realtime for library indexing status updates.

do $$
begin
  alter publication supabase_realtime add table public.library_sources;
exception
  when duplicate_object then
    null;
  when undefined_object then
    raise notice 'supabase_realtime publication not found — Realtime must be enabled in the Supabase stack';
end $$;
