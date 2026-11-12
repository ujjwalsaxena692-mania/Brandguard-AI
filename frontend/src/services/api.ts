import { env } from '@/lib/env'
import { supabase } from '@/lib/supabase'
import type { ApiErrorBody } from '@/types/api'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId: string | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function readErrorBody(response: Response): Promise<ApiErrorBody | null> {
  try {
    const body = (await response.json()) as { error?: ApiErrorBody }
    return body.error ?? null
  } catch {
    return null
  }
}

/**
 * The current Supabase access token, or null when signed out / Supabase is not configured.
 * `getSession()` refreshes an expired token, and the token is read from the live session on
 * every request, never copied into localStorage or module state by this app.
 */
async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

/**
 * GET JSON from the BrandGuard API.
 * Sends `Authorization: Bearer <access token>` when a session exists. The backend verifies the
 * token on every protected route; this header is only a credential, never proof by itself.
 * `path` must be an API path (starting with "/"), so the token can only go to the API origin.
 */
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (!path.startsWith('/')) throw new Error('apiGet expects a path starting with "/".')

  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = await getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, { headers, signal })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ApiError('Could not reach the BrandGuard API.', 0, 'network_error')
  }

  if (!response.ok) {
    const body = await readErrorBody(response)
    throw new ApiError(
      body?.message ?? `Request failed with status ${response.status}.`,
      response.status,
      body?.code ?? 'http_error',
      body?.request_id ?? null,
    )
  }
  return (await response.json()) as T
}
