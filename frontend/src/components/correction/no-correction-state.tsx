import { FileSearch, PenLine } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDate } from '@/components/dashboard/format'
import { SubmissionStatusBadge } from '@/components/submission/submission-status'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { CONTENT_TYPE_LABELS } from '@/lib/submission'
import type { ContentSubmission } from '@/types/submission'

/** A real submission with no correction data. No suggestions are made up, and none are shown. */
export function NoCorrectionDataState({ submission }: { submission: ContentSubmission }) {
  const isDraft = submission.status === 'draft'
  return (
    <Card className="space-y-6 p-5 sm:p-6">
      <div className="space-y-2">
        <h2 className="break-words text-xl font-semibold tracking-tight">{submission.title}</h2>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono">{submission.id}</span> · {submission.contentType ? CONTENT_TYPE_LABELS[submission.contentType] : 'No content type'} ·{' '}
          {isDraft ? `Draft saved ${formatDate(submission.updatedAt)}` : `Submitted ${formatDate(submission.submittedAt ?? submission.updatedAt)}`}
        </p>
        <SubmissionStatusBadge status={submission.status} />
      </div>
      <EmptyState
        compact
        icon={PenLine}
        title={isDraft ? 'This draft has not been submitted' : 'No correction suggestions are available'}
        description={
          isDraft
            ? 'Submit the draft first. Correction suggestions need an analysis result, and none exists for a draft.'
            : 'This submission has no analysis report and no correction data, and AI correction is not available in this version. Nothing is shown rather than inventing suggestions. Check Analysis Results for its current status.'
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild size="sm">
              <Link to={`/reports?submission=${encodeURIComponent(submission.id)}`}>Back to Analysis Results</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/corrections">See a demo correction</Link>
            </Button>
          </div>
        }
      />
    </Card>
  )
}

export function CorrectionNotFoundState({ id }: { id: string }) {
  return (
    <Card>
      <EmptyState
        icon={FileSearch}
        title="Submission not found"
        description={`No submission or correction case matches “${id}”. The editor only opens for a valid submission.`}
        action={
          <Button asChild size="sm">
            <Link to="/reports">Back to Analysis Results</Link>
          </Button>
        }
      />
    </Card>
  )
}
