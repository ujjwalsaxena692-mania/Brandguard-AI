import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getActiveOrganisationId, setActiveOrganisationId } from '@/lib/active-organisation'
import { ApiError } from '@/services/api'
import { getOrganisationContext, listMyOrganisations, type OrganisationChoice } from '@/services/organisation'
import type { OrganisationContextResponse } from '@/types/content-submission'
import { useAuth } from '@/hooks/use-auth'

/**
 * loading         asking the API who the user is in which organisation
 * ready           `context` holds the organisation id, role and permissions (from the database)
 * needs_selection the user belongs to several organisations and must choose one
 * no_access       signed in, but not an active member of any organisation
 * error           the API could not be reached or answered with an error
 * signed_out      nobody is signed in (or authentication is not configured)
 */
export type OrganisationStatus = 'loading' | 'ready' | 'needs_selection' | 'no_access' | 'error' | 'signed_out'

interface OrganisationState {
  status: OrganisationStatus
  context: OrganisationContextResponse | null
  choices: OrganisationChoice[]
  errorMessage: string | null
}

interface OrganisationValue extends OrganisationState {
  select: (organisationId: string) => void
  retry: () => void
  can: (permission: string) => boolean
}

const SIGNED_OUT: OrganisationState = { status: 'signed_out', context: null, choices: [], errorMessage: null }
const OrganisationContext = createContext<OrganisationValue | null>(null)

export function OrganisationProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, user } = useAuth()
  const userId = user?.id ?? null
  const [state, setState] = useState<OrganisationState>(SIGNED_OUT)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (authStatus !== 'signed_in' || !userId) {
      setActiveOrganisationId(null) // a stale choice must never follow a different user
      setState(SIGNED_OUT)
      return
    }

    const controller = new AbortController()
    const fail = (message: string) =>
      setState({ status: 'error', context: null, choices: [], errorMessage: message })

    async function load(allowRetry: boolean): Promise<void> {
      setState((previous) => ({ ...previous, status: 'loading', errorMessage: null }))
      try {
        const context = await getOrganisationContext(controller.signal)
        setState({ status: 'ready', context, choices: [], errorMessage: null })
      } catch (cause) {
        if (controller.signal.aborted) return
        if (!(cause instanceof ApiError)) return fail('An unexpected error occurred.')

        if (cause.code === 'organisation_required') {
          try {
            const choices = await listMyOrganisations(userId as string)
            if (controller.signal.aborted) return
            setState({ status: 'needs_selection', context: null, choices, errorMessage: null })
          } catch (inner) {
            fail(inner instanceof ApiError ? inner.message : 'Could not load your organisations.')
          }
        } else if (cause.status === 403) {
          if (allowRetry && getActiveOrganisationId()) {
            setActiveOrganisationId(null) // the remembered organisation is no longer valid
            return load(false)
          }
          setState({ status: 'no_access', context: null, choices: [], errorMessage: null })
        } else {
          fail(cause.message)
        }
      }
    }

    void load(true)
    return () => controller.abort()
  }, [authStatus, userId, attempt])

  const retry = useCallback(() => setAttempt((count) => count + 1), [])
  const select = useCallback(
    (organisationId: string) => {
      setActiveOrganisationId(organisationId)
      retry()
    },
    [retry],
  )

  const value = useMemo<OrganisationValue>(
    () => ({ ...state, select, retry, can: (permission) => state.context?.permissions.includes(permission) ?? false }),
    [state, select, retry],
  )
  return <OrganisationContext.Provider value={value}>{children}</OrganisationContext.Provider>
}

export function useOrganisation(): OrganisationValue {
  const value = useContext(OrganisationContext)
  if (!value) throw new Error('useOrganisation must be used inside <OrganisationProvider>.')
  return value
}
