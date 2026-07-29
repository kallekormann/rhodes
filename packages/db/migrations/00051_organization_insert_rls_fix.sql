-- Fix organization insert RLS: RETURNING requires SELECT before bootstrap trigger visible.
-- Also set created_by from auth.uid() when omitted.

create or replace function public.set_organization_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_set_created_by on public.organizations;
create trigger organizations_set_created_by
  before insert on public.organizations
  for each row execute function public.set_organization_created_by();

drop policy if exists "Org members can select organizations" on public.organizations;

create policy "Org members can select organizations"
  on public.organizations for select
  using (
    public.is_org_member(id)
    or created_by = auth.uid()
  );

drop policy if exists "Authenticated users can create organizations" on public.organizations;

create policy "Authenticated users can create organizations"
  on public.organizations for insert
  with check (
    auth.uid() is not null
    and (created_by is null or created_by = auth.uid())
  );
