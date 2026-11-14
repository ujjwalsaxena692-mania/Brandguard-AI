# Role permissions

Roles are stored in `organisation_memberships.role`. Only memberships with
`status = 'active'` grant any access. The same rules exist twice on purpose: the database
(RLS + triggers) is authoritative, and `backend/app/models/organisation.py` mirrors it so
backend code can refuse early and explain why.

Content-workflow permissions (submitting, reviewing, approving content) are **not defined
yet**; they arrive with those features. Today `reviewer` and `creator` differ from each
other only in label.

Submissions add three: `submissions:create` (owner, admin, creator; reviewers cannot submit), `submissions:view_all`
(owner, admin, reviewer; creators see only their own) and `submissions:manage_all` (owner, admin; act on other
members' submissions). Authors can always change their own drafts. Ownership is enforced by the API (a submission
you may not see is a 404); the database mirrors the read rule with RLS.

The Knowledge Hub adds two permissions: `knowledge:view` (every role) and `knowledge:manage`
(owners and admins). The API enforces them; the database only lets members `SELECT` documents.

## Matrix (organisation administration)

| Capability | owner | admin | reviewer | creator |
| --- | :-: | :-: | :-: | :-: |
| See their organisation and its members | yes | yes | yes | yes |
| See colleagues' profiles | yes | yes | yes | yes |
| Rename the organisation | yes | yes | no | no |
| Change the slug / delete the organisation | backend only | backend only | no | no |
| Read invitations | yes | yes | no | no |
| Invite `admin` | yes | **no** | no | no |
| Invite `reviewer` / `creator` | yes | yes | no | no |
| Invite `owner` | **never** (not allowed by invitation) | no | no | no |
| Change a member's role | any member, any role | reviewer <-> creator only | no | no |
| Modify an owner or another admin | yes | **no** | no | no |
| Remove a member | any member | reviewers/creators only | no | no |
| Leave the organisation | yes* | yes | yes | yes |
| Read audit logs | yes | yes | no | no |
| Write audit logs | backend only | backend only | no | no |
| Read Knowledge Hub documents | yes | yes | yes | yes |
| Upload / delete Knowledge Hub documents | yes | yes | no | no |
| Create and submit content | yes | yes | no | yes (own) |
| See all submissions in the organisation | yes | yes | yes | own only |
| Change or cancel others' submissions | yes | yes | no | no |

\* The last active owner cannot leave, be demoted or be suspended.

## Non-obvious rules

- **No privilege escalation by admins.** An admin can never create an owner or another
  admin, never edit their own row, and never touch owners/admins.
- **Memberships are created only by the database functions.** `create_organisation()`
  (creator becomes owner) and `accept_invitation()`. There is no client `INSERT` on
  memberships, so nobody can add themselves or others to an organisation.
- **Invitations only work for the invited, confirmed email.** The accepting user's
  confirmed `auth.users.email` must equal the invited address.
- **Accepting never changes an existing membership.** A suspended member cannot reactivate
  or upgrade themselves with an invitation.
- **Suspended = no access** to organisation data (they can still see their own membership row).
- **Ownership transfer:** an owner promotes another member to `owner`, then may step down.

## Where each rule lives

| Rule | Enforced by |
| --- | --- |
| Valid role/status values | CHECK constraints (0002) |
| Who may read/update/delete what | RLS policies (0004) |
| Which columns clients may touch | Column-level grants (0004) |
| At least one owner; identity columns immutable | Trigger (0003) |
| Create org / accept invitation | SECURITY DEFINER functions (0006) |
| Same rules in Python | `app/models/organisation.py` |
| Active membership + role for each API request | `get_organisation_context` / `require_permission` in `app/api/deps.py` (looks the caller up by verified user id; `X-Organisation-Id` only selects among their own memberships) |
