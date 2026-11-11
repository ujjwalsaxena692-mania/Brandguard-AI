import { Search, Trash2, UserPlus, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Notice } from '@/components/ui/notice'
import { Table, TableBody, TableCell, TableEmptyRow, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FilterSelect, SelectField } from '@/components/knowledge/fields'
import { useAuth } from '@/hooks/use-auth'
import { TEAM_ROLES, useWorkspace, workspaceActions, type TeamMember, type TeamRole } from '@/hooks/use-workspace-store'
import { getDisplayName } from '@/lib/user'

const ROLE_OPTIONS = TEAM_ROLES.map((r) => ({ value: r, label: r }))

function InviteDialog({ open, onOpenChange, knownEmails }: { open: boolean; onOpenChange: (o: boolean) => void; knownEmails: string[] }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamRole>('Member')
  const [error, setError] = useState<string | undefined>()

  function submit(e: FormEvent) {
    e.preventDefault()
    const result = workspaceActions.addInvitation(email, role, knownEmails)
    if (result) return setError(result)
    setEmail('')
    setRole('Member')
    setError(undefined)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setError(undefined) }}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Invite member</DialogTitle>
            <DialogDescription>Demo only: no email is sent and no invitation link is created.</DialogDescription>
          </DialogHeader>
          <FormField id="invite-email" label="Email" type="email" value={email} error={error} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" autoComplete="off" />
          <SelectField id="invite-role" label="Role" value={role} options={ROLE_OPTIONS} onChange={(e) => setRole(e.target.value as TeamRole)} />
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button type="submit">Add invitation</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddMemberDialog({ open, onOpenChange, knownEmails }: { open: boolean; onOpenChange: (o: boolean) => void; knownEmails: string[] }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamRole>('Member')
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({})

  function submit(e: FormEvent) {
    e.preventDefault()
    const next: { name?: string; email?: string } = {}
    const cleanEmail = email.trim().toLowerCase()
    if (!name.trim()) next.name = 'Enter a name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) next.email = 'Enter a valid email address.'
    else if (knownEmails.some((x) => x.toLowerCase() === cleanEmail)) next.email = 'This email is already on the team.'
    setErrors(next)
    if (next.name || next.email) return
    workspaceActions.addDemoMember({ name: name.trim(), email: cleanEmail, role })
    setName('')
    setEmail('')
    setRole('Member')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setErrors({}) }}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Add demo member</DialogTitle>
            <DialogDescription>Added to this browser session only. It does not create an account or change the database.</DialogDescription>
          </DialogHeader>
          <FormField id="demo-name" label="Name" value={name} error={errors.name} onChange={(e) => setName(e.target.value)} />
          <FormField id="demo-email" label="Email" type="email" value={email} error={errors.email} onChange={(e) => setEmail(e.target.value)} />
          <SelectField id="demo-role" label="Role" value={role} options={ROLE_OPTIONS} onChange={(e) => setRole(e.target.value as TeamRole)} />
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button type="submit">Add demo member</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TeamSection() {
  const { user } = useAuth()
  const { demoMembers, invitations } = useWorkspace()
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [toRemove, setToRemove] = useState<TeamMember | null>(null)

  const members = useMemo<TeamMember[]>(() => {
    const self: TeamMember[] = user
      ? [{ id: 'self', name: getDisplayName(user) ?? 'You', email: user.email ?? '—', role: null, status: 'Active', isDemo: false }]
      : []
    return [...self, ...demoMembers]
  }, [user, demoMembers])

  const knownEmails = members.map((m) => m.email)

  const visible = members.filter((m) => {
    const q = query.trim().toLowerCase()
    const matchesQuery = !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    const matchesRole = roleFilter === 'all' || (roleFilter === 'unassigned' ? m.role === null : m.role === roleFilter)
    return matchesQuery && matchesRole
  })

  return (
    <>
      <Card>
        <CardHeader className="sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Team</CardTitle>
            <CardDescription>You come from your sign-in. Rows marked Demo are sample data.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>Add demo member</Button>
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Invite member
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Notice>Team changes here are demo-only and local. They do not affect the database. Your real role is not loaded in this release.</Notice>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search members"
                placeholder="Search by name or email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <FilterSelect aria-label="Filter by role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="sm:w-44">
              <option value="all">All roles</option>
              {TEAM_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              <option value="unassigned">Not loaded</option>
            </FilterSelect>
          </div>

          <Table>
            <TableHeader>
              <tr>
                <TableHead>Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableEmptyRow colSpan={5} title="No members match" description="Try a different search or role filter." />
              ) : (
                visible.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}{!m.isDemo && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</TableCell>
                    <TableCell className="text-muted-foreground">{m.email}</TableCell>
                    <TableCell>{m.role ?? <span className="text-muted-foreground">Not loaded</span>}</TableCell>
                    <TableCell><Badge variant={m.isDemo ? 'outline' : 'success'}>{m.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {m.isDemo && (
                        <Button variant="ghost" size="icon" aria-label={`Remove ${m.name}`} onClick={() => setToRemove(m)}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Pending invitations (demo)</h3>
            {invitations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending invitations.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {invitations.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{i.email}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant="warning">Pending · {i.role}</Badge>
                      <Button variant="ghost" size="icon" aria-label={`Cancel invitation for ${i.email}`} onClick={() => workspaceActions.cancelInvitation(i.id)}>
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} knownEmails={knownEmails} />
      <AddMemberDialog open={addOpen} onOpenChange={setAddOpen} knownEmails={knownEmails} />

      <Dialog open={toRemove !== null} onOpenChange={(o) => !o && setToRemove(null)}>
        <DialogContent>
          {toRemove && (
            <>
              <DialogHeader>
                <DialogTitle>Remove demo member?</DialogTitle>
                <DialogDescription>{toRemove.name} will be removed from this demo list only. No real account is affected.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={() => { workspaceActions.removeDemoMember(toRemove.id); setToRemove(null) }}>Remove</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
