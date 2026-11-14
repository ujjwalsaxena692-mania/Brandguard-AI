# API

Base URL (local): `http://localhost:8000`. Interactive docs at `/docs` (disabled when `APP_ENV=production`).

## Conventions

- JSON in and out.
- Every response carries an `X-Request-ID` header (a safe client-supplied value is echoed).
- Errors share one shape:

```json
{
  "error": {
    "code": "not_found",
    "message": "Not Found",
    "request_id": "9f2c...",
    "details": null
  }
}
```

`details` is present only for validation errors (field, message, type; never the submitted values).

Common codes: `bad_request`, `unauthorized`, `forbidden`, `not_found`, `method_not_allowed`,
`validation_error`, `integration_not_configured` (503), `internal_error` (500).

## Endpoints

### `GET /health`

Liveness check. Confirms the API process is running; does not contact external services.

```json
{
  "status": "ok",
  "service": "BrandGuard AI API",
  "version": "0.1.0",
  "environment": "development",
  "timestamp": "2026-11-08T10:00:00Z"
}
```

### `GET /api/v1/system/integrations`

Reports whether credentials are present for Supabase, Anthropic and the embedding provider.
It never returns secret values and never contacts the services, so `configured` does not mean reachable.

```json
{
  "integrations": [
    { "key": "supabase", "name": "Supabase", "state": "not_configured", "detail": "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." }
  ]
}
```

Requires `Authorization: Bearer <Supabase access token>` (HTTP 401 otherwise). Any signed-in user may call it for now; restrict it to org admins once role permissions exist.

### `GET /api/v1/organisation/context`

Returns the caller's organisation, role and permissions, resolved from the database for the
verified token's user. Requires `Authorization: Bearer <Supabase access token>`.

```json
{ "organisation_id": "0b7c...", "role": "admin", "permissions": ["audit:view", "invitations:manage", "members:manage", "members:view", "org:update", "org:view"] }
```

- **401** missing/invalid token. **403** no active membership (including suspended); the message is the
  same for "not a member" and "role not allowed", so it never reveals which organisations exist.
  **503** if the database is not configured.
- A user in one organisation needs nothing else. A user in several must send
  `X-Organisation-Id: <uuid>`, otherwise **400** `organisation_required`. The header only *selects* one of
  the caller's own active memberships; any other id gets **403**. Organisation or user ids in bodies and
  query strings are ignored. A malformed id is **400** `invalid_organisation_id`.

Backend routes use `Depends(require_permission(Permission.X))` (or `CurrentOrganisation`) from
`app/api/deps.py` to get the verified `organisation_id` and `role`.

### Content submissions: `/api/v1/submissions`

Real, persistent submissions for brand review. All routes need a Bearer token and an active organisation
membership (see `X-Organisation-Id` above); the organisation and author always come from the verified token,
never from the request. Request bodies reject unknown fields (an `organisation_id`, `submitted_by` or `status`
in a body is a `422`). **Nothing here analyses, scores or approves content**: the furthest a submission goes is
`ready_for_analysis`.

| Method and path | Who | Result |
| --- | --- | --- |
| `POST /` | `submissions:create` (owner, admin, creator) | `201` draft (JSON: `title` required; `content_type`, `content_text`, `campaign_name`, `target_audience`, `platform`, `publishing_date`, `reviewer_context` optional) |
| `GET /?limit=20&offset=0&status=&content_type=&q=&mine=` | any member | `200` `{items, total, limit, offset}`, newest first. Creators see only their own; owners, admins and reviewers see everyone's (`mine=true` narrows to your own). `q` searches titles |
| `GET /{id}` | any member (own, or all if owner/admin/reviewer) | `200` with `content_text`, `reviewer_context` and attachment metadata |
| `PATCH /{id}` | author, or owner/admin | `200`; drafts only; send only the fields to change (optional ones may be `null`) |
| `DELETE /{id}` | author, or owner/admin | `204`; draft, failed or cancelled only; stored files are removed first |
| `POST /{id}/submit` | author, or owner/admin | `200`; `draft -> submitted -> processing -> ready_for_analysis` (or `failed`) |
| `POST /{id}/cancel` | author, or owner/admin | `200`; from draft, submitted, ready_for_analysis or failed |
| `POST /{id}/reopen` | author, or owner/admin | `200`; `failed -> draft` |
| `POST /{id}/attachments` (multipart `file`) | author, or owner/admin | `201` attachment metadata; drafts only; PDF/DOCX/TXT, 10 MB, at most 5 |
| `DELETE /{id}/attachments/{attachment_id}` | author, or owner/admin | `204`; drafts only |

Submitting requires a `content_type` and either at least 20 characters of text or at least one readable
attachment; any failed attachment must be removed first. A submission you may not see is `404`, exactly like one
that does not exist. Errors: `400 empty_file` / `invalid_file` / `bad_request`, `403 forbidden` (role),
`404 not_found`, `409 submission_locked` / `invalid_transition` / `conflict` / `attachment_failed` /
`attachment_not_ready` / `too_many_attachments`, `413 file_too_large`, `415 unsupported_file_type`,
`422 validation_error` / `invalid_submission`, `502 storage_unavailable`. Attachments use the Knowledge Hub's
validation and text extraction; a corrupt, empty or password-protected file is kept with `status: "failed"`.

Lifecycle: `draft -> submitted -> processing -> ready_for_analysis`, plus `failed` (`-> draft` or `cancelled`) and
`cancelled` (final). Only drafts can be edited; submitted, processing and ready submissions cannot be edited or deleted.

### Knowledge Hub: `/api/v1/knowledge/documents`

Approved brand-knowledge documents (PDF, DOCX, TXT; max 10 MB). All routes need a Bearer token and an
active organisation membership (see `X-Organisation-Id` above); the organisation always comes from the
verified token's membership, never from the request. Files live in a private bucket and are never exposed
by URL; responses contain metadata and a short text preview only.

| Method and path | Permission | Result |
| --- | --- | --- |
| `POST /` (multipart field `file`) | `knowledge:manage` (owner, admin) | `201` document with `text_preview` |
| `GET /?limit=50&offset=0` (limit 1-100) | `knowledge:view` (all roles) | `200` `{items, limit, offset}`, newest first |
| `GET /{document_id}` | `knowledge:view` | `200` document with `text_preview` (first 2000 chars) |
| `DELETE /{document_id}` | `knowledge:manage` | `204` (object deleted, then the row) |

Document fields: `id, original_filename, mime_type, size_bytes, status, text_length, error_message,
uploaded_by, processed_at, created_at, updated_at`. `status` is `uploaded`, `processing`, `ready` or `failed`.

Errors (structured as above): `400 empty_file` / `invalid_file` / `bad_request`, `413 file_too_large`,
`415 unsupported_file_type` (extension, MIME type and content must all agree), `403 forbidden`,
`404 not_found` (also for another organisation's document), `502 storage_unavailable`,
`500 database_error`. A readable-looking file whose text cannot be extracted (corrupt, scanned/no text,
password-protected) is **kept with `status: "failed"`** and a short `error_message`, so it can be seen and deleted.

