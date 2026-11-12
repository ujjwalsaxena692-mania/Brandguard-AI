# Security model (Part 02A)

## Principles

1. **Deny by default.** RLS is enabled on every table. Privileges are revoked from `anon`
   and `authenticated` first, then re-granted at the narrowest level (table, or individual
   columns). `anon` has no access to any table.
2. **Membership gates everything.** Access to organisation data requires an *active*
   membership, checked in the database, never from a client-supplied organisation id.
3. **Identity comes from the JWT.** Policies and functions use `auth.uid()`; no function
   takes a user id from the caller.
4. **Least privilege for elevated code.** `SECURITY DEFINER` is used only where RLS cannot
   express the rule, always with `set search_path = ''`, schema-qualified names, and
   `EXECUTE` revoked from `PUBLIC`/`anon`.
5. **The service-role key is server-only.** It bypasses RLS. It exists only in
   `backend/.env`, is never sent to the browser, and the frontend uses the publishable key.

## Row Level Security behaviour

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `organisations` | active members | via `create_organisation()` only | owner/admin, `name` only | none (backend only) |
| `profiles` | self + people sharing an organisation | trigger only | self, `full_name`/`avatar_url` | none (cascade) |
| `organisation_memberships` | own row + all members of own orgs | via functions only | owner (any), admin (reviewer/creator only); `role`,`status` only | self, owner, admin (reviewer/creator only) |
| `organisation_invitations` | owner/admin | owner (non-owner roles), admin (reviewer/creator) with `invited_by = auth.uid()` | none | owner, admin (reviewer/creator only) |
| `audit_logs` | owner/admin | none (backend only) | none | none |

Blocked reads return zero rows; blocked `UPDATE`/`DELETE` affect zero rows; blocked
`INSERT` and out-of-policy `UPDATE` values raise SQLSTATE `42501`.

### Avoiding recursive policies
A policy on `organisation_memberships` that queried `organisation_memberships` would
recurse. All policies call the `private.*` helpers, which are `SECURITY DEFINER`, read the
table as its owner, and RLS is **not forced**, so no policy re-enters itself. A static test
asserts policies never reference the membership table directly.

### Subtleties worth knowing
- `WITH CHECK` helper calls see the table as of the start of the statement, so an owner can
  demote themselves; the last-owner trigger is what prevents orphaned organisations.
- Colleagues' profiles are visible to *active* members only; a suspended member sees only
  their own profile.
- `create_organisation()` is callable by any signed-in user, so the backend should rate-limit it.

## Invitations
- Only the SHA-256 hash is stored (`invitation_token_hash`, format-checked).
- `accept_invitation(token)` hashes the supplied token, requires a **confirmed** email that
  matches the invitation, rejects used/expired/unknown tokens with one generic message
  (no probing), and logs an audit entry.
- Generate tokens with a CSPRNG (>= 128 bits) and hash them in the backend (Part 02B).

## Backend rules (service-role access)
`app/services/organisation_access.py` is the single entry point for privileged operations.

- `require_membership` / `require_permission` return a verified `Membership`; privileged
  operations take `organisation_id` and `actor_id` **from that object**, not from request data.
- "Not a member" and "not allowed" return the same message, so organisation existence is not revealed.
- Database errors are translated (`app/repositories/base.py`); raw messages are logged, never returned.
- `Settings` rejects a `sb_publishable_...` key placed in `SUPABASE_SERVICE_ROLE_KEY`.
- **Not done here:** the backend still has no way to know who the caller is. Verifying the user's
  JWT is Part 02B.

## Authentication guidance for Part 02B
Do not rely on a static `SUPABASE_JWT_SECRET`. Use a supported verification method for
your project's signing keys: verify tokens against the project's published JWKS
(asymmetric signing keys), or ask Supabase Auth to validate the token. Check `iss`, `aud`,
`exp`, and take `sub` as the user id.

## Known limitations
- Not executed against PostgreSQL in the build environment; run the integration tests
  (see [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)) before trusting any of the above.
- No rate limiting, email sending, or token generation yet (Part 02B).
- `GET /api/v1/system/integrations` requires a verified Supabase access token (ES256, verified against the project JWKS). It is not yet limited to org admins.
- Audit logging is explicit (RPCs and backend), not trigger-based; direct role changes via
  the Data API are not automatically audited.
- Hard-deleting an organisation (backend) also deletes its audit logs.
