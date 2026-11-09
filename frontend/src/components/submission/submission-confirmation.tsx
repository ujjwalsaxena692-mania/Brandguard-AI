import { CheckCircle2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Notice } from '@/components/ui/notice'
import { CONTENT_TYPE_LABELS, countWords } from '@/lib/submission'
import type { ContentSubmission } from '@/types/submission'
import { SubmissionStatusBadge } from './submission-status'

const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm">{children}</dd>
    </div>
  )
}

export function SubmissionConfirmation({ record, onSubmitAnother }: { record: ContentSubmission; onSubmitAnother: () => void }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold" tabIndex={-1} id="submission-confirmation-title">
            Content submitted
          </h2>
          <p className="text-sm text-muted-foreground">Your content has been recorded for brand review.</p>
        </div>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <Item label="Submission ID">
          <code className="font-mono text-base font-semibold">{record.id}</code>
        </Item>
        <Item label="Status">
          <SubmissionStatusBadge status={record.status} />
        </Item>
        <Item label="Title">{record.title}</Item>
        <Item label="Content type">{record.contentType ? CONTENT_TYPE_LABELS[record.contentType] : '—'}</Item>
        <Item label="Submitted">{record.submittedAt ? dateTime.format(new Date(record.submittedAt)) : '—'}</Item>
        <Item label="Length">{countWords(record.contentText).toLocaleString()} words</Item>
        {record.attachments.length > 0 && (
          <Item label="Selected files">
            {record.attachments.map((file) => file.name).join(', ')}
            <span className="block text-xs text-muted-foreground">Recorded by name only. The files were not uploaded.</span>
          </Item>
        )}
      </dl>

      <div className="mt-6">
        <Notice tone="info">
          Submission is not approval, and AI analysis has not started. Analysis and human review are later steps that will be
          available after backend integration. No compliance score exists for this content.
        </Notice>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button onClick={onSubmitAnother}>Submit another</Button>
        <Button asChild variant="outline">
          <Link to="/reports">Go to Analysis Reports</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/">Back to Dashboard</Link>
        </Button>
      </div>
    </Card>
  )
}
