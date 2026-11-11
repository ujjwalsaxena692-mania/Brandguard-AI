# Deploying the frontend to Netlify

1. Commit and push everything (see `git status` — many files under
   `frontend/src/components/` were still untracked).
2. Netlify > Add new site > Import from Git > pick this repo.
   Settings are read from `netlify.toml` (base `frontend`, build `npm run build`, publish `dist`).
3. Site configuration > Environment variables, add:
   - `VITE_API_BASE_URL`            = public URL of your deployed FastAPI backend (https, no trailing slash)
   - `VITE_SUPABASE_URL`            = https://<project>.supabase.co
   - `VITE_SUPABASE_PUBLISHABLE_KEY`= your publishable (anon) key
4. Deploy. Then add your Netlify URL to the backend CORS allow-list and to
   Supabase > Authentication > URL Configuration (Site URL / Redirect URLs).

Note: the backend (FastAPI) cannot run on Netlify; host it elsewhere (Render, Railway, Fly.io…).
