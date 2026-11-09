# Database schema (Part 02A)

PostgreSQL on Supabase. Migrations live in `database/migrations/` and are applied in
order (see [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)). All timestamps are `timestamptz`,
all primary keys are UUIDs (`gen_random_uuid()`), and every table has Row Level Security
enabled (see [SECURITY_MODEL.md](SECURITY_MODEL.md)).

| Migration | Contents |
| --- | --- |
| `0001_enable_extensions.sql` | `vector` (pgvector) in schema `extensions` |
| `0002_core_tables.sql` | Five tables, indexes, `updated_at` triggers |
| `0003_security_helpers.sql` | `private.*` RLS helper functions, membership integrity trigger |
| `0004_rls_policies.sql` | Privilege revocations/grants and all RLS policies |
| `0005_auth_profile_sync.sql` | Profile-on-signup trigger and backfill |
| `0006_organisation_functions.sql` | `create_organisation()` and `accept_invitation()` |

## Relationships

```
auth.users 1---1 profiles                       (profiles.id -> auth.users.id, cascade)
auth.users 1---* organisation_memberships *---1 organisations
organisations 1---* organisation_invitations
organisations 1---* audit_logs                  (actor_id -> auth.users, set null)
organisations.created_by -> auth.users          (set null)
```

A user can belong to several organisations (one membership per organisation).

## Tables

### `organisations`
A tenant. Purpose: the boundary every organisation-specific record will hang off.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `name` | text | not null, 1-120 chars after trimming |
| `slug` | text | not null, unique, 3-63 chars, `^[a-z0-9]+(-[a-z0-9]+)*$` |
| `created_by` | uuid | FK `auth.users`, `on delete set null` |
| `created_at`, `updated_at` | timestamptz | `updated_at` maintained by trigger |

Indexes: PK, unique `slug`, `created_by`.

### `profiles`
Display data for an auth user. **No credentials are stored here**; `auth.users` stays the
identity source.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | FK `auth.users(id)`, `on delete cascade` |
| `full_name` | text | nullable, max 200 |
| `avatar_url` | text | nullable, must start with `https://`, max 2048 |
| `created_at`, `updated_at` | timestamptz | `updated_at` maintained by trigger |

### `organisation_memberships`
Who belongs to which organisation, and with what role.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `organisation_id` | uuid | FK `organisations`, `on delete cascade` |
| `user_id` | uuid | FK `auth.users`, `on delete cascade` |
| `role` | text | check: `owner`, `admin`, `reviewer`, `creator` |
| `status` | text | check: `active`, `suspended` (default `active`) |
| `joined_at`, `created_at` | timestamptz | |

Constraints: `unique (organisation_id, user_id)`. Index on `user_id`.
A *removed* member is a deleted row; `suspended` keeps the row but grants no access.
Trigger `organisation_memberships_guard` (before update/delete):

- `organisation_id` and `user_id` can never change;
- an organisation always keeps at least one **active owner** (demoting, suspending or
  removing the last one raises SQLSTATE `23514`). Deleting the organisation itself is not
  blocked. Deleting an auth user who is the sole owner of an organisation is blocked until
  ownership is transferred.

### `organisation_invitations`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `organisation_id` | uuid | FK, cascade |
| `email` | text | must already be lower-case and trimmed |
| `role` | text | check: `admin`, `reviewer`, `creator` (**never `owner`**) |
| `invitation_token_hash` | text | unique, must match `^[0-9a-f]{64}$` (SHA-256 hex) |
| `invited_by` | uuid | FK `auth.users`, `on delete set null` |
| `expires_at` | timestamptz | default now()+7 days; must be after creation and within 30 days |
| `accepted_at` | timestamptz | set only by `accept_invitation()` |
| `created_at` | timestamptz | |

Unique partial index: one **pending** invitation per `(organisation_id, email)`. An expired
but unaccepted invitation still occupies that slot until it is deleted.
The plaintext token is never stored. The format constraint rejects typical plaintext
tokens, but it cannot distinguish a 64-hex plaintext from a hash, so hash in the backend.

### `audit_logs`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `organisation_id` | uuid | FK, cascade |
| `actor_id` | uuid | FK `auth.users`, `on delete set null` |
| `action` | text | 1-100 chars, e.g. `organisation.created` |
| `entity_type` | text | 1-100 chars |
| `entity_id` | uuid | nullable |
| `metadata` | jsonb | must be a JSON object, default `{}` |
| `created_at` | timestamptz | |

Indexes: `(organisation_id, created_at desc)`, `actor_id`, `(entity_type, entity_id)`.
Append-only is enforced by privileges: clients have `SELECT` only. Deleting an
organisation cascades to its audit logs.

## Functions

| Function | Schema | Security | Purpose |
| --- | --- | --- | --- |
| `set_updated_at()` | private | invoker | trigger: refreshes `updated_at` |
| `current_org_role(org)`, `is_org_member(org)`, `has_org_role(org, roles[])`, `shares_organisation_with(user)` | private | definer | RLS helpers; identity from `auth.uid()` |
| `guard_membership_changes()` | private | invoker | membership integrity trigger |
| `handle_new_user()` | private | definer | creates the profile on sign-up |
| `create_organisation(name, slug)` | public (RPC) | definer | creates org + owner membership + audit row atomically |
| `accept_invitation(token)` | public (RPC) | definer | hashes the token, checks email/expiry, creates membership |

`private` is not exposed through the Supabase Data API.

## Sign-up behaviour

`on_auth_user_created` (after insert on `auth.users`) inserts a profile using
`raw_user_meta_data.full_name` (trimmed, max 200) and `avatar_url` (only if `https://`).
`on conflict do nothing` makes it idempotent. If it fails it logs a warning and **does not
block sign-up**; a missing profile can be recreated by the backend or by re-running the
backfill at the end of `0005`.
