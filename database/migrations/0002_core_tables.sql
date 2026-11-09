-- 0002: core tenancy tables (organisations, profiles, memberships, invitations, audit logs)
--
-- Safe to re-run: every statement is IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS.
-- NOTE: re-running does not alter columns or constraints of tables that already exist.
-- Row Level Security is enabled and policies are created in 0004.
-- Requires: 0001 (extensions). Run in the Supabase SQL editor as the `postgres` role.

-- A schema that is NOT exposed through the Supabase Data API (PostgREST). Trigger and
-- policy helper functions live here so they can never be called as /rpc endpoints.
create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- organisations
-- ---------------------------------------------------------------------------
create table if not exists public.organisations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint organisations_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint organisations_slug_format check (
    char_length(slug) between 3 and 63 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint organisations_slug_key unique (slug)
);

create index if not exists organisations_created_by_idx on public.organisations (created_by);

drop trigger if exists organisations_set_updated_at on public.organisations;
create trigger organisations_set_updated_at
  before update on public.organisations
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- profiles (one row per auth user; auth.users stays the identity source)
-- No credentials of any kind are stored here.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_full_name_length check (full_name is null or char_length(full_name) <= 200),
  constraint profiles_avatar_url_https check (
    avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 2048)
  )
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- organisation_memberships
-- A user may belong to several organisations, once each. A removed member is a
-- deleted row; 'suspended' keeps the row but grants no access.
-- ---------------------------------------------------------------------------
create table if not exists public.organisation_memberships (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  role             text not null,
  status           text not null default 'active',
  joined_at        timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  constraint organisation_memberships_role_valid
    check (role in ('owner', 'admin', 'reviewer', 'creator')),
  constraint organisation_memberships_status_valid
    check (status in ('active', 'suspended')),
  constraint organisation_memberships_org_user_key unique (organisation_id, user_id)
);

create index if not exists organisation_memberships_user_id_idx
  on public.organisation_memberships (user_id);

-- ---------------------------------------------------------------------------
-- organisation_invitations
-- Only a SHA-256 hash (64 lowercase hex chars) of the token is stored. The
-- plaintext token exists only in the invitation link/email.
-- 'owner' cannot be granted by invitation; ownership is created with the
-- organisation or changed by an existing owner.
-- ---------------------------------------------------------------------------
create table if not exists public.organisation_invitations (
  id                     uuid primary key default gen_random_uuid(),
  organisation_id        uuid not null references public.organisations (id) on delete cascade,
  email                  text not null,
  role                   text not null,
  invitation_token_hash  text not null,
  invited_by             uuid references auth.users (id) on delete set null,
  expires_at             timestamptz not null default (now() + interval '7 days'),
  accepted_at            timestamptz,
  created_at             timestamptz not null default now(),
  constraint organisation_invitations_email_normalised check (
    email = lower(btrim(email))
    and char_length(email) between 3 and 320
    and position('@' in email) > 1
  ),
  constraint organisation_invitations_role_valid check (role in ('admin', 'reviewer', 'creator')),
  constraint organisation_invitations_token_hash_format
    check (invitation_token_hash ~ '^[0-9a-f]{64}$'),
  constraint organisation_invitations_expiry_window check (
    expires_at > created_at and expires_at <= created_at + interval '30 days'
  ),
  constraint organisation_invitations_token_hash_key unique (invitation_token_hash)
);

create index if not exists organisation_invitations_organisation_id_idx
  on public.organisation_invitations (organisation_id);
create index if not exists organisation_invitations_email_idx
  on public.organisation_invitations (email);
-- At most one pending invitation per email per organisation.
create unique index if not exists organisation_invitations_pending_email_key
  on public.organisation_invitations (organisation_id, email)
  where accepted_at is null;

-- ---------------------------------------------------------------------------
-- audit_logs (append-only by privilege: clients get SELECT only, see 0004)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  actor_id         uuid references auth.users (id) on delete set null,
  action           text not null,
  entity_type      text not null,
  entity_id        uuid,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  constraint audit_logs_action_length check (char_length(action) between 1 and 100),
  constraint audit_logs_entity_type_length check (char_length(entity_type) between 1 and 100),
  constraint audit_logs_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists audit_logs_org_created_idx
  on public.audit_logs (organisation_id, created_at desc);
create index if not exists audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
