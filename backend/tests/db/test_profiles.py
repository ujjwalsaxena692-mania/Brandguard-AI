"""DATABASE INTEGRATION: profile creation on sign-up and profile RLS (real PostgreSQL)."""

from __future__ import annotations

import uuid

import pytest

pytestmark = pytest.mark.db_integration


def _profile(db, user):
    return db.one("select full_name, avatar_url from public.profiles where id = %s", (user,))


def test_signup_trigger_is_installed_and_enabled(db):
    assert db.scalar(
        "select tgenabled from pg_trigger where tgname = 'on_auth_user_created' and not tgisinternal"
    ) == "O"


def test_profile_is_created_with_metadata_name(db):
    user = db.create_user(full_name="  Ada Lovelace  ")
    assert _profile(db, user) == ("Ada Lovelace", None)


def test_profile_is_created_without_metadata(db):
    user = db.create_user()
    assert _profile(db, user) == (None, None)


def test_non_https_avatar_is_dropped_and_https_avatar_kept(db):
    bad = db.create_user(avatar_url="http://evil.example/a.png")
    good = db.create_user(avatar_url="https://cdn.example/a.png")
    assert _profile(db, bad)[1] is None
    assert _profile(db, good)[1] == "https://cdn.example/a.png"


def test_overlong_name_is_truncated_not_fatal(db):
    user = db.create_user(full_name="x" * 500)
    assert len(_profile(db, user)[0]) == 200


def test_profile_is_removed_when_auth_user_is_deleted(db):
    user = db.create_user()
    db.execute("delete from auth.users where id = %s", (user,))
    assert _profile(db, user) is None


def test_user_can_read_and_update_own_profile(db):
    user = db.create_user(full_name="Before")
    with db.as_user(user):
        assert db.scalar("select full_name from public.profiles where id = %s", (user,)) == "Before"
        cur = db.execute("update public.profiles set full_name = 'After' where id = %s", (user,))
        assert cur.rowcount == 1
    assert _profile(db, user)[0] == "After"


def test_user_cannot_update_or_read_a_strangers_profile(db):
    me, stranger = db.create_user(), db.create_user(full_name="Stranger")
    with db.as_user(me):
        assert db.scalar("select count(*) from public.profiles where id = %s", (stranger,)) == 0
        cur = db.execute("update public.profiles set full_name = 'Hacked' where id = %s", (stranger,))
        assert cur.rowcount == 0
    assert _profile(db, stranger)[0] == "Stranger"


def test_colleagues_can_read_each_others_profiles(db):
    a, b = db.create_user(full_name="A"), db.create_user(full_name="B")
    org = db.create_org(a)
    db.add_member(org, b, "creator")
    with db.as_user(b):
        assert db.scalar("select full_name from public.profiles where id = %s", (a,)) == "A"


def test_user_cannot_insert_a_profile_or_change_its_id(db):
    user = db.create_user()
    with db.as_user(user):
        with db.expect_db_error("42501"):
            db.execute("insert into public.profiles (id) values (%s)", (uuid.uuid4(),))
        with db.expect_db_error("42501"):
            db.execute("update public.profiles set id = %s where id = %s", (uuid.uuid4(), user))
