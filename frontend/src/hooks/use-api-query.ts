import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/services/api'

interface QueryState<T> {
  data: T | null
  error: ApiError | null
  loading: boolean
}

/**
 * Minimal data-fetching hook. `fetcher` must be a stable reference
 * (a module-level function or a memoised callback).
 */
export function useApiQuery<T>(fetcher: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<QueryState<T>>({ data: null, error: null, loading: true })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState((previous) => ({ ...previous, loading: true, error: null }))

    fetcher(controller.signal)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        const error =
          cause instanceof ApiError ? cause : new ApiError('An unexpected error occurred.', 0, 'unknown')
        setState({ data: null, error, loading: false })
      })

    return () => controller.abort()
  }, [fetcher, attempt])

  const refetch = useCallback(() => setAttempt((count) => count + 1), [])
  return { ...state, refetch }
}
