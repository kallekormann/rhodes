-- Enable Supabase Realtime for collaborative document updates.

do $$
begin
  alter publication supabase_realtime add table public.documents;
exception
  when duplicate_object then
    null;
  when undefined_object then
    raise notice 'supabase_realtime publication not found — Realtime must be enabled in the Supabase stack';
end $$;
