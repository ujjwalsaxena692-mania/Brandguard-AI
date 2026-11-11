import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CATEGORY_LABELS } from '@/lib/correction'
import type { ChangeStats, CorrectionSuggestion, SuggestionStatus } from '@/types/correction'

interface CorrectionSummaryProps {
  suggestions: readonly CorrectionSuggestion[]
  statuses: Record<string, SuggestionStatus>
  counts: Record<SuggestionStatus, number>
  stats: ChangeStats
  manualEdits: boolean
}

export function CorrectionSummary({ suggestions, statuses, counts, stats, manualEdits }: CorrectionSummaryProps) {
  const accepted = suggestions.filter((item) => statuses[item.id] === 'accepted')
  const totalChanges = stats.inserted + stats.removed + stats.modified

  const tiles = [
    { label: 'Pending', value: counts.pending },
    { label: 'Accepted', value: counts.accepted },
    { label: 'Rejected', value: counts.rejected },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change summary</CardTitle>
        <CardDescription>A running summary of this working version compared with the original.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ul className="grid gap-3 sm:grid-cols-3" aria-label="Suggestion totals">
          {tiles.map(({ label, value }) => (
            <li key={label} className="rounded-md border border-border px-3 py-2.5 text-sm">
              <span className="font-semibold tabular-nums">{value}</span> {label.toLowerCase()}
            </li>
          ))}
        </ul>

        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="space-y-0.5">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Changes in the content</dt>
            <dd>
              {totalChanges === 0 ? (
                'No changes yet.'
              ) : (
                <>
                  {stats.inserted} inserted · {stats.removed} removed · {stats.modified} modified
                </>
              )}
            </dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Words</dt>
            <dd className="tabular-nums">
              +{stats.wordsAdded} added · −{stats.wordsRemoved} removed
            </dd>
          </div>
        </dl>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Accepted corrections</h3>
          {accepted.length === 0 ? (
            <p className="text-sm text-muted-foreground">No suggestions have been accepted.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {accepted.map((item) => (
                <li key={item.id}>
                  <span className="font-medium">{CATEGORY_LABELS[item.category]}:</span> {item.explanation}
                </li>
              ))}
            </ul>
          )}
        </div>

        {manualEdits && (
          <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm" role="status">
            The corrected content includes manual edits that did not come from an accepted suggestion. Suggestion statuses are not affected by manual edits.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
