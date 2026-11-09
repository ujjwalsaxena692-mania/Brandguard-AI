"""DATABASE INTEGRATION: role rules, ownership safety, invitations (real PostgreSQL, RLS on)."""

from __future__ import annotations

import hashlib
import uuid

import pytest

pytestmark = pytest.mark.db_integration


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _role(db, org, user):
    return db.scalar(
        "select role from public.organisation_memberships where organisation_id = %s and user_id = %s", (org, user)
    )


def _update_role(db, org, user, role):
    return db.execute(
        "update public.organisation_memberships set role = %s where organisation_id = %s and user_id = %s",
        (role, org, user),
    )


# --- create_organisation -----------------------------------------------------
def test_create_organisation_makes_caller_the_owner_and_writes_audit(db):
    user = db.create_user()
    slug = f"acme-{uuid.uuid4().hex[:8]}"
    with db.as_user(user):
        org = db.scalar("select public.create_organisation(%s, %s)", ("  Acme  ", slug.upper()))
        assert db.scalar("select private.current_org_role(%s)", (org,)) == "owner"
        assert db.scalar("select slug from public.organisations where id = %s", (org,)) == slug
        assert db.scalar("select name from public.organisations where id = %s", (org,)) == "Acme"
        assert db.scalar("select count(*) from public.audit_logs where organisation_id = %s", (org,)) == 1


def test_create_organisation_rejects_duplicates_bad_slugs_and_anonymous_callers(db):
    user = db.create_user()
    slug = f"dup-{uuid.uuid4().hex[:8]}"
    with db.as_user(user):
        db.execute("select public.create_organisation('One', %s)", (slug,))
        with db.expect_db_error("23505"):
            db.execute("select public.create_organisation('Two', %s)", (slug,))
        with db.expect_db_error("23514"):
            db.execute("select public.create_organisation('Three', 'not a slug!')")
    with db.as_anon():
        with db.expect_db_error("42501"):
            db.execute("select public.create_organisation('Anon', 'anon-org')")


# --- membership changes --------------------------------------------------------
def test_admin_cannot_escalate_anyone_to_owner_or_admin(db, two_orgs):
    with db.as_user(two_orgs["a_admin"]):
        for target in ("owner", "admin"):
            with db.expect_db_error("42501"):
                _update_role(db, two_orgs["org_a"], two_orgs["a_reviewer"], target)
    assert _role(db, two_orgs["org_a"], two_orgs["a_reviewer"]) == "reviewer"


def test_admin_can_move_members_between_reviewer_and_creator(db, two_orgs):
    with db.as_user(two_orgs["a_admin"]):
        assert _update_role(db, two_orgs["org_a"], two_orgs["a_creator"], "reviewer").rowcount == 1


def test_admin_cannot_modify_owners_admins_or_themselves(db, two_orgs):
    with db.as_user(two_orgs["a_admin"]):
        assert _update_role(db, two_orgs["org_a"], two_orgs["a_owner"], "creator").rowcount == 0
        assert _update_role(db, two_orgs["org_a"], two_orgs["a_admin"], "owner").rowcount == 0
    assert _role(db, two_orgs["org_a"], two_orgs["a_owner"]) == "owner"
    assert _role(db, two_orgs["org_a"], two_orgs["a_admin"]) == "admin"


def test_creators_and_reviewers_cannot_change_any_role_including_their_own(db, two_orgs):
    for actor in ("a_creator", "a_reviewer"):
        with db.as_user(two_orgs[actor]):
            assert _update_role(db, two_orgs["org_a"], two_orgs[actor], "owner").rowcount == 0, actor
            assert _update_role(db, two_orgs["org_a"], two_orgs["a_admin"], "creator").rowcount == 0, actor


def test_owner_can_promote_to_admin_and_owner(db, two_orgs):
    with db.as_user(two_orgs["a_owner"]):
        assert _update_role(db, two_orgs["org_a"], two_orgs["a_creator"], "admin").rowcount == 1
        assert _update_role(db, two_orgs["org_a"], two_orgs["a_reviewer"], "owner").rowcount == 1


