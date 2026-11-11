import { Building2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { TeamSection } from '@/components/organisation/team-section'
import { TextAreaField } from '@/components/knowledge/fields'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { Notice } from '@/components/ui/notice'
import { PageHeader } from '@/components/ui/page-header'
import { useWorkspace, workspaceActions, type OrganisationDetails } from '@/hooks/use-workspace-store'
import { getInitials } from '@/lib/user'

export function OrganisationPage() {
  const { organisation, demoMembers } = useWorkspace()
  const [form, setForm] = useState<OrganisationDetails>(organisation)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const update = (key: keyof OrganisationDetails) => (e: { target: { value: string } }) => {
    setForm({ ...form, [key]: e.target.value })
    setSaved(false)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Organisation name is required.')
    setError(undefined)
    workspaceActions.saveOrganisation({ ...form, name: form.name.trim() })
    setSaved(true)
  }

  return (
    <>
      <PageHeader title="Organisation" description="Organisation details and team." badge="Demo data" />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Organisation details</CardTitle>
            <CardDescription>Demo values, saved locally in this browser session only. Nothing is written to the database.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div className="flex items-center gap-4">
                <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary-soft text-lg font-semibold text-primary-soft-foreground">
                  {organisation.name ? getInitials(organisation.name) : <Building2 className="h-6 w-6" />}
                </span>
                <div className="text-sm">
                  <p className="font-medium">{organisation.name}</p>
                  <p className="text-muted-foreground">Logo upload is not available yet.</p>
                  <Badge variant="outline" className="mt-1">{demoMembers.length + 1} members (incl. demo)</Badge>
                </div>
              </div>
              <FormField id="org-name" label="Organisation name" value={form.name} onChange={update('name')} error={error} />
              <TextAreaField id="org-description" label="Description" value={form.description} onChange={update('description')} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="org-industry" label="Industry" value={form.industry} onChange={update('industry')} />
                <FormField id="org-website" label="Website" type="url" value={form.website} onChange={update('website')} />
              </div>
              {saved && <Notice tone="success">Saved locally. This does not change the database.</Notice>}
              <Button type="submit">Save details</Button>
            </form>
          </CardContent>
        </Card>
        <TeamSection />
      </div>
    </>
  )
}
