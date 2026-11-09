# Architecture

## Overview

```
Browser (React SPA)
   |  Supabase Auth (publishable key)        -> Supabase Auth
   |  REST + JSON (Bearer token, future)     -> FastAPI backend
                                                  |-> Supabase Postgres / Storage (service-role key)
                                                  |-> Anthropic Claude API
                                                  |-> Embedding provider
```

Deployment targets: frontend on Vercel, backend on Render, data on Supabase.

## Frontend (`frontend/src`)

| Folder | Responsibility |
| --- | --- |
| `components/ui` | Reusable primitives: button, card, input, form field, dialog, table, badges, notice, loading/empty/error states, page header |
| `components/layout` | Sidebar, sidebar item, top bar, user menu, API status |
| `components/auth` | Route guard (`RequireAuth`) |
| `layouts` | `AppShell` (authenticated) and `AuthLayout` (login/register) |
| `pages` | One file per route |
| `hooks` | `use-auth` (Supabase session), `use-api-query` (fetching) |
| `services` | API client and typed endpoint functions |
| `lib` | `env`, `supabase`, `navigation`, helpers |
| `styles` | `tokens.css` (design tokens) and `globals.css` |
| `types` | Shared TypeScript types |

### Design tokens (Red & White theme)

`styles/tokens.css` is the single source of truth. Colours are RGB channels so
Tailwind opacity modifiers work, and `tailwind.config.ts` maps them to utilities
(`bg-primary`, `text-muted-foreground`, ...). Changing a token restyles the whole app.

| Token | Value | Use |
| --- | --- | --- |
| `--primary` | `#C62828` | Primary buttons, active navigation, key highlights |
| `--background` | `#F8F8F8` | Page background |
| `--card` | `#FFFFFF` | Cards, panels, sidebar |
| `--foreground` | `#222222` | Text |
| `--border` | `#E5E5E5` | Dividers and card borders |
| `--input` | `#8A8A8A` | Form-control borders (3:1 contrast) |
| `--success` / `--warning` | `#1B5E20` / `#8A5300` | Semantic status only |

No blue, purple or green is used as a brand colour.

### Routes

`/login`, `/register`, `/` (dashboard), `/knowledge-hub`, `/submit`, `/reports`,
`/approvals`, `/history`, `/analytics`, `/settings`. Unknown paths render a 404.

## Backend (`backend/app`)

| Folder | Responsibility |
| --- | --- |
| `main.py` | App factory, middleware, router registration |
| `api` | HTTP layer. `health.py`, `deps.py`, `v1/` (versioned routes) |
| `core` | `config` (env settings), `logging`, `errors` |
| `middleware` | Request ID and access logging |
| `schemas` | Pydantic request/response models |
| `services` | Integrations and business logic (`supabase_client`, `integrations`) |
| `models`, `repositories` | Reserved; empty until the database schema exists |

Request flow: `RequestContextMiddleware` -> `CORSMiddleware` -> route -> handler.
Errors are normalised by `core/errors.py`.

## Multi-tenancy plan (not implemented yet)

The backend uses the Supabase service-role key, which bypasses Row Level
Security. Therefore: (1) verify the user's JWT on every request, (2) derive the
organisation from the verified user's membership, never from client input,
(3) scope every repository query by `organisation_id`, and (4) also enable RLS
on every table as a second layer of defence.
