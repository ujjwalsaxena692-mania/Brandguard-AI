import { env } from '@/lib/env'
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
 * GET JSON from the BrandGuard API.
 * Requests are unauthenticated in Part 01; the Supabase access token will be
 * attached here once the backend verifies it.
 */
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      headers: { Accept: 'application/json' },
      signal,
    })
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
