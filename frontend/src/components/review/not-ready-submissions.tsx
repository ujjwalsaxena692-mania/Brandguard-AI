import { Hourglass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDate } from '@/components/dashboard/format'
import { SubmissionStatusBadge } from '@/components/submission/submission-status'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CONTENT_TYPE_LABELS } from '@/lib/submission'
import type { ContentSubmission } from '@/types/submission'

/**
 * Your own submissions that are not in the queue, with the reason. A submission only becomes
 * review-ready once it has an analysis result and correction data; none is queued, scored or approved here before that.
 */
export function NotReadySubmissions({ submissions }: { submissions: ContentSubmission[] }) {
  if (submissions.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hourglass className="h-4 w-4" aria-hidden="true" />
          Submissions not ready for review
        </CardTitle>
        <CardDescription>
          These have been submitted but have no analysis result or correction data yet (no analysis engine is connected), so there is nothing to
          review and they are not in the queue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {submissions.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{item.id}</span> · {item.contentType ? CONTENT_TYPE_LABELS[item.contentType] : 'No content type'} · Submitted{' '}
                  {formatDate(item.submittedAt ?? item.updatedAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <SubmissionStatusBadge status={item.status} />
                <Link
                  to={`/reports?submission=${encodeURIComponent(item.id)}`}
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Check status
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
