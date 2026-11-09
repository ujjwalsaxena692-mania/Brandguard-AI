import { RefreshCw, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'
import { Notice } from '@/components/ui/notice'
import { PageHeader } from '@/components/ui/page-header'
import { useApiQuery } from '@/hooks/use-api-query'
import { useAuth, type AuthStatus } from '@/hooks/use-auth'
import { env } from '@/lib/env'
import { getDisplayName } from '@/lib/user'
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

export function SettingsPage() {
  const { user, status } = useAuth()
  const health = useApiQuery(getHealth)
  const integrations = useApiQuery(getIntegrations)

  const refresh = () => {
    health.refetch()
    integrations.refetch()
  }

  return (
    <>
      <PageHeader title="Settings" description="Your account and the status of this installation." />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              <Row label="Name">{getDisplayName(user) ?? '—'}</Row>
              <Row label="Email">{user?.email ?? '—'}</Row>
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
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Organisation and access</CardTitle>
              <Badge variant="primary">Coming soon</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <EmptyState
              compact
              icon={Users}
              title="Organisation settings are not available yet"
              description="Team members, roles and brand-governance policies will be managed here."
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
