# BrandGuard AI

**One Brand. Every Voice. Zero Compromise.**

BrandGuard AI is an AI-powered brand-governance platform. It analyses content
before publication against approved brand guidelines, terminology, facts and
visual assets, while keeping humans in control of final approval.

## Status: Part 02A - database architecture and Supabase foundation (on top of Part 01)

Built and honest about it:

- React + TypeScript + Vite + Tailwind application shell with a Red & White design-token system.
- Sidebar/top-bar layout, login and registration (real Supabase Auth when configured), dashboard, and every planned page.
- Part 02A: organisations, profiles, memberships, invitations and audit-log schema with Row Level Security, plus backend authorisation utilities. Authentication verification is Part 02B. See [database schema](docs/DATABASE_SCHEMA.md) and [security model](docs/SECURITY_MODEL.md).
- FastAPI backend foundation: configuration, CORS, structured errors, logging, `GET /health`, Supabase service module.

**Not built yet** (pages show empty or "Coming soon" states, never fake data): knowledge hub, content submission,
AI analysis, approvals, revision history, analytics, organisations and roles, database schema.

## Repository layout

```
brandguard-ai/
  frontend/    React app (Vite, Tailwind, shadcn-style components)
  backend/     FastAPI service (api, core, middleware, schemas, services, ...)
  database/    SQL migrations and seed data
  docs/        Architecture, API, setup and technical decisions
```

## Quick start

See [docs/SETUP.md](docs/SETUP.md) for full instructions.

```bash
# Backend  -> http://localhost:8000  (docs at /docs)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000

# Frontend -> http://localhost:5173
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Neither side needs real credentials to start.

## Security rules

- Real `.env` files are git-ignored; only `.env.example` templates are committed.
- The Supabase service-role key and Anthropic key live only in `backend/.env`.
- Frontend `VITE_*` variables are public: publishable keys only.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [Setup](docs/SETUP.md)
- [Technical decisions](docs/DECISIONS.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [Security model](docs/SECURITY_MODEL.md)
- [Role permissions](docs/ROLE_PERMISSIONS.md)
- [Migration guide](docs/MIGRATION_GUIDE.md)
