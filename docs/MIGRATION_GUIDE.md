# Migration guide

## Apply to a Supabase project (SQL Editor)

Use a **development** project first. Run each file **in order**, as the default `postgres`
role, pasting the whole file into *SQL Editor -> New query -> Run*:

1. `0001_enable_extensions.sql` (already applied if you ran Part 01)
2. `0002_core_tables.sql`
3. `0003_security_helpers.sql`
4. `0004_rls_policies.sql`
5. `0005_auth_profile_sync.sql`
6. `0006_organisation_functions.sql`

Each file stops with an error on failure; fix it before running the next. Files are written
to be re-runnable (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`), but
re-running does not alter columns of tables that already exist.

### Verify

```sql
-- every row must show rls_enabled = true
select relname, relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and relkind = 'r'
order by relname;

-- expect 11 policies, all for role {authenticated}
select tablename, policyname, roles from pg_policies where schemaname = 'public' order by 1, 2;

-- expect false for every row (anon must have no table access)
select t, has_table_privilege('anon', 'public.' || t, 'select') as anon_can_read
from unnest(array['organisations','profiles','organisation_memberships',
                  'organisation_invitations','audit_logs']) t;

-- sign-up trigger present
select tgname, tgenabled from pg_trigger where tgname = 'on_auth_user_created';
```
Also check *Database -> Advisors* for security warnings.

## Roll back

Reverse order, using `database/rollback/`. See `database/rollback/README.md`.
`0004_down.sql` removes policies but leaves RLS **on** (deny-all). `0002_down.sql` is
destructive and its statements are commented out by default. Take a backup first
(*Database -> Backups*, or `pg_dump`).

## Running the database integration tests

These tests need a **real PostgreSQL with the migrations applied**. They run each test in a
transaction that is rolled back, but they do insert into `auth.users`, so use a
**dedicated test database, never production**.

### Option A: local Docker (isolated)

```bash
docker run --name bg-test-db -e POSTGRES_PASSWORD=postgres -p 54329:5432 -d pgvector/pgvector:pg16
export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54329/postgres
export BRANDGUARD_TEST_DB_CONFIRM=this-is-a-test-database

psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/tests/local_supabase_shim.sql
for f in database/migrations/000*.sql; do psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done

cd backend && pip install -r requirements-dev.txt && pytest -v -rs
```
The shim creates only a stand-in `auth` schema, `auth.uid()` and the `anon`/`authenticated`/
`service_role` roles. **Never run it on a Supabase project.**

### Option B: a separate Supabase test project
Apply the migrations through the SQL Editor, take the database connection string from
*Project Settings -> Database*, and set the two environment variables above.

### Reading the results
- `tests/db/*` are the only tests that exercise RLS. If `TEST_DATABASE_URL` is unset they
  are reported as **skipped** (`pytest -rs` shows why). A skip is not a pass.
- `tests/test_migrations_static.py` only reads SQL text. `tests/test_organisation_models.py`
  is pure logic. `tests/test_organisation_access_mocked.py` uses a fake client. None of
  these prove RLS works.
