import { ClipboardCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useReviewRecords } from '@/hooks/use-review-store'
import { ReviewStatusBadge } from './review-badges'

/**
 * A link from Analysis Results or the Correction Editor to the matching review record.
 * It renders nothing when the content has no review record, so no link leads to an empty page.
 */
export function ReviewLinkCard({ submissionId, from }: { submissionId: string; from: 'analysis' | 'correction' }) {
  const record = useReviewRecords().find((item) => item.submissionId === submissionId)
  if (!record) return null

  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">Human review</p>
          <ReviewStatusBadge status={record.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {from === 'correction'
            ? 'Marking content ready for human review does not approve it. A reviewer makes the final decision in Review & Approval.'
            : 'A human reviewer makes the final decision. The analysis and its score do not approve content.'}
        </p>
      </div>
      <Button asChild size="sm" variant="outline" className="shrink-0">
        <Link to={`/reviews/${encodeURIComponent(record.id)}`}>
          <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
          Open in Review & Approval
        </Link>
      </Button>
    </Card>
  )
}
