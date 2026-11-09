import { useMemo } from 'react'
import { getDemoDashboardData } from '@/data/demo/dashboard'
import type { DashboardData } from '@/types/dashboard'

export interface DashboardQuery {
  data: DashboardData | null
  loading: boolean
  error: { message: string } | null
  refetch: () => void
}

/**
 * Single data entry point for the Dashboard.
 *
 * It currently returns static demo data synchronously (no network request).
 * To connect a backend, replace the body with a real query (for example
 * `useApiQuery`) that resolves to `DashboardData`; the page already handles
 * the loading, error and empty states.
 */
export function useDashboardData(): DashboardQuery {
  const data = useMemo(() => getDemoDashboardData(), [])
  return { data, loading: false, error: null, refetch: () => undefined }
}
