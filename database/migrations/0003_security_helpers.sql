-- 0003: security helper functions and membership integrity guard
--
-- Why SECURITY DEFINER here: RLS policies on organisation_memberships must ask
-- "is the caller a member?", which means reading organisation_memberships. Doing that
-- inside a policy on the same table recurses infinitely. These helpers read the table
-- as the function owner (RLS is not forced), which breaks the recursion.
--
-- Hardening applied to every SECURITY DEFINER function:
--   * `set search_path = ''` and fully qualified object names (no search-path hijacking)
--   * lives in the `private` schema (not exposed through the Data API)
--   * EXECUTE revoked from PUBLIC/anon, granted only to the roles that need it
--   * the caller identity comes from auth.uid(), never from an argument
-- Requires: 0002.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.current_org_role(p_organisation_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.organisation_memberships m
  where m.organisation_id = p_organisation_id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
$$;

create or replace function private.is_org_member(p_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organisation_memberships m
    where m.organisation_id = p_organisation_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
$$;

create or replace function private.has_org_role(p_organisation_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organisation_memberships m
    where m.organisation_id = p_organisation_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any (p_roles)
  )
$$;

-- True when the caller and p_user_id are both members of at least one common organisation
-- (caller must be active). Used to let colleagues see each other's profile.
create or replace function private.shares_organisation_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organisation_memberships mine
    join public.organisation_memberships theirs
      on theirs.organisation_id = mine.organisation_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'active'
      and theirs.user_id = p_user_id
  )
$$;

revoke all on function private.current_org_role(uuid) from public, anon;
revoke all on function private.is_org_member(uuid) from public, anon;
revoke all on function private.has_org_role(uuid, text[]) from public, anon;
revoke all on function private.shares_organisation_with(uuid) from public, anon;
grant execute on function private.current_org_role(uuid) to authenticated, service_role;
grant execute on function private.is_org_member(uuid) to authenticated, service_role;
grant execute on function private.has_org_role(uuid, text[]) to authenticated, service_role;
grant execute on function private.shares_organisation_with(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Membership integrity guard (applies to every caller, including service role):
--   1. organisation_id and user_id of a membership never change.
--   2. An organisation always keeps at least one active owner.
-- Invoker-rights trigger function: it needs no elevated privilege because the
-- trigger runs inside the statement that already passed RLS/privilege checks.
-- ---------------------------------------------------------------------------
create or replace function private.guard_membership_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_losing_owner boolean := false;
begin
  if tg_op = 'UPDATE' then
    if new.organisation_id <> old.organisation_id or new.user_id <> old.user_id then
      raise exception 'organisation_id and user_id of a membership cannot be changed'
        using errcode = '23514';
    end if;
    if old.role = 'owner' and old.status = 'active'
       and (new.role <> 'owner' or new.status <> 'active') then
      v_losing_owner := true;
    end if;
  elsif tg_op = 'DELETE' then
    if old.role = 'owner' and old.status = 'active' then
      v_losing_owner := true;
    end if;
  end if;

  if v_losing_owner
     -- When the organisation itself is being deleted (ON DELETE CASCADE) it is already gone.
     and exists (select 1 from public.organisations o where o.id = old.organisation_id) then
    -- Lock the other owners so two concurrent demotions cannot both succeed.
    perform 1
    from public.organisation_memberships m
    where m.organisation_id = old.organisation_id
      and m.role = 'owner'
      and m.status = 'active'
      and m.id <> old.id
    for update;
    if not found then
      raise exception 'An organisation must keep at least one active owner'
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists organisation_memberships_guard on public.organisation_memberships;
create trigger organisation_memberships_guard
  before update or delete on public.organisation_memberships
  for each row execute function private.guard_membership_changes();
