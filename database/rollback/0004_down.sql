-- Removes policies only. RLS stays enabled, so the tables become inaccessible to clients
-- (service role is unaffected). Table privileges stay revoked.
drop policy if exists organisations_select_member on public.organisations;
drop policy if exists organisations_update_admin on public.organisations;
drop policy if exists profiles_select_self_or_colleague on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists memberships_select on public.organisation_memberships;
drop policy if exists memberships_update on public.organisation_memberships;
drop policy if exists memberships_delete on public.organisation_memberships;
drop policy if exists invitations_select_admin on public.organisation_invitations;
drop policy if exists invitations_insert_admin on public.organisation_invitations;
drop policy if exists invitations_delete_admin on public.organisation_invitations;
drop policy if exists audit_logs_select_admin on public.audit_logs;
