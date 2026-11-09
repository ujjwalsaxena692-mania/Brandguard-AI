import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

/**
 * Browser Supabase client using the PUBLISHABLE key only.
 * It is null when Supabase is not configured, so callers must handle that case
 * instead of assuming a connection exists.
 */
export const supabase: SupabaseClient | null = env.supabaseConfigured
  ? createClient(env.supabaseUrl, env.supabasePublishableKey)
  : null
