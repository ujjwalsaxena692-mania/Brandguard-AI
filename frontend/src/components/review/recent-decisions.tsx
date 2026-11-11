import { Gavel } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatRelative } from '@/components/dashboard/format'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { itemTitle, type DecisionLogEntry, type ReviewItem } from '@/lib/review'
import { DecisionBadge, HistorySourceTag } from './review-badges'

interface RecentDecisionsProps {
  entries: DecisionLogEntry[]
  items: readonly ReviewItem[]
}

/** Decisions that changed an item's status, newest first. Sample entries are labelled as such. */
export function RecentDecisions({ entries, items }: RecentDecisionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent decisions</CardTitle>
        <CardDescription>Approvals, rejections and change requests, newest first.</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <EmptyState compact icon={Gavel} title="No decisions yet" description="Decisions you record will appear here." />
        ) : (
          <ul className="divide-y divide-border">
            {entries.map(({ record, entry }) => {
              const item = items.find((candidate) => candidate.record.id === record.id)
              return (
                <li key={entry.id} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <DecisionBadge decision={entry.decision} />
                    <Link
                      to={`/reviews/${encodeURIComponent(record.id)}`}
                      className="text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {item ? itemTitle(item) : record.submissionId}
                    </Link>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {entry.reviewer} · {formatRelative(entry.at)}
                  </p>
                  {entry.comment && <p className="line-clamp-2 break-words text-sm text-muted-foreground">{entry.comment}</p>}
                  <HistorySourceTag source={entry.source} />
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
