/**
 * Typed access to the PUBLIC build-time configuration.
 * Only values meant for the browser belong here; secrets live in the backend.
 */
const raw = import.meta.env

const supabaseUrl = (raw.VITE_SUPABASE_URL ?? '').trim()
const supabasePublishableKey = (raw.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()

export const env = {
  apiBaseUrl: (raw.VITE_API_BASE_URL ?? 'http://localhost:8000').trim().replace(/\/+$/, ''),
  supabaseUrl,
  supabasePublishableKey,
  supabaseConfigured: Boolean(supabaseUrl && supabasePublishableKey),
} as const
