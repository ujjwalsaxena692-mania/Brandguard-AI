import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import { useAuth } from '@/hooks/use-auth'

/**
 * Route guard. It fails closed:
 * - production builds without Supabase configuration show an error, never the app;
 * - only the dev server allows an unauthenticated preview, flagged by a banner.
 * This is a UX guard only; the backend must independently verify every request.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <LoadingState fullPage label="Checking your session…" />

  if (status === 'unconfigured' && !import.meta.env.DEV) {
    return (
      <ErrorState
        fullPage
        title="Authentication is not configured"
        message="This build has no Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY and rebuild."
      />
    )
  }

  if (status === 'signed_out') return <Navigate to="/login" replace state={{ from: location }} />

  return <>{children}</>
}