def test_membership_identity_columns_cannot_be_changed(db, two_orgs):
    with db.as_user(two_orgs["a_owner"]):
        with db.expect_db_error("42501"):
            db.execute(
                "update public.organisation_memberships set user_id = %s where user_id = %s",
                (two_orgs["b_owner"], two_orgs["a_creator"]),
            )
        with db.expect_db_error("42501"):
            db.execute(
                "update public.organisation_memberships set organisation_id = %s where user_id = %s",
                (two_orgs["org_b"], two_orgs["a_creator"]),
            )


def test_clients_cannot_insert_memberships_directly(db, two_orgs):
    with db.as_user(two_orgs["b_owner"]):
        with db.expect_db_error("42501"):
            db.execute(
                "insert into public.organisation_memberships (organisation_id, user_id, role) values (%s, %s, 'owner')",
                (two_orgs["org_a"], two_orgs["b_owner"]),
            )


# --- last owner protection -----------------------------------------------------
def test_last_owner_cannot_demote_suspend_or_leave(db, two_orgs):
    org, owner = two_orgs["org_a"], two_orgs["a_owner"]
    with db.as_user(owner):
        with db.expect_db_error("23514"):
            _update_role(db, org, owner, "admin")
        with db.expect_db_error("23514"):
            db.execute(
                "update public.organisation_memberships set status = 'suspended' where user_id = %s", (owner,)
            )
        with db.expect_db_error("23514"):
            db.execute("delete from public.organisation_memberships where user_id = %s", (owner,))


def test_owner_can_step_down_once_another_owner_exists(db, two_orgs):
    org = two_orgs["org_a"]
    with db.as_user(two_orgs["a_owner"]):
        assert _update_role(db, org, two_orgs["a_admin"], "owner").rowcount == 1
        assert _update_role(db, org, two_orgs["a_owner"], "admin").rowcount == 1


def test_deleting_an_organisation_is_not_blocked_by_the_last_owner_rule(db, two_orgs):
    db.execute("delete from public.organisations where id = %s", (two_orgs["org_b"],))
    assert db.scalar("select count(*) from public.organisation_memberships where organisation_id = %s", (two_orgs["org_b"],)) == 0


# --- leaving / removing ----------------------------------------------------------
def test_member_can_leave_and_admin_can_remove_lower_roles_only(db, two_orgs):
    org = two_orgs["org_a"]
    with db.as_user(two_orgs["a_admin"]):
        assert db.execute(
            "delete from public.organisation_memberships where user_id = %s", (two_orgs["a_owner"],)
        ).rowcount == 0
        assert db.execute(
            "delete from public.organisation_memberships where user_id = %s", (two_orgs["a_creator"],)
        ).rowcount == 1
    with db.as_user(two_orgs["a_reviewer"]):
        assert db.execute(
            "delete from public.organisation_memberships where user_id = %s", (two_orgs["a_reviewer"],)
        ).rowcount == 1
    assert db.scalar("select count(*) from public.organisation_memberships where organisation_id = %s", (org,)) == 2


# --- invitations ---------------------------------------------------------------------
def _invite(db, org, inviter, email, role, token):
    return db.execute(
        "insert into public.organisation_invitations "
        "(organisation_id, email, role, invitation_token_hash, invited_by) values (%s, %s, %s, %s, %s)",
        (org, email, role, _hash(token), inviter),
    )


def test_creators_and_reviewers_cannot_create_invitations(db, two_orgs):
    for actor in ("a_creator", "a_reviewer"):
        with db.as_user(two_orgs[actor]):
            with db.expect_db_error("42501"):
                _invite(db, two_orgs["org_a"], two_orgs[actor], f"{actor}@example.test", "creator", actor)


def test_admin_can_invite_low_roles_but_not_admins_and_cannot_forge_invited_by(db, two_orgs):
    org, admin = two_orgs["org_a"], two_orgs["a_admin"]
    with db.as_user(admin):
        assert _invite(db, org, admin, "new1@example.test", "reviewer", "t1").rowcount == 1
        with db.expect_db_error("42501"):
            _invite(db, org, admin, "new2@example.test", "admin", "t2")
        with db.expect_db_error("42501"):
            _invite(db, org, two_orgs["a_owner"], "new3@example.test", "creator", "t3")


