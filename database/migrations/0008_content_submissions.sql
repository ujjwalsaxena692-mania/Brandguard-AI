-- 0008: Content submissions + attachments + private storage bucket
--
-- Safe to re-run: IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS / ON CONFLICT.
-- Requires: 0002 (organisations, private.set_updated_at), 0003 (private.is_org_member,
-- private.has_org_role), 0007 (naming/RLS convention). Run in the Supabase SQL editor as `postgres`.
--
-- Access model: the BACKEND (service role) writes these tables and the storage objects after
-- checking the caller's role and ownership. Browsers may only SELECT: members see their own
-- submissions; owners/admins/reviewers see everyone's in their organisation.
--
-- Workflow (enforced by the API; the CHECKs below are a backstop, not the whole state machine):
--   draft -> submitted -> processing -> ready_for_analysis, plus failed and cancelled.
-- This phase never analyses or approves anything.

-- ---------------------------------------------------------------------------
-- content_submissions
-- ---------------------------------------------------------------------------
create table if not exists public.content_submissions (
  id                   uuid primary key default gen_random_uuid(),
  organisation_id      uuid not null references public.organisations (id) on delete cascade,
  submitted_by         uuid references auth.users (id) on delete set null,
  title                text not null,
  content_type         text,
  content_text         text not null default '',
  campaign_name        text,
  target_audience      text,
  platform             text,
  publishing_date      date,
  reviewer_context     text,
  status               text not null default 'draft',
  error_message        text,
  submitted_at         timestamptz,
  processed_at         timestamptz,
  analysis_text_length integer,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint content_submissions_title_length check (char_length(btrim(title)) between 3 and 120),
  constraint content_submissions_content_type check (
    content_type is null or content_type in (
      'social_post', 'ad_copy', 'blog_post', 'email_newsletter', 'landing_page',
      'press_release', 'product_description', 'presentation', 'other'
    )
  ),
  constraint content_submissions_content_length check (char_length(content_text) <= 20000),
  constraint content_submissions_campaign_length check (campaign_name is null or char_length(campaign_name) <= 100),
  constraint content_submissions_audience_length check (target_audience is null or char_length(target_audience) <= 150),
  constraint content_submissions_platform_length check (platform is null or char_length(platform) <= 100),
  constraint content_submissions_context_length check (reviewer_context is null or char_length(reviewer_context) <= 1000),
  constraint content_submissions_status check (
    status in ('draft', 'submitted', 'processing', 'ready_for_analysis', 'failed', 'cancelled')
  ),
  constraint content_submissions_error_length check (error_message is null or char_length(error_message) <= 500),
  constraint content_submissions_text_length check (analysis_text_length is null or analysis_text_length >= 0),
  -- Backstops for the workflow: later stages always carry the data they imply.
  constraint content_submissions_submitted_has_time check (
    status not in ('submitted', 'processing', 'ready_for_analysis') or submitted_at is not null
  ),
  constraint content_submissions_ready_has_length check (
    status <> 'ready_for_analysis' or analysis_text_length is not null
  ),
  constraint content_submissions_failed_has_reason check (status <> 'failed' or error_message is not null),
  -- Lets attachments reference (id, organisation_id) so they can never point across organisations.
  constraint content_submissions_id_org_key unique (id, organisation_id)
);

create index if not exists content_submissions_org_created_idx
  on public.content_submissions (organisation_id, created_at desc);
create index if not exists content_submissions_org_status_idx
  on public.content_submissions (organisation_id, status, created_at desc);
create index if not exists content_submissions_org_author_idx
  on public.content_submissions (organisation_id, submitted_by, created_at desc);

