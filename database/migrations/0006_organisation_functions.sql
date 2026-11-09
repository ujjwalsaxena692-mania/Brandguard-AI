-- 0006: the two operations that RLS alone cannot express safely
-- Requires: 0002-0005.
--
--   create_organisation(name, slug)  creates the organisation, its first owner
--                                    membership and an audit entry atomically.
--   accept_invitation(token)         lets an invited, email-confirmed user join. The invitee
--                                    is not yet a member so cannot read the invitation via RLS.
--
-- Both are SECURITY DEFINER with fixed search_path, derive identity from auth.uid(),
-- and are executable by `authenticated` only (not anon, not PUBLIC).

create or replace function public.create_organisation(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_org  uuid;
  v_slug text := lower(btrim(p_slug));
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  insert into public.organisations (name, slug, created_by)
  values (btrim(p_name), v_slug, v_uid)
  returning id into v_org;

  insert into public.organisation_memberships (organisation_id, user_id, role, status)
  values (v_org, v_uid, 'owner', 'active');

  insert into public.audit_logs (organisation_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_org, v_uid, 'organisation.created', 'organisation', v_org,
          jsonb_build_object('slug', v_slug));

  return v_org;
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_email     text;
  v_confirmed timestamptz;
  v_hash      text;
  v_inv       public.organisation_invitations%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select lower(u.email), u.email_confirmed_at
    into v_email, v_confirmed
  from auth.users u
  where u.id = v_uid;

  if v_email is null or v_confirmed is null then
    raise exception 'A confirmed email address is required to accept an invitation'
      using errcode = '42501';
  end if;

  v_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  select * into v_inv
  from public.organisation_invitations i
  where i.invitation_token_hash = v_hash
  for update;

  -- One generic message for every failure mode so tokens cannot be probed.
  if not found
     or v_inv.accepted_at is not null
     or v_inv.expires_at <= now()
     or v_inv.email <> v_email then
    raise exception 'Invitation is invalid or has expired' using errcode = 'P0001';
  end if;

  -- An existing membership (including a suspended one) is never changed by an invitation.
  insert into public.organisation_memberships (organisation_id, user_id, role, status)
  values (v_inv.organisation_id, v_uid, v_inv.role, 'active')
  on conflict (organisation_id, user_id) do nothing;

  update public.organisation_invitations
  set accepted_at = now()
  where id = v_inv.id;

  insert into public.audit_logs (organisation_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_inv.organisation_id, v_uid, 'invitation.accepted', 'invitation', v_inv.id,
          jsonb_build_object('role', v_inv.role));

  return v_inv.organisation_id;
end;
$$;

revoke all on function public.create_organisation(text, text) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.create_organisation(text, text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
