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
