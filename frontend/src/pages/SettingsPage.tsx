import { Palette, RefreshCw } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { LoadingState } from '@/components/ui/loading-state'
import { Notice } from '@/components/ui/notice'
import { PageHeader } from '@/components/ui/page-header'
import { useApiQuery } from '@/hooks/use-api-query'
import { useAuth, type AuthStatus } from '@/hooks/use-auth'
import { env } from '@/lib/env'
import { supabase } from '@/lib/supabase'
import { getDisplayName, getInitials } from '@/lib/user'
import { getHealth, getIntegrations } from '@/services/system'

const SESSION_LABELS: Record<AuthStatus, string> = {
  signed_in: 'Signed in',
  signed_out: 'Signed out',
  loading: 'Checking…',
  unconfigured: 'Authentication not configured',
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="text-sm text-muted-foreground sm:text-right">{children}</dd>
    </div>
  )
}

function ConfiguredBadge({ configured }: { configured: boolean }) {
  return configured ? <Badge variant="success">Configured</Badge> : <Badge>Not configured</Badge>
}

function ProfileCard() {
  const { user, status } = useAuth()
  const current = getDisplayName(user) ?? ''
  const stored = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : ''
  const [name, setName] = useState(stored)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const canSave = status === 'signed_in' && supabase !== null
  const nameError = name.trim() ? undefined : 'Display name is required.'

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (nameError || !supabase || !canSave) return
    setSaving(true)
    setMessage(null)
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } })
    setSaving(false)
    setMessage(error ? { tone: 'error', text: error.message } : { tone: 'success', text: 'Profile saved.' })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your display name is saved to your sign-in account. Your email is managed by authentication.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
              {getInitials(current || null)}
            </span>
            <p className="text-sm text-muted-foreground">Avatar upload is not available yet.</p>
          </div>
          <FormField id="profile-name" label="Display name" value={name} error={nameError} disabled={!canSave} onChange={(e) => { setName(e.target.value); setMessage(null) }} />
          <FormField id="profile-email" label="Email" value={user?.email ?? ''} readOnly disabled hint="Read-only. Sourced from authentication." />
          {!canSave && <Notice>Sign in with authentication configured to edit your profile.</Notice>}
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          <Button type="submit" loading={saving} disabled={!canSave || Boolean(nameError)}>Save profile</Button>
        </form>
      </CardContent>
    </Card>
  )
}

export function SettingsPage() {
  const { status } = useAuth()
  const health = useApiQuery(getHealth)
  const integrations = useApiQuery(getIntegrations)

  const refresh = () => {
    health.refetch()
    integrations.refetch()
  }

  return (
    <>
      <PageHeader title="Settings" description="Your profile and the status of this installation." />

      <div className="space-y-6">
        <ProfileCard />

        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              <Row label="Session">{SESSION_LABELS[status]}</Row>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle>System status</CardTitle>
              <CardDescription>Live checks against the BrandGuard API. Secrets are never shown.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              <Row label="API address">
                <code className="font-mono text-xs">{env.apiBaseUrl}</code>
              </Row>
              <Row label="Backend API">
                {health.loading ? (
                  'Checking…'
                ) : health.data ? (
                  <span className="inline-flex items-center gap-2">
                    <Badge variant="success">Online</Badge>
                    <span>
                      v{health.data.version} · {health.data.environment}
                    </span>
                  </span>
                ) : (
                  <Badge variant="danger">Unreachable</Badge>
                )}
              </Row>
              <Row label="Supabase (browser)">
                <ConfiguredBadge configured={env.supabaseConfigured} />
              </Row>
              {integrations.data?.integrations.map((integration) => (
                <Row key={integration.key} label={`${integration.name} (server)`}>
                  <ConfiguredBadge configured={integration.state === 'configured'} />
                </Row>
              ))}
            </dl>

            {integrations.loading && <LoadingState label="Checking server integrations…" />}
            {health.error && (
              <Notice tone="error" className="mt-4">
                {health.error.message} Make sure the backend is running at {env.apiBaseUrl}.
              </Notice>
            )}
            {!health.error && integrations.error && (
              <Notice tone="error" className="mt-4">
                {integrations.error.message}
              </Notice>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              &ldquo;Configured&rdquo; means credentials are present. Connectivity is not verified in this release.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle>Brand settings</CardTitle>
              <CardDescription>Voice, terminology and colours (local demo preferences).</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/settings/brand">
                <Palette className="h-4 w-4" aria-hidden="true" />
                Open brand settings
              </Link>
            </Button>
          </CardHeader>
        </Card>
      </div>
    </>
  )
}
