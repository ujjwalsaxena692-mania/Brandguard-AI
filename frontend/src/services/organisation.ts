import { supabase } from '@/lib/supabase'
import { apiGet, ApiError } from '@/services/api'
import type { OrganisationContextResponse } from '@/types/content-submission'

export function getOrganisationContext(signal?: AbortSignal) {
  return apiGet<OrganisationContextResponse>('/api/v1/organisation/context', signal)
}

export interface OrganisationChoice {
  organisationId: string
  name: string
  role: string
}

interface MembershipRow {
  organisation_id: string
  role: string
  organisations: { name: string } | { name: string }[] | null
}

/**
 * The organisations the signed-in user actively belongs to, read through Supabase with their own
 * session (Row Level Security limits this to their own organisations). Used only to let a user in
 * several organisations choose one; the API re-checks the choice on every request.
 */
export async function listMyOrganisations(userId: string): Promise<OrganisationChoice[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('organisation_memberships')
    .select('organisation_id, role, organisations ( name )')
    .eq('user_id', userId)
    .eq('status', 'active')
  if (error) throw new ApiError('Could not load your organisations.', 0, 'organisations_unavailable')

  return ((data ?? []) as unknown as MembershipRow[]).map((row) => {
    const organisation = Array.isArray(row.organisations) ? row.organisations[0] : row.organisations
    return { organisationId: row.organisation_id, name: organisation?.name ?? 'Organisation', role: row.role }
  })
}
