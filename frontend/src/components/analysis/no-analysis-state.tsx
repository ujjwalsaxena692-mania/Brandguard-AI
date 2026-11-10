import { Clock, FileSearch } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDate } from '@/components/dashboard/format'
import { SubmissionStatusBadge } from '@/components/submission/submission-status'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { CONTENT_TYPE_LABELS } from '@/lib/submission'
import type { ContentSubmission } from '@/types/submission'

/** Shown for a real submission: it is recorded, but there are no results and none are made up. */
export function AwaitingAnalysisState({ submission }: { submission: ContentSubmission }) {
  const isDraft = submission.status === 'draft'
  return (
    <Card className="space-y-6 p-5 sm:p-6">
      <div className="space-y-2">
        <h2 className="break-words text-xl font-semibold tracking-tight">{submission.title}</h2>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono">{submission.id}</span> ·{' '}
          {submission.contentType ? CONTENT_TYPE_LABELS[submission.contentType] : 'No content type'} ·{' '}
          {isDraft ? `Draft saved ${formatDate(submission.updatedAt)}` : `Submitted ${formatDate(submission.submittedAt ?? submission.updatedAt)}`}
        </p>
        <SubmissionStatusBadge status={submission.status} />
      </div>
      <EmptyState
        compact
        icon={Clock}
        title={isDraft ? 'This draft has not been submitted' : 'No analysis result yet'}
        description={
          isDraft
            ? 'Submit the draft to record it for review. Analysis results will appear here once an analysis engine is connected.'
            : 'AI analysis is not available in this version, so there is no score, no claim classification and no approval for this content. Nothing is shown rather than inventing results.'
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild size="sm">
              <Link to="/submit">{isDraft ? 'Go to Submit Content' : 'Submit more content'}</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/reports">View a demo report</Link>
            </Button>
          </div>
        }
      />
    </Card>
  )
}

export function ReportNotFoundState({ id }: { id: string }) {
  return (
    <Card>
      <EmptyState
        icon={FileSearch}
        title="Result not found"
        description={`No analysis result or submission matches “${id}”.`}
        action={
          <Button asChild size="sm">
            <Link to="/reports">Back to results</Link>
          </Button>
        }
      />
    </Card>
  )
}
