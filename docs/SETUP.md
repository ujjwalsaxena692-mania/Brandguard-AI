# Setup

## Prerequisites

- Node.js 20+ and npm
- Python 3.11+
- (Later modules) Tesseract OCR system binary for OCR

## Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env               # all values optional for local start
uvicorn app.main:app --reload --port 8000
```

Check it: `curl http://localhost:8000/health`. Run tests: `pytest`.

| Variable | Purpose |
| --- | --- |
| `APP_ENV` | `development`, `test` or `production` |
| `LOG_LEVEL` | Logging verbosity |
| `ALLOWED_ORIGINS` | Comma-separated exact CORS origins (no wildcard) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase (server-side only) |
| `ANTHROPIC_API_KEY` | Claude API (needed from Part 2) |
| `EMBEDDING_PROVIDER`, `EMBEDDING_API_KEY` | Embedding provider (chosen separately) |

## Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev                        # http://localhost:5173
```

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Backend URL (default `http://localhost:8000`) |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key |

Without the Supabase variables, the dev server shows the app shell in a clearly
labelled preview mode. Production builds without them refuse to render the app.

## Supabase

1. Create a project.
2. Run `database/migrations/0001_enable_extensions.sql` in the SQL editor.
3. Put the project URL and publishable key in `frontend/.env.local`; put the URL and service-role key in `backend/.env`.

## Scripts

Frontend: `npm run dev`, `npm run build`, `npm run preview`, `npm run typecheck`.
Backend: `uvicorn app.main:app --reload`, `pytest`.
