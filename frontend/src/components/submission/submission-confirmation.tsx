import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatDate } from '@/components/dashboard/format'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Notice } from '@/components/ui/notice'
import { shortId } from '@/lib/content-submission'
import { CONTENT_TYPE_LABELS } from '@/lib/submission'
import type { ApiSubmissionDetail } from '@/types/content-submission'
import { SubmissionStatusBadge } from './submission-status'

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm">{children}</dd>
    </div>
  )
}

interface SubmissionConfirmationProps {
  submission: ApiSubmissionDetail
  onSubmitAnother: () => void
  onReopen: () => void
  reopening: boolean
}

export function SubmissionConfirmation({ submission, onSubmitAnother, onReopen, reopening }: SubmissionConfirmationProps) {
  const failed = submission.status === 'failed'
  const Icon = failed ? AlertTriangle : CheckCircle2
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div
          className={
            failed
              ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground'
              : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success'
          }
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold" tabIndex={-1} id="submission-confirmation-title">
            {failed ? 'Content could not be prepared' : 'Content submitted'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {failed
              ? submission.error_message ?? 'Something went wrong while preparing the content.'
              : 'Your content is saved and prepared for analysis.'}
          </p>
        </div>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <Item label="Reference">
          <code className="font-mono text-base font-semibold">{shortId(submission.id)}</code>
        </Item>
        <Item label="Status">
          <SubmissionStatusBadge status={submission.status} />
        </Item>
        <Item label="Title">{submission.title}</Item>
        <Item label="Content type">{submission.content_type ? CONTENT_TYPE_LABELS[submission.content_type] : '—'}</Item>
        <Item label="Submitted">{submission.submitted_at ? formatDate(submission.submitted_at) : '—'}</Item>
        {submission.analysis_text_length !== null && (
          <Item label="Text prepared">{submission.analysis_text_length.toLocaleString()} characters</Item>
        )}
        {submission.attachments.length > 0 && (
          <Item label="Attached files">{submission.attachments.map((file) => file.original_filename).join(', ')}</Item>
        )}
      </dl>

      <div className="mt-6">
        <Notice tone="info">
          Submission is not approval, and AI analysis has not started. Analysis and human review are later steps. No compliance
          score exists for this content.
        </Notice>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {failed && (
          <Button onClick={onReopen} disabled={reopening}>
            {reopening ? 'Reopening…' : 'Reopen and fix'}
          </Button>
        )}
        <Button variant={failed ? 'outline' : 'default'} onClick={onSubmitAnother}>
          Submit another
        </Button>
        <Button asChild variant="ghost">
          <Link to="/">Back to Dashboard</Link>
        </Button>
      </div>
    </Card>
  )
}
