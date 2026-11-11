import { Lightbulb } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataSourceBadge } from '@/components/ui/data-source-badge'
import type { AnalyticsInsight } from '@/types/insights'

/** Plain statements computed from the records in the selected period. No generated text, and no claim without enough data. */
export function InsightsPanel({ insights }: { insights: AnalyticsInsight[] }) {
  return (
    <Card>
      <CardHeader className="pb-2 sm:pb-2">
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" aria-hidden="true" />
          Insights
        </CardTitle>
        <CardDescription>
          Calculated directly from the records in the selected period. Where there is too little data, the insight says so instead of guessing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 md:grid-cols-2">
          {insights.map((insight) => (
            <li key={insight.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-sm font-semibold">{insight.title}</h3>
                {insight.text !== null && <DataSourceBadge source={insight.source} />}
              </div>
              {insight.text !== null ? (
                <p className="mt-1.5 text-sm">{insight.text}</p>
              ) : (
                <p className="mt-1.5 text-sm text-muted-foreground">Not enough data. {insight.unavailableReason}</p>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
