-- Minimal stand-in for the parts of Supabase that the migrations rely on, for running the
-- integration tests on a plain local PostgreSQL (use an image that includes pgvector).
-- NEVER run this against a real Supabase project: it would conflict with the real `auth` schema.
--
-- Apply BEFORE database/migrations/0001..0006, as a superuser:
--   psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/tests/local_supabase_shim.sql

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create schema if not exists extensions;
create schema if not exists auth;

create table if not exists auth.users (
  id                  uuid primary key,
  email               text,
  email_confirmed_at  timestamptz,
  raw_app_meta_data   jsonb,
  raw_user_meta_data  jsonb,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema public, auth, extensions to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Mirror Supabase's default privileges so the migrations' REVOKEs are tested realistically.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
