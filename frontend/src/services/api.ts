import { getActiveOrganisationId } from '@/lib/active-organisation'
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

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

interface RequestOptions {
  /** JSON body (sets Content-Type). */
  body?: unknown
  /** Multipart body, e.g. a file upload. The browser sets the Content-Type and boundary. */
  formData?: FormData
  signal?: AbortSignal
}

/**
 * Call the BrandGuard API.
 * Sends `Authorization: Bearer <access token>` when a session exists, plus `X-Organisation-Id`
 * when the user has chosen one of several organisations. The backend verifies the token and the
 * membership on every protected route; these headers are only inputs, never proof by themselves.
 * `path` must be an API path (starting with "/"), so the token can only go to the API origin.
 * A 204 response resolves to `undefined`.
 */
export async function apiRequest<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
  if (!path.startsWith('/')) throw new Error('API paths must start with "/".')

  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = await getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const organisationId = getActiveOrganisationId()
  if (organisationId) headers['X-Organisation-Id'] = organisationId

  let body: BodyInit | undefined
  if (options.formData) {
    body = options.formData
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  let response: Response
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, { method, headers, body, signal: options.signal })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ApiError('Could not reach the BrandGuard API.', 0, 'network_error')
  }

  if (!response.ok) {
    const error = await readErrorBody(response)
    throw new ApiError(
      error?.message ?? `Request failed with status ${response.status}.`,
      response.status,
      error?.code ?? 'http_error',
      error?.request_id ?? null,
    )
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** GET JSON from the BrandGuard API. */
export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return apiRequest<T>('GET', path, { signal })
}
