import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { Notice } from '@/components/ui/notice'
import { useAuth } from '@/hooks/use-auth'

interface FieldErrors {
  email?: string
  password?: string
}

export function LoginPage() {
  const { status, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'signed_in') return <Navigate to={from} replace />
  const unconfigured = status === 'unconfigured'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next: FieldErrors = {}
    if (!email.trim()) next.email = 'Enter your email address.'
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email address.'
    if (!password) next.password = 'Enter your password.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    setFormError(null)
    const result = await signIn(email.trim(), password)
    setSubmitting(false)
    if (result.error) setFormError(result.error)
    else navigate(from, { replace: true })
  }

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">Welcome back. Sign in to your BrandGuard AI workspace.</p>

      {unconfigured && (
        <Notice className="mt-5">
          Sign-in is not configured yet. Add <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
          <code className="font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code> to <code className="font-mono">frontend/.env.local</code>.
        </Notice>
      )}
      {formError && (
        <Notice tone="error" className="mt-5">
          {formError}
        </Notice>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
          disabled={unconfigured}
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          disabled={unconfigured}
        />
        <Button type="submit" className="w-full" loading={submitting} disabled={unconfigured}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to BrandGuard AI?{' '}
        <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
      {unconfigured && import.meta.env.DEV && (
        <p className="mt-3 text-center text-sm">
          <Link to="/" className="font-medium text-primary underline-offset-4 hover:underline">
            Open the app shell without signing in (development preview)
          </Link>
        </p>
      )}
    </Card>
  )
}
