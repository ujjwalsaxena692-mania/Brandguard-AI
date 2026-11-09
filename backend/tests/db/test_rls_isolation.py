"""DATABASE INTEGRATION: cross-organisation isolation under Row Level Security (real PostgreSQL).

Each statement runs as the `authenticated` (or `anon`) role with a JWT subject, so RLS applies.
Blocked reads return zero rows; blocked UPDATE/DELETE affect zero rows; blocked INSERT raises.
"""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.db_integration


def test_outsider_sees_only_their_own_organisation(db, two_orgs):
    with db.as_user(two_orgs["b_owner"]):
        ids = {r[0] for r in db.rows("select id from public.organisations")}
    assert ids == {two_orgs["org_b"]}


def test_outsider_cannot_read_other_organisations_records(db, two_orgs):
    org_a = two_orgs["org_a"]
    with db.as_user(two_orgs["b_owner"]):
        for table in ("organisation_memberships", "organisation_invitations", "audit_logs"):
            count = db.scalar(f"select count(*) from public.{table} where organisation_id = %s", (org_a,))
            assert count == 0, table
        assert db.scalar("select count(*) from public.organisations where id = %s", (org_a,)) == 0


def test_outsider_cannot_read_profiles_of_another_organisations_members(db, two_orgs):
    with db.as_user(two_orgs["b_owner"]):
        assert db.scalar("select count(*) from public.profiles where id = %s", (two_orgs["a_owner"],)) == 0


def test_members_can_read_their_organisation_and_its_members(db, two_orgs):
    for role in ("a_owner", "a_admin", "a_reviewer", "a_creator"):
        with db.as_user(two_orgs[role]):
            assert db.scalar("select count(*) from public.organisations where id = %s", (two_orgs["org_a"],)) == 1
            assert db.scalar(
                "select count(*) from public.organisation_memberships where organisation_id = %s",
                (two_orgs["org_a"],),
            ) == 4


def test_only_owners_and_admins_can_read_invitations_and_audit_logs(db, two_orgs):
    for role, expected in (("a_owner", 1), ("a_admin", 1), ("a_reviewer", 0), ("a_creator", 0)):
        with db.as_user(two_orgs[role]):
            assert db.scalar("select count(*) from public.organisation_invitations") == expected, role
            assert db.scalar("select count(*) from public.audit_logs") == expected, role


def test_anon_cannot_read_anything(db, two_orgs):
    with db.as_anon():
        for table in ("organisations", "profiles", "organisation_memberships", "organisation_invitations", "audit_logs"):
            with db.expect_db_error("42501"):
                db.execute(f"select * from public.{table}")


def test_outsider_cannot_modify_other_organisations_records(db, two_orgs):
    org_a = two_orgs["org_a"]
    with db.as_user(two_orgs["b_owner"]):
        assert db.execute("update public.organisations set name = 'Pwned' where id = %s", (org_a,)).rowcount == 0
        assert db.execute(
            "delete from public.organisation_memberships where organisation_id = %s", (org_a,)
        ).rowcount == 0
        assert db.execute(
            "update public.organisation_memberships set role = 'owner' where organisation_id = %s", (org_a,)
        ).rowcount == 0
        assert db.execute(
            "delete from public.organisation_invitations where organisation_id = %s", (org_a,)
        ).rowcount == 0
    assert db.scalar("select name from public.organisations where id = %s", (org_a,)) == "Org A"
    assert db.scalar("select count(*) from public.organisation_memberships where organisation_id = %s", (org_a,)) == 4


def test_frontend_supplied_organisation_id_is_not_trusted_on_insert(db, two_orgs):
    # b_owner is an owner of B only; supplying A's id must fail the RLS WITH CHECK.
    with db.as_user(two_orgs["b_owner"]):
        with db.expect_db_error("42501"):
            db.execute(
                "insert into public.organisation_invitations "
                "(organisation_id, email, role, invitation_token_hash, invited_by) values (%s, %s, 'creator', %s, %s)",
                (two_orgs["org_a"], "x@example.test", "9" * 64, two_orgs["b_owner"]),
            )


def test_creator_and_reviewer_cannot_rename_the_organisation(db, two_orgs):
    for role in ("a_creator", "a_reviewer"):
        with db.as_user(two_orgs[role]):
            cur = db.execute("update public.organisations set name = 'Renamed' where id = %s", (two_orgs["org_a"],))
            assert cur.rowcount == 0, role
    assert db.scalar("select name from public.organisations where id = %s", (two_orgs["org_a"],)) == "Org A"


def test_admin_and_owner_can_rename_the_organisation(db, two_orgs):
    for role in ("a_admin", "a_owner"):
        with db.as_user(two_orgs[role]):
            cur = db.execute("update public.organisations set name = %s where id = %s", (role, two_orgs["org_a"]))
            assert cur.rowcount == 1, role


def test_nobody_can_change_an_organisation_slug_or_delete_it_from_the_client(db, two_orgs):
    with db.as_user(two_orgs["a_owner"]):
        with db.expect_db_error("42501"):
            db.execute("update public.organisations set slug = 'hijack' where id = %s", (two_orgs["org_a"],))
        with db.expect_db_error("42501"):
            db.execute("delete from public.organisations where id = %s", (two_orgs["org_a"],))


def test_clients_cannot_write_audit_logs_even_as_owner(db, two_orgs):
    with db.as_user(two_orgs["a_owner"]):
        with db.expect_db_error("42501"):
            db.execute(
                "insert into public.audit_logs (organisation_id, action, entity_type) values (%s, 'x', 'y')",
                (two_orgs["org_a"],),
            )
        with db.expect_db_error("42501"):
            db.execute("delete from public.audit_logs")


def test_helper_functions_reflect_the_callers_membership(db, two_orgs):
    with db.as_user(two_orgs["b_owner"]):
        assert db.scalar("select private.is_org_member(%s)", (two_orgs["org_a"],)) is False
        assert db.scalar("select private.is_org_member(%s)", (two_orgs["org_b"],)) is True
        assert db.scalar("select private.current_org_role(%s)", (two_orgs["org_a"],)) is None
    with db.as_user(two_orgs["a_reviewer"]):
        assert db.scalar("select private.current_org_role(%s)", (two_orgs["org_a"],)) == "reviewer"


def test_suspended_member_loses_organisation_access(db, two_orgs):
    db.execute(
        "update public.organisation_memberships set status = 'suspended' where user_id = %s",
        (two_orgs["a_creator"],),
    )
    with db.as_user(two_orgs["a_creator"]):
        assert db.scalar("select count(*) from public.organisations where id = %s", (two_orgs["org_a"],)) == 0
        assert db.scalar(
            "select count(*) from public.organisation_memberships where organisation_id = %s", (two_orgs["org_a"],)
        ) == 1  # only their own row remains visible