drop trigger if exists content_submissions_set_updated_at on public.content_submissions;
create trigger content_submissions_set_updated_at
  before update on public.content_submissions
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- submission_attachments
-- Text is extracted once and stored here only; the file lives in the private bucket at
-- <organisation_id>/<submission_id>/<attachment_id>.<ext>.
-- ---------------------------------------------------------------------------
create table if not exists public.submission_attachments (
  id                uuid primary key default gen_random_uuid(),
  submission_id     uuid not null,
  organisation_id   uuid not null,
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
  constraint submission_attachments_submission_fkey
    foreign key (submission_id, organisation_id)
    references public.content_submissions (id, organisation_id) on delete cascade,
  constraint submission_attachments_filename_length check (char_length(original_filename) between 1 and 255),
  constraint submission_attachments_mime_type check (
    mime_type in (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    )
  ),
  constraint submission_attachments_size check (size_bytes between 1 and 10485760),
  constraint submission_attachments_status check (status in ('uploaded', 'processing', 'ready', 'failed')),
  constraint submission_attachments_ready_has_text check (status <> 'ready' or extracted_text is not null),
  constraint submission_attachments_text_length check (text_length is null or text_length >= 0),
  constraint submission_attachments_error_length check (error_message is null or char_length(error_message) <= 500),
  constraint submission_attachments_path_in_submission check (
    storage_path like organisation_id::text || '/' || submission_id::text || '/%'
  ),
  constraint submission_attachments_storage_path_key unique (storage_path)
);

create index if not exists submission_attachments_submission_idx
  on public.submission_attachments (submission_id, created_at);
create index if not exists submission_attachments_org_idx
  on public.submission_attachments (organisation_id);

drop trigger if exists submission_attachments_set_updated_at on public.submission_attachments;
create trigger submission_attachments_set_updated_at
  before update on public.submission_attachments
  for each row execute function private.set_updated_at();

-- Attachments may only be added while the submission is still a draft (even if the API had a bug).
-- Checked in this order so each failure reports the right error class:
--   1. no submission with this id AND organisation  -> foreign_key_violation (23503)
--   2. the submission exists but is not a draft      -> check_violation (23514)
-- The composite foreign key stays as the final integrity guarantee.
create or replace function private.guard_attachment_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_status text;
begin
  select s.status
    into parent_status
    from public.content_submissions s
   where s.id = new.submission_id
     and s.organisation_id = new.organisation_id;

  if not found then
    raise exception 'submission does not exist in this organisation'
      using errcode = '23503';
  end if;

  if parent_status <> 'draft' then
    raise exception 'attachments can only be added to draft submissions'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists submission_attachments_guard_parent on public.submission_attachments;
create trigger submission_attachments_guard_parent
  before insert on public.submission_attachments
  for each row execute function private.guard_attachment_parent();

-- ---------------------------------------------------------------------------
-- Row Level Security: read-only for clients; nobody writes via the Data API.
-- ---------------------------------------------------------------------------
alter table public.content_submissions enable row level security;
alter table public.submission_attachments enable row level security;

revoke all on public.content_submissions from anon, authenticated;
revoke all on public.submission_attachments from anon, authenticated;
grant select on public.content_submissions to authenticated;
grant select on public.submission_attachments to authenticated;

-- Own submissions, or any in the organisation for owners/admins/reviewers (creators: own only).
drop policy if exists content_submissions_select on public.content_submissions;
create policy content_submissions_select on public.content_submissions
  for select to authenticated
  using (
    private.is_org_member(organisation_id)
    and (
      submitted_by = (select auth.uid())
      or private.has_org_role(organisation_id, array['owner', 'admin', 'reviewer'])
    )
  );

-- Attachments are visible exactly when their submission is (the subquery is itself filtered by
-- the policy above, so the two can never drift apart).
drop policy if exists submission_attachments_select on public.submission_attachments;
create policy submission_attachments_select on public.submission_attachments
  for select to authenticated
  using (
    exists (
      select 1 from public.content_submissions s where s.id = submission_attachments.submission_id
    )
  );

-- ---------------------------------------------------------------------------
-- Private storage bucket for attachments (kept apart from approved knowledge on purpose).
-- Skipped on plain PostgreSQL (the local test shim has no `storage` schema). No policies are
-- created on storage.objects: with RLS on and no policy, anon/authenticated can neither read nor
-- write objects, and only the backend's service-role key can. Do not add policies or make it public.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'submission-attachments',
      'submission-attachments',
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
