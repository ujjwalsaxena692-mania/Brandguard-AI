import { apiGet } from '@/services/api'
import type { HealthResponse, IntegrationsResponse } from '@/types/api'

export const getHealth = (signal: AbortSignal) => apiGet<HealthResponse>('/health', signal)

export const getIntegrations = (signal: AbortSignal) =>
  apiGet<IntegrationsResponse>('/api/v1/system/integrations', signal)
