import { useSyncExternalStore } from 'react'

/**
 * Local, in-memory store for the Organisation, Team and Brand Settings screens.
 *
 * Everything here is DEMO / LOCAL state: it survives navigating between pages
 * but is lost on refresh, and nothing is sent to a backend or the AI engine.
 */

export const TEAM_ROLES = ['Admin', 'Editor', 'Reviewer', 'Member'] as const
export type TeamRole = (typeof TEAM_ROLES)[number]

export interface OrganisationDetails {
  name: string
  description: string
  industry: string
  website: string
}

export interface TeamMember {
  id: string
  name: string
  email: string
  /** null = role is not loaded from the database in this release. */
  role: TeamRole | null
  status: 'Active' | 'Demo'
  /** Demo members can be removed; the signed-in user cannot. */
  isDemo: boolean
}

export interface Invitation {
  id: string
  email: string
  role: TeamRole
}

export const BRAND_VOICES = ['Professional', 'Friendly', 'Bold', 'Minimal'] as const
export type BrandVoice = (typeof BRAND_VOICES)[number]

export interface BrandSettings {
  name: string
  description: string
  website: string
  industry: string
  voice: BrandVoice
  language: string
  terminology: string
  avoidWords: string
  primaryColour: string
  secondaryColour: string
}

interface WorkspaceState {
  organisation: OrganisationDetails
  demoMembers: TeamMember[]
  invitations: Invitation[]
  brand: BrandSettings
}

let counter = 0
const nextId = (prefix: string) => `${prefix}-${++counter}`

let state: WorkspaceState = {
  organisation: {
    name: 'Demo Organisation',
    description: 'Sample description. Replace this with a short summary of your organisation.',
    industry: 'Technology',
    website: 'https://example.com',
  },
  demoMembers: [
    { id: 'demo-1', name: 'Demo Editor', email: 'demo.editor@example.com', role: 'Editor', status: 'Demo', isDemo: true },
    { id: 'demo-2', name: 'Demo Reviewer', email: 'demo.reviewer@example.com', role: 'Reviewer', status: 'Demo', isDemo: true },
  ],
  invitations: [],
  brand: {
    name: 'Demo Brand',
    description: 'Sample brand description for local preview.',
    website: 'https://example.com',
    industry: 'Technology',
    voice: 'Professional',
    language: 'English',
    terminology: '',
    avoidWords: '',
    primaryColour: '#C62828',
    secondaryColour: '#222222',
  },
}

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
const getSnapshot = () => state

function set(next: Partial<WorkspaceState>) {
  state = { ...state, ...next }
  emit()
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const workspaceActions = {
  saveOrganisation(details: OrganisationDetails) {
    set({ organisation: details })
  },
  saveBrand(brand: BrandSettings) {
    set({ brand })
  },
  addDemoMember(input: { name: string; email: string; role: TeamRole }) {
    set({
      demoMembers: [
        ...state.demoMembers,
        { id: nextId('demo'), name: input.name, email: input.email, role: input.role, status: 'Demo', isDemo: true },
      ],
    })
  },
  removeDemoMember(id: string) {
    set({ demoMembers: state.demoMembers.filter((m) => m.id !== id) })
  },
  /** Returns an error message, or null when the invitation was added. */
  addInvitation(email: string, role: TeamRole, knownEmails: string[]): string | null {
    const clean = email.trim().toLowerCase()
    if (!EMAIL_PATTERN.test(clean)) return 'Enter a valid email address.'
    if (state.invitations.some((i) => i.email === clean)) return 'This email already has a pending invitation.'
    if (knownEmails.some((e) => e.toLowerCase() === clean)) return 'This email already belongs to a team member.'
    set({ invitations: [...state.invitations, { id: nextId('invite'), email: clean, role }] })
    return null
  },
  cancelInvitation(id: string) {
    set({ invitations: state.invitations.filter((i) => i.id !== id) })
  },
}

export function useWorkspace(): WorkspaceState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
