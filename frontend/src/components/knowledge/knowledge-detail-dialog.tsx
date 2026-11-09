import { Pencil, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Notice } from '@/components/ui/notice'
import { CATEGORY_LABELS, getApprovalBlockers, isAuthoritative, isExpired } from '@/lib/knowledge'
import type { StatusChangeResult } from '@/hooks/use-knowledge-store'
import type { KnowledgeEntry, KnowledgeStatus } from '@/types/knowledge'
import { formatDate } from '@/components/dashboard/format'
import { KnowledgeStatusCell } from './status'

interface Transition {
  to: KnowledgeStatus
  label: string
  primary?: boolean
}

const TRANSITIONS: Record<KnowledgeStatus, Transition[]> = {
  draft: [
    { to: 'pending_review', label: 'Submit for review', primary: true },
    { to: 'archived', label: 'Archive' },
  ],
  pending_review: [
    { to: 'approved', label: 'Approve', primary: true },
    { to: 'draft', label: 'Return to draft' },
    { to: 'archived', label: 'Archive' },
  ],
  approved: [
    { to: 'pending_review', label: 'Send back for review' },
    { to: 'archived', label: 'Archive' },
  ],
  archived: [{ to: 'draft', label: 'Restore as draft', primary: true }],
}

interface DetailDialogProps {
  entry: KnowledgeEntry | null
  onClose: () => void
  onEdit: (entry: KnowledgeEntry) => void
  onDelete: (entry: KnowledgeEntry) => void
  onChangeStatus: (id: string, next: KnowledgeStatus) => StatusChangeResult
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

function Body({ entry, onEdit, onDelete, onChangeStatus }: Omit<DetailDialogProps, 'entry' | 'onClose'> & { entry: KnowledgeEntry }) {
  const [message, setMessage] = useState<string | null>(null)
  const authoritative = isAuthoritative(entry)
  const blockers = getApprovalBlockers(entry)

  const move = (to: KnowledgeStatus) => {
    const result = onChangeStatus(entry.id, to)
    setMessage(result.ok ? null : result.message)
  }

  let governance: { tone: 'success' | 'info' | 'error'; text: string }
  if (authoritative) {
    governance = { tone: 'success', text: 'Approved and in date. This entry can be used as authoritative brand evidence.' }
  } else if (entry.status === 'approved' && isExpired(entry)) {
    governance = { tone: 'error', text: 'Approved, but past its validity date. It is not treated as authoritative until renewed.' }
  } else if (entry.status === 'approved') {
    governance = { tone: 'error', text: `Not verified: ${blockers.map((blocker) => blocker.message).join(' ')}` }
  } else {
    governance = { tone: 'info', text: 'Not approved, so this entry is not treated as authoritative brand evidence.' }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{entry.title}</DialogTitle>
        <DialogDescription>
          {CATEGORY_LABELS[entry.category]} · {entry.subtype}
        </DialogDescription>
      </DialogHeader>

      <KnowledgeStatusCell entry={entry} />
      <Notice tone={governance.tone}>{governance.text}</Notice>

      <section aria-label="Content">
        <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Content</h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{entry.description}</p>
      </section>

      <dl className="grid gap-4 sm:grid-cols-2">
        <Meta label="Source / reference">{entry.source || <span className="text-muted-foreground">None recorded</span>}</Meta>
        {entry.category === 'claims' && (
          <Meta label="Supporting evidence">
            {entry.evidence || <span className="text-muted-foreground">None recorded</span>}
          </Meta>
        )}
        <Meta label="Created">{formatDate(entry.createdAt)}</Meta>
        <Meta label="Last updated">{formatDate(entry.updatedAt)}</Meta>
        <Meta label="Approval date">
          {entry.approvedAt ? formatDate(entry.approvedAt) : <span className="text-muted-foreground">Not approved</span>}
        </Meta>
        <Meta label="Valid until">
          {entry.validUntil ? formatDate(entry.validUntil) : <span className="text-muted-foreground">No expiry</span>}
        </Meta>
        <Meta label="Entry ID">
          <code className="font-mono text-xs">{entry.id}</code>
        </Meta>
      </dl>

      {message && <Notice tone="error">{message}</Notice>}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {TRANSITIONS[entry.status].map((transition) => (
          <Button key={transition.to} size="sm" variant={transition.primary ? 'default' : 'outline'} onClick={() => move(transition.to)}>
            {transition.label}
          </Button>
        ))}
        <span className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => onEdit(entry)}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDelete(entry)}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete
        </Button>
        <DialogClose asChild>
          <Button size="sm" variant="ghost">
            Close
          </Button>
        </DialogClose>
      </div>
    </>
  )
}

export function KnowledgeDetailDialog({ entry, onClose, ...actions }: DetailDialogProps) {
  return (
    <Dialog open={entry !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {/* Keyed so any status message resets when a different entry is opened. */}
        {entry && <Body key={entry.id} entry={entry} {...actions} />}
      </DialogContent>
    </Dialog>
  )
}
