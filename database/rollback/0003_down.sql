-- Requires 0004_down.sql to have been applied first (policies depend on these functions).
drop trigger if exists organisation_memberships_guard on public.organisation_memberships;
drop function if exists private.guard_membership_changes();
drop function if exists private.shares_organisation_with(uuid);
drop function if exists private.has_org_role(uuid, text[]);
drop function if exists private.is_org_member(uuid);
drop function if exists private.current_org_role(uuid);
