"""STATIC checks of the SQL files. These read text only - NO database is contacted.

They catch structural mistakes (a table without RLS, a SECURITY DEFINER function without a
pinned search_path, secrets in templates). They do NOT prove that any RLS policy behaves
correctly; that is what tests/db/ is for, and it needs a real PostgreSQL.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = ROOT / "database" / "migrations"
ROLLBACK_DIR = ROOT / "database" / "rollback"


def _strip_comments(sql: str) -> str:
    return re.sub(r"--[^\n]*", "", sql)


def _migrations() -> dict[str, str]:
    files = sorted(MIGRATIONS_DIR.glob("[0-9][0-9][0-9][0-9]_*.sql"))
    return {f.name: _strip_comments(f.read_text(encoding="utf-8")) for f in files}


def _all_sql() -> str:
    return "\n".join(_migrations().values())


def test_migrations_are_numbered_sequentially_without_gaps():
    numbers = [int(name[:4]) for name in _migrations()]
    assert numbers == list(range(1, len(numbers) + 1)), numbers
    assert len(numbers) >= 6


def test_every_public_table_has_rls_enabled():
    sql = _all_sql()
    tables = re.findall(r"create table if not exists public\.(\w+)", sql, flags=re.I)
    assert set(tables) == {
        "organisations",
        "profiles",
        "organisation_memberships",
        "organisation_invitations",
        "audit_logs",
    }
    for table in tables:
        pattern = rf"alter table public\.{table}\s+enable row level security"
        assert re.search(pattern, sql, flags=re.I), f"RLS not enabled for {table}"


def _function_chunks(sql: str) -> list[str]:
    return [c for c in re.split(r"(?=create or replace function)", sql, flags=re.I) if c.strip()]


def test_every_security_definer_function_pins_search_path():
    found = 0
    for chunk in _function_chunks(_all_sql()):
        if "security definer" in chunk.lower():
            found += 1
            header = chunk.lower().split("$$")[0]
            assert "set search_path" in header, chunk[:120]
    assert found >= 6


def test_every_security_definer_function_revokes_public_execute():
    sql = _all_sql()
    for chunk in _function_chunks(sql):
        if "security definer" not in chunk.lower():
            continue
        name = re.search(r"create or replace function\s+([\w.]+)\(", chunk, flags=re.I).group(1)
        revoke = rf"revoke all on function {re.escape(name)}\(.*?\) from [^;]*public"
        assert re.search(revoke, sql, flags=re.I | re.S), f"{name} still executable by PUBLIC"


def test_security_definer_helpers_live_in_non_exposed_schema_or_are_whitelisted():
    # Only these two are meant to be callable through the Data API as RPCs.
    allowed_public = {"public.create_organisation", "public.accept_invitation"}
    for chunk in _function_chunks(_all_sql()):
        if "security definer" not in chunk.lower():
            continue
        name = re.search(r"create or replace function\s+([\w.]+)\(", chunk, flags=re.I).group(1)
        assert name.startswith("private.") or name in allowed_public, name


def test_policies_target_authenticated_only_and_are_never_open():
    sql = _migrations()["0004_rls_policies.sql"]
    policies = re.findall(r"create policy .*?;", sql, flags=re.I | re.S)
    assert len(policies) == 11
    for policy in policies:
        assert re.search(r"to authenticated", policy, flags=re.I), policy[:80]
        assert not re.search(r"(using|with check)\s*\(\s*true\s*\)", policy, flags=re.I)


def test_policies_do_not_query_the_membership_table_directly():
    # Recursion guard: policies must go through the SECURITY DEFINER helpers.
    sql = _migrations()["0004_rls_policies.sql"]
    for policy in re.findall(r"create policy .*?;", sql, flags=re.I | re.S):
        assert "from public.organisation_memberships" not in policy.lower()


def test_no_plaintext_invitation_token_or_password_columns():
    sql = _migrations()["0002_core_tables.sql"].lower()
    assert "invitation_token_hash" in sql
    assert not re.search(r"\binvitation_token\b(?!_hash)", sql)
    assert "password" not in sql


def test_clients_cannot_write_audit_logs_or_insert_memberships():
    sql = _migrations()["0004_rls_policies.sql"].lower()
    assert not re.search(r"grant\s+(insert|update|delete)[^;]*public\.audit_logs", sql)
    assert not re.search(r"grant\s+insert\s+on public\.organisation_memberships", sql)


def test_each_schema_migration_has_a_rollback_script():
    for number in range(2, 7):
        assert list(ROLLBACK_DIR.glob(f"{number:04d}_down.sql")), number


def test_no_secrets_in_templates_docs_sql_or_source():
    patterns = [
        re.compile(r"sb_secret_[A-Za-z0-9_-]{16,}"),
        re.compile(r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
        re.compile(r"sk-ant-[A-Za-z0-9_-]{16,}"),
    ]
    skip_dirs = {".venv", "node_modules", ".git", "dist", "__pycache__", ".pytest_cache"}
    suffixes = {".example", ".md", ".sql", ".py", ".ts", ".tsx", ".toml", ".json", ".yml"}
    offenders: list[str] = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or any(part in skip_dirs for part in path.parts):
            continue
        if path.suffix not in suffixes:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        if any(p.search(text) for p in patterns):
            offenders.append(str(path.relative_to(ROOT)))
    assert not offenders, f"secret-looking values found in: {offenders}"
