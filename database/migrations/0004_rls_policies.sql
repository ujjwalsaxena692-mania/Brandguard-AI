-- 0004: privileges and Row Level Security
-- Requires: 0002, 0003.
--
-- Supabase grants ALL on new public tables to anon/authenticated by default, so we
-- first REVOKE everything and then grant only what each policy needs. Column-level
-- grants stop clients from touching identity columns (user_id, organisation_id, ...).
-- Service role bypasses RLS by design: backend code using it MUST do its own
-- authorisation (see backend/app/services/organisation_access.py).
-- RLS is ENABLED but not FORCED, so the SECURITY DEFINER helpers (owned by the
-- migration role) can read memberships without recursion.

alter table public.organisations            enable row level security;
alter table public.profiles                 enable row level security;
alter table public.organisation_memberships enable row level security;
alter table public.organisation_invitations enable row level security;
alter table public.audit_logs               enable row level security;

revoke all on public.organisations            from anon, authenticated;
revoke all on public.profiles                 from anon, authenticated;
revoke all on public.organisation_memberships from anon, authenticated;
revoke all on public.organisation_invitations from anon, authenticated;
revoke all on public.audit_logs               from anon, authenticated;

grant select on public.organisations            to authenticated;
grant select on public.profiles                 to authenticated;
grant select on public.organisation_memberships to authenticated;
grant select on public.organisation_invitations to authenticated;
grant select on public.audit_logs               to authenticated;

grant update (name)                      on public.organisations            to authenticated;
grant update (full_name, avatar_url)     on public.profiles                 to authenticated;
grant update (role, status)              on public.organisation_memberships to authenticated;
grant delete                             on public.organisation_memberships to authenticated;
grant insert (organisation_id, email, role, invitation_token_hash, invited_by, expires_at)
                                         on public.organisation_invitations to authenticated;
grant delete                             on public.organisation_invitations to authenticated;
-- Deliberately NOT granted to clients:
--   organisations: INSERT (use create_organisation()), DELETE, slug changes
--   profiles: INSERT/DELETE (created by trigger, removed by cascade)
--   memberships: INSERT (created by create_organisation()/accept_invitation())
--   invitations: UPDATE (accepted_at is set by accept_invitation())
--   audit_logs: INSERT/UPDATE/DELETE (written server-side only)

-- ---------------------------------------------------------------------------
-- organisations
-- ---------------------------------------------------------------------------
drop policy if exists organisations_select_member on public.organisations;
create policy organisations_select_member on public.organisations
  for select to authenticated
  using (private.is_org_member(id));

drop policy if exists organisations_update_admin on public.organisations;
create policy organisations_update_admin on public.organisations
  for update to authenticated
  using (private.has_org_role(id, array['owner', 'admin']))
  with check (private.has_org_role(id, array['owner', 'admin']));

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_self_or_colleague on public.profiles;
create policy profiles_select_self_or_colleague on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_organisation_with(id));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- organisation_memberships
--   owner  : may change/remove any member (incl. other owners)
--   admin  : may change/remove reviewers and creators only, and may only set those roles
--   others : may only see their own row and the members of their organisations; may leave
-- ---------------------------------------------------------------------------
drop policy if exists memberships_select on public.organisation_memberships;
create policy memberships_select on public.organisation_memberships
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_org_member(organisation_id));

drop policy if exists memberships_update on public.organisation_memberships;
create policy memberships_update on public.organisation_memberships
  for update to authenticated
  using (
    private.has_org_role(organisation_id, array['owner'])
    or (private.has_org_role(organisation_id, array['admin']) and role in ('reviewer', 'creator'))
  )
  with check (
    private.has_org_role(organisation_id, array['owner'])
    or (private.has_org_role(organisation_id, array['admin']) and role in ('reviewer', 'creator'))
  );

drop policy if exists memberships_delete on public.organisation_memberships;
create policy memberships_delete on public.organisation_memberships
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_org_role(organisation_id, array['owner'])
    or (private.has_org_role(organisation_id, array['admin']) and role in ('reviewer', 'creator'))
  );

-- ---------------------------------------------------------------------------
-- organisation_invitations (owners/admins only; admins cannot invite admins)
-- ---------------------------------------------------------------------------
drop policy if exists invitations_select_admin on public.organisation_invitations;
create policy invitations_select_admin on public.organisation_invitations
  for select to authenticated
  using (private.has_org_role(organisation_id, array['owner', 'admin']));

drop policy if exists invitations_insert_admin on public.organisation_invitations;
create policy invitations_insert_admin on public.organisation_invitations
  for insert to authenticated
  with check (
    invited_by = (select auth.uid())
    and (
      private.has_org_role(organisation_id, array['owner'])
      or (private.has_org_role(organisation_id, array['admin']) and role in ('reviewer', 'creator'))
    )
  );

drop policy if exists invitations_delete_admin on public.organisation_invitations;
create policy invitations_delete_admin on public.organisation_invitations
  for delete to authenticated
  using (
    private.has_org_role(organisation_id, array['owner'])
    or (private.has_org_role(organisation_id, array['admin']) and role in ('reviewer', 'creator'))
  );

-- ---------------------------------------------------------------------------
-- audit_logs: owners/admins can read; nobody can write through the Data API.
-- ---------------------------------------------------------------------------
drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using (private.has_org_role(organisation_id, array['owner', 'admin']));
