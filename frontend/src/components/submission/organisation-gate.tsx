import type { ReactNode } from 'react'
import { Building2, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import { useOrganisation } from '@/hooks/use-organisation'

const ROLE_LABELS: Record<string, string> = { owner: 'Owner', admin: 'Admin', reviewer: 'Reviewer', creator: 'Creator' }

/**
 * Renders `children` only once the API has confirmed which organisation the user is acting in
 * (and their role). Otherwise shows the matching state: loading, choose an organisation, no
 * access, or an error with a retry.
 */
export function OrganisationGate({ children }: { children: ReactNode }) {
  const organisation = useOrganisation()

  switch (organisation.status) {
    case 'ready':
      return <>{children}</>
    case 'loading':
      return <LoadingState label="Checking your organisation…" />
    case 'signed_out':
      return (
        <EmptyState
          icon={ShieldOff}
          title="Sign in to continue"
          description="Content submissions are available to signed-in members of an organisation."
        />
      )
    case 'no_access':
      return (
        <EmptyState
          icon={Building2}
          title="You are not part of an organisation yet"
          description="Content can only be submitted inside an organisation. Ask an owner or admin to invite you, then reload this page."
          action={
            <Button variant="outline" size="sm" onClick={organisation.retry}>
              Check again
            </Button>
          }
        />
      )
    case 'needs_selection':
      return (
        <Card>
          <CardHeader>
            <CardTitle>Choose an organisation</CardTitle>
            <CardDescription>You belong to more than one. Pick the one you want to work in; you can change it later.</CardDescription>
          </CardHeader>
          <CardContent>
            {organisation.choices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No organisations were found for your account.</p>
            ) : (
              <ul className="divide-y divide-border">
                {organisation.choices.map((choice) => (
                  <li key={choice.organisationId} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{choice.name}</p>
                      <p className="text-xs text-muted-foreground">{ROLE_LABELS[choice.role] ?? choice.role}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => organisation.select(choice.organisationId)}>
                      Use this organisation
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )
    case 'error':
      return (
        <ErrorState
          title="Could not load your organisation"
          message={organisation.errorMessage ?? 'Please try again.'}
          onRetry={organisation.retry}
        />
      )
  }
}
