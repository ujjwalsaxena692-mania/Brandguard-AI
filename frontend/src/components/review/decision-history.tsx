import { History } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { REVIEW_STATUS_LABELS, formatDateTime } from '@/lib/review'
import type { ReviewHistoryEntry } from '@/types/review'
import { DecisionBadge, HistorySourceTag } from './review-badges'

/** Decision history, oldest first. Each entry shows the status change, who decided, when, and why. */
export function DecisionHistory({ history }: { history: readonly ReviewHistoryEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Decision history</CardTitle>
        <CardDescription>Human decisions in order, oldest first. Sample entries are labelled as demo history.</CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <EmptyState compact icon={History} title="No decisions yet" description="The decisions you record are listed here." />
        ) : (
          <ol className="space-y-4">
            {history.map((entry) => (
              <li key={entry.id} className="space-y-1.5 border-l-2 border-border pl-4">
                <div className="flex flex-wrap items-center gap-2">
                  <DecisionBadge decision={entry.decision} />
                  <span className="text-xs text-muted-foreground">
                    {REVIEW_STATUS_LABELS[entry.previousStatus]} → {REVIEW_STATUS_LABELS[entry.newStatus]}
                  </span>
                </div>
                <p className="text-sm">
                  <span className="font-medium">{entry.reviewer}</span> · <time dateTime={entry.at}>{formatDateTime(entry.at)}</time>
                </p>
                {entry.comment ? (
                  <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{entry.comment}</p>
                ) : (
                  <p className="text-sm italic text-muted-foreground">No comment.</p>
                )}
                <HistorySourceTag source={entry.source} />
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
