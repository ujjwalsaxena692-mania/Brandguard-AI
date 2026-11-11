import { Activity } from 'lucide-react'
import { formatRelative } from '@/components/dashboard/format'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { DEMO_STATE_NOTICE, REVIEW_STATUS_LABELS, REVIEW_STATUSES, type ReviewStats, type DecisionLogEntry } from '@/lib/review'
import type { ReviewStatus } from '@/types/review'

const SEGMENT_COLOURS: Record<ReviewStatus, string> = {
  pending: 'bg-warning',
  changes_requested: 'bg-primary/60',
  approved: 'bg-success',
  rejected: 'bg-primary',
}

const COUNT_KEY: Record<ReviewStatus, keyof ReviewStats> = {
  pending: 'pending',
  changes_requested: 'changesRequested',
  approved: 'approved',
  rejected: 'rejected',
}

interface ReviewActivityProps {
  stats: ReviewStats
  /** Every history entry, newest first. */
  log: DecisionLogEntry[]
}

/** How the queue is split by status, and how much human activity there has been. */
export function ReviewActivity({ stats, log }: ReviewActivityProps) {
  const sessionCount = log.filter(({ entry }) => entry.source === 'session').length
  const sampleCount = log.length - sessionCount
  const latest = log[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review activity</CardTitle>
        <CardDescription>The queue by status, and the decisions recorded so far.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats.total === 0 ? (
          <EmptyState compact icon={Activity} title="No activity" description="Activity appears once items are in the queue." />
        ) : (
          <>
            <div
              className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={REVIEW_STATUSES.map((status) => `${REVIEW_STATUS_LABELS[status]}: ${stats[COUNT_KEY[status]]}`).join(', ')}
            >
              {REVIEW_STATUSES.map((status) => {
                const count = stats[COUNT_KEY[status]]
                return count > 0 ? <div key={status} className={SEGMENT_COLOURS[status]} style={{ width: `${(count / stats.total) * 100}%` }} /> : null
              })}
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {REVIEW_STATUSES.map((status) => (
                <li key={status} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${SEGMENT_COLOURS[status]}`} aria-hidden="true" />
                  <span className="text-muted-foreground">{REVIEW_STATUS_LABELS[status]}</span>
                  <span className="ml-auto font-medium tabular-nums">{stats[COUNT_KEY[status]]}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-border pt-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Decisions recorded in this session</dt>
                <dd className="font-medium tabular-nums">{sessionCount}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Sample (demo) history entries</dt>
                <dd className="font-medium tabular-nums">{sampleCount}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Latest activity</dt>
                <dd className="font-medium">{latest ? formatRelative(latest.entry.at) : 'None yet'}</dd>
              </div>
            </dl>
          </>
        )}
        <p className="text-xs text-muted-foreground">{DEMO_STATE_NOTICE}</p>
      </CardContent>
    </Card>
  )
}
