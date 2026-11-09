/** Mirrors the database CHECK constraints (database/migrations/0002_core_tables.sql). */
export type OrganisationRole = 'owner' | 'admin' | 'reviewer' | 'creator'
export type MembershipStatus = 'active' | 'suspended'

export interface Organisation {
  id: string
  name: string
  slug: string
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export interface OrganisationMembership {
  id: string
  organisation_id: string
  user_id: string
  role: OrganisationRole
  status: MembershipStatus
  joined_at: string
}
