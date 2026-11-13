-- 0007: Knowledge Hub (approved brand-knowledge documents) + private storage bucket
--
-- Safe to re-run: IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS / ON CONFLICT.
-- Requires: 0002 (tables, private.set_updated_at), 0003 (private.is_org_member), 0004 (convention).
-- Run in the Supabase SQL editor as the `postgres` role.
--
-- Access model: the BACKEND (service role) writes this table and the storage objects after
-- checking the caller's role. Browsers may only SELECT metadata of their own organisation.

-- ---------------------------------------------------------------------------
-- knowledge_documents
-- Text is extracted once and stored here only (no second copy elsewhere); the original file
-- lives in the private bucket at <organisation_id>/<document_id>.<ext>.
-- ---------------------------------------------------------------------------
create table if not exists public.knowledge_documents (
  id                uuid primary key default gen_random_uuid(),
  organisation_id   uuid not null references public.organisations (id) on delete cascade,
  uploaded_by       uuid references auth.users (id) on delete set null,
  original_filename text not null,
  storage_path      text not null,
  mime_type         text not null,
  size_bytes        bigint not null,
  status            text not null default 'uploaded',
  extracted_text    text,
  text_length       integer,
  error_message     text,
  processed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint knowledge_documents_filename_length check (char_length(original_filename) between 1 and 255),
  constraint knowledge_documents_mime_type check (
    mime_type in (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    )
  ),
  constraint knowledge_documents_size check (size_bytes between 1 and 10485760),
  constraint knowledge_documents_status check (status in ('uploaded', 'processing', 'ready', 'failed')),
  constraint knowledge_documents_ready_has_text check (status <> 'ready' or extracted_text is not null),
  constraint knowledge_documents_text_length check (text_length is null or text_length >= 0),
  constraint knowledge_documents_error_length check (error_message is null or char_length(error_message) <= 500),
  -- A document's object always sits under its own organisation's prefix.
  constraint knowledge_documents_path_in_org check (storage_path like organisation_id::text || '/%'),
  constraint knowledge_documents_storage_path_key unique (storage_path)
);

create index if not exists knowledge_documents_org_created_idx
  on public.knowledge_documents (organisation_id, created_at desc);
create index if not exists knowledge_documents_uploaded_by_idx
  on public.knowledge_documents (uploaded_by);

drop trigger if exists knowledge_documents_set_updated_at on public.knowledge_documents;
create trigger knowledge_documents_set_updated_at
  before update on public.knowledge_documents
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: members of the organisation may read; nobody writes via the Data API.
-- ---------------------------------------------------------------------------
alter table public.knowledge_documents enable row level security;

revoke all on public.knowledge_documents from anon, authenticated;
grant select on public.knowledge_documents to authenticated;

drop policy if exists knowledge_documents_select_member on public.knowledge_documents;
create policy knowledge_documents_select_member on public.knowledge_documents
  for select to authenticated
  using (private.is_org_member(organisation_id));

-- ---------------------------------------------------------------------------
-- Private storage bucket. Skipped on plain PostgreSQL (the local test shim has no `storage`
-- schema); on Supabase it always runs. No policies are created on storage.objects on purpose:
-- with RLS on and no policy, anon/authenticated can neither read nor write objects, and only
-- the backend's service-role key can. Do not add policies or turn the bucket public.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'knowledge-documents',
      'knowledge-documents',
      false,
      10485760,
      array[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ]
    )
    on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end
$$;
