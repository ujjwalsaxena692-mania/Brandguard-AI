/** Mirrors the backend Pydantic schemas (backend/app/schemas). */

export interface HealthResponse {
  status: 'ok'
  service: string
  version: string
  environment: string
  timestamp: string
}

export type IntegrationState = 'configured' | 'not_configured'

export interface IntegrationStatus {
  key: string
  name: string
  state: IntegrationState
  detail: string
}

export interface IntegrationsResponse {
  integrations: IntegrationStatus[]
}

export interface ApiErrorBody {
  code: string
  message: string
  request_id?: string | null
  details?: unknown
}
