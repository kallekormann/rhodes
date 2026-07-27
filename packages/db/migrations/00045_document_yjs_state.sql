-- Durable Yjs CRDT state per document. The Y.Doc binary is the single source
-- of truth for the document body; documents.content/content_plain become a
-- read-only projection (search/RAG/previews) written from this state.

create table if not exists public.document_yjs_state (
  document_id uuid primary key references public.documents(id) on delete cascade,
  state bytea not null,
  seq bigint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.document_yjs_state enable row level security;
alter table public.document_yjs_state force row level security;

drop policy if exists "Readers can select yjs state" on public.document_yjs_state;
drop policy if exists "Writers can insert yjs state" on public.document_yjs_state;
drop policy if exists "Writers can update yjs state" on public.document_yjs_state;

create policy "Readers can select yjs state"
  on public.document_yjs_state for select
  using (
    public.is_workspace_member(public.document_workspace_id(document_id))
    or public.is_document_shared_with_user(document_id)
  );

create policy "Writers can insert yjs state"
  on public.document_yjs_state for insert
  with check (public.can_write_document(document_id));

create policy "Writers can update yjs state"
  on public.document_yjs_state for update
  using (public.can_write_document(document_id))
  with check (public.can_write_document(document_id));
