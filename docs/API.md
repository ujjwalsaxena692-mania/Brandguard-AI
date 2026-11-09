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

Currently unauthenticated because no auth exists yet. Restrict it to authenticated admins before deploying.
