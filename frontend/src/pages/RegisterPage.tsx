import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { Notice } from '@/components/ui/notice'
import { useAuth } from '@/hooks/use-auth'

interface FieldErrors {
  fullName?: string
  email?: string
  password?: string
  confirmPassword?: string
}

const MIN_PASSWORD_LENGTH = 8

export function RegisterPage() {
  const { status, signUp } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'signed_in') return <Navigate to="/" replace />
  const unconfigured = status === 'unconfigured'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next: FieldErrors = {}
    if (!fullName.trim()) next.fullName = 'Enter your full name.'
    if (!email.trim()) next.email = 'Enter your email address.'
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email address.'
    if (password.length < MIN_PASSWORD_LENGTH) next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`
    if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    setFormError(null)
    const result = await signUp({ email: email.trim(), password, fullName: fullName.trim() })
    setSubmitting(false)

    if (result.error) setFormError(result.error)
    else if (result.needsEmailConfirmation) setConfirmationSent(true)
    else navigate('/', { replace: true })
  }

  if (confirmationSent) {
    return (
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <Notice tone="success" className="mt-5">
          We sent a confirmation link to <strong>{email.trim()}</strong>. Open it to activate your account, then sign in.
        </Notice>
        <Button asChild className="mt-6 w-full">
          <Link to="/login">Go to sign in</Link>
        </Button>
      </Card>
    )
  }

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">Start governing your brand communication.</p>

      {unconfigured && (
        <Notice className="mt-5">
          Registration is not configured yet. Add your Supabase keys to <code className="font-mono">frontend/.env.local</code>.
        </Notice>
      )}
      {formError && (
        <Notice tone="error" className="mt-5">
          {formError}
        </Notice>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <FormField
          id="full-name"
          label="Full name"
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          error={errors.fullName}
          disabled={unconfigured}
        />
        <FormField
          id="email"
          label="Work email"
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
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          disabled={unconfigured}
        />
        <FormField
          id="confirm-password"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={errors.confirmPassword}
          disabled={unconfigured}
        />
        <Button type="submit" className="w-full" loading={submitting} disabled={unconfigured}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  )
}
