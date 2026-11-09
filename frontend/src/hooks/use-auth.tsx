import type { Session, User } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'

/** 'unconfigured' means no Supabase keys were supplied at build time. */
export type AuthStatus = 'unconfigured' | 'loading' | 'signed_out' | 'signed_in'

interface AuthResult {
  error: string | null
}

interface SignUpInput {
  email: string
  password: string
  fullName: string
}

interface AuthContextValue {
  status: AuthStatus
  user: User | null
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (input: SignUpInput) => Promise<AuthResult & { needsEmailConfirmation: boolean }>
  signOut: () => Promise<AuthResult>
}

const NOT_CONFIGURED = 'Authentication is not configured for this build.'

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(supabase !== null)

  useEffect(() => {
    if (!supabase) return
    let active = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session)
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false)
      })

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback<AuthContextValue['signIn']>(async (email, password) => {
    if (!supabase) return { error: NOT_CONFIGURED }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signUp = useCallback<AuthContextValue['signUp']>(async ({ email, password, fullName }) => {
    if (!supabase) return { error: NOT_CONFIGURED, needsEmailConfirmation: false }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    return { error: error?.message ?? null, needsEmailConfirmation: !error && !data.session }
  }, [])

  const signOut = useCallback<AuthContextValue['signOut']>(async () => {
    if (!supabase) return { error: NOT_CONFIGURED }
    const { error } = await supabase.auth.signOut()
    return { error: error?.message ?? null }
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    let status: AuthStatus = 'signed_out'
    if (!supabase) status = 'unconfigured'
    else if (loading) status = 'loading'
    else if (session) status = 'signed_in'
    return { status, user: session?.user ?? null, signIn, signUp, signOut }
  }, [loading, session, signIn, signUp, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
