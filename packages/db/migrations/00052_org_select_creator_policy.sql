-- Allow INSERT ... RETURNING on organizations before bootstrap trigger adds membership.

drop policy if exists "Org members can select organizations" on public.organizations;

create policy "Org members can select organizations"
  on public.organizations for select
  using (
    public.is_org_member(id)
    or created_by = auth.uid()
  );