def test_owner_can_invite_admin_but_never_owner(db, two_orgs):
    org, owner = two_orgs["org_a"], two_orgs["a_owner"]
    with db.as_user(owner):
        assert _invite(db, org, owner, "adm@example.test", "admin", "t4").rowcount == 1
        with db.expect_db_error("23514"):
            _invite(db, org, owner, "own@example.test", "owner", "t5")


def test_clients_cannot_set_accepted_at_on_insert_or_update(db, two_orgs):
    owner = two_orgs["a_owner"]
    with db.as_user(owner):
        with db.expect_db_error("42501"):
            db.execute(
                "insert into public.organisation_invitations "
                "(organisation_id, email, role, invitation_token_hash, invited_by, accepted_at) "
                "values (%s, 'z@example.test', 'creator', %s, %s, now())",
                (two_orgs["org_a"], _hash("z"), owner),
            )
        with db.expect_db_error("42501"):
            db.execute("update public.organisation_invitations set role = 'admin'")


def test_accept_invitation_joins_with_invited_role_and_cannot_be_reused(db, two_orgs):
    invitee = db.create_user()
    email = db.scalar("select email from auth.users where id = %s", (invitee,))
    token = uuid.uuid4().hex
    db.create_invitation(two_orgs["org_a"], email, "reviewer", _hash(token), two_orgs["a_owner"])
    with db.as_user(invitee):
        assert db.scalar("select public.accept_invitation(%s)", (token,)) == two_orgs["org_a"]
        assert db.scalar("select private.current_org_role(%s)", (two_orgs["org_a"],)) == "reviewer"
        with db.expect_db_error("P0001"):
            db.execute("select public.accept_invitation(%s)", (token,))
    assert db.scalar("select count(*) from public.organisation_invitations where accepted_at is not null") == 1
    assert db.scalar("select count(*) from public.audit_logs where action = 'invitation.accepted'") == 1


def test_accept_invitation_fails_for_wrong_email_unknown_token_and_expired_invitation(db, two_orgs):
    right_user = db.create_user()
    right_email = db.scalar("select email from auth.users where id = %s", (right_user,))
    wrong_user = db.create_user()
    db.create_invitation(two_orgs["org_a"], right_email, "creator", _hash("good"), two_orgs["a_owner"])
    with db.as_user(wrong_user):
        with db.expect_db_error("P0001"):
            db.execute("select public.accept_invitation('good')")
        with db.expect_db_error("P0001"):
            db.execute("select public.accept_invitation('never-issued')")
    expired_user = db.create_user()
    expired_email = db.scalar("select email from auth.users where id = %s", (expired_user,))
    db.create_invitation(
        two_orgs["org_a"], expired_email, "creator", _hash("old"), two_orgs["a_owner"], expired=True
    )
    with db.as_user(expired_user):
        with db.expect_db_error("P0001"):
            db.execute("select public.accept_invitation('old')")
    assert db.scalar("select count(*) from public.organisation_memberships where user_id = any(%s)", ([wrong_user, expired_user],)) == 0


def test_accept_invitation_requires_confirmed_email_and_authentication(db, two_orgs):
    user = db.create_user(confirmed=False)
    email = db.scalar("select email from auth.users where id = %s", (user,))
    db.create_invitation(two_orgs["org_a"], email, "creator", _hash("unconfirmed"), two_orgs["a_owner"])
    with db.as_user(user):
        with db.expect_db_error("42501"):
            db.execute("select public.accept_invitation('unconfirmed')")
    with db.as_anon():
        with db.expect_db_error("42501"):
            db.execute("select public.accept_invitation('unconfirmed')")


def test_accepting_an_invitation_does_not_reactivate_a_suspended_member(db, two_orgs):
    user = db.create_user()
    email = db.scalar("select email from auth.users where id = %s", (user,))
    db.add_member(two_orgs["org_a"], user, "creator", status="suspended")
    db.create_invitation(two_orgs["org_a"], email, "admin", _hash("sneaky"), two_orgs["a_owner"])
    with db.as_user(user):
        db.execute("select public.accept_invitation('sneaky')")
    assert db.one(
        "select role, status from public.organisation_memberships where user_id = %s", (user,)
    ) == ("creator", "suspended")
