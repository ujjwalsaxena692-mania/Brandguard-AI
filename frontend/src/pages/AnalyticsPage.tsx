import { BarChart3, Download, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ChartCard } from '@/components/analytics/chart-card'
import { ComplianceTrendPanel } from '@/components/analytics/compliance-trend-panel'
import { DistributionChart } from '@/components/analytics/distribution-chart'
import { InsightsPanel } from '@/components/analytics/insights-panel'
import { KpiGrid } from '@/components/analytics/kpi-grid'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DateRangeFilter } from '@/components/ui/date-range-filter'
import { EmptyState } from '@/components/ui/empty-state'
import { Notice } from '@/components/ui/notice'
import { PageHeader } from '@/components/ui/page-header'
import { useInsightsSource } from '@/hooks/use-insights-source'
import { computeAnalytics } from '@/lib/analytics'
import { downloadTextFile } from '@/lib/csv'
import { DEFAULT_RANGE } from '@/lib/date-range'
import { analyticsCsv, analyticsFileName } from '@/lib/insights-export'
import type { DateRangeFilter as DateRangeValue } from '@/types/insights'

const SEVERITY_COLOURS: Record<string, string> = {
  critical: '--primary-active',
  high: '--primary',
  medium: '--chart-3',
  low: '--chart-2',
}

const REVIEW_COLOURS: Record<string, string> = {
  approved: '--success',
  rejected: '--primary',
  changes_requested: '--chart-3',
  pending: '--chart-2',
}

interface Feedback {
  tone: 'success' | 'error'
  message: string
}

/**
 * Brand Analytics (route: /analytics).
 *
 * Every figure is calculated from the in-memory stores for the selected date range. The page reads the
 * stores through hooks, so it updates when they change, and it never writes to them.
 */
export function AnalyticsPage() {
  const source = useInsightsSource()
  const [range, setRange] = useState<DateRangeValue>(DEFAULT_RANGE)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  // Recomputed when a store or the filter changes. `Date.now()` is only read for "last N days" presets.
  const snapshot = useMemo(() => computeAnalytics(source, range, Date.now()), [source, range])

  const changeRange = (next: DateRangeValue) => {
    setRange(next)
    setFeedback(null)
  }

  const exportReport = () => {
    const ok = downloadTextFile(analyticsFileName(snapshot.range.label), analyticsCsv(snapshot))
    setFeedback(
      ok
        ? { tone: 'success', message: `Exported the analytics report for “${snapshot.range.label}” to CSV.` }
        : { tone: 'error', message: 'The export could not be started in this browser.' },
    )
  }

  return (
    <>
      <PageHeader
        title="Brand Analytics"
        description="Compliance, review and content metrics for the records held in this browser tab."
        actions={
          <Button variant="outline" onClick={exportReport}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Export report (CSV)
          </Button>
        }
      />

      <Notice className="mb-4">
        These figures are calculated from temporary in-memory data and reset when you refresh the page. Analysis scores and review records are demo
        data (no analysis engine or database exists yet), and each metric is labelled with its data origin. This is not a persistent audit log.
      </Notice>

      {feedback && (
        <Notice tone={feedback.tone} className="mb-4">
          {feedback.message}
        </Notice>
      )}

      <Card className="mb-6 p-4">
        <form aria-label="Analytics filters" onSubmit={(event) => event.preventDefault()}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DateRangeFilter idPrefix="analytics" value={range} error={snapshot.range.error} onChange={changeRange} />
          </div>
          {snapshot.range.error && (
            <p id="analytics-range-error" role="alert" className="mt-3 text-sm text-primary">
              {snapshot.range.error}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              Period: {snapshot.range.label}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={() => changeRange(DEFAULT_RANGE)} disabled={range.preset === 'all'}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reset filters
            </Button>
          </div>
        </form>
      </Card>

      {snapshot.noRecords ? (
        <Card>
          <EmptyState
            icon={BarChart3}
            title="No records to analyse yet"
            description="Metrics appear once content has been submitted or analysed. Nothing is estimated or filled in."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <KpiGrid kpis={snapshot.kpis} />

          {snapshot.coverage.undatedExcluded > 0 && (
            <Notice>
              {snapshot.coverage.undatedExcluded} {snapshot.coverage.undatedExcluded === 1 ? 'record has' : 'records have'} no usable date, so{' '}
              {snapshot.coverage.undatedExcluded === 1 ? 'it is' : 'they are'} only counted when “All available time” is selected.
            </Notice>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              className="lg:col-span-2"
              title="Compliance trend"
              description="The score of each analysis, by the time it was completed. One point per real analysis; nothing is averaged or filled in."
              source={snapshot.trend.points.length > 0 ? snapshot.trend.source : 'none'}
            >
              <ComplianceTrendPanel points={snapshot.trend.points} />
            </ChartCard>

            <ChartCard
              title="Content status"
              description="Every record in the period, by its current stage. Only stages that have records are shown. “Awaiting analysis” is not tracked as a separate state."
              source={snapshot.status.total > 0 ? snapshot.status.source : 'none'}
            >
              <DistributionChart
                label="Content status distribution"
                distribution={snapshot.status}
                unit="records"
                empty={{ title: 'No content in this period', description: 'Status counts appear once content has been saved or submitted.' }}
              />
            </ChartCard>

            <ChartCard
              title="Issue severity"
              description="Contradicted and unsupported findings from analysis results. Supported claims are not counted as issues, and “unsupported” does not mean false."
              source={snapshot.coverage.issueCount > 0 ? snapshot.severity.source : 'none'}
            >
              <DistributionChart
                label="Issue severity distribution"
                distribution={snapshot.severity}
                orientation="vertical"
                colorFor={(key) => SEVERITY_COLOURS[key] ?? '--chart-1'}
                unit="findings"
                empty={{ title: 'No issues in this period', description: 'No contradicted or unsupported findings were found in the analysis results in range.' }}
              />
            </ChartCard>

            <ChartCard
              title="Content type"
              description="Submitted content (drafts excluded), by the type chosen at submission."
              source={snapshot.contentType.total > 0 ? snapshot.contentType.source : 'none'}
            >
              <DistributionChart
                label="Content type distribution"
                distribution={snapshot.contentType}
                unit="submissions"
                empty={{ title: 'No submissions in this period', description: 'Type counts appear once content has been submitted.' }}
              />
            </ChartCard>

            <ChartCard
              title="Review decisions"
              description="The current state of each review record. Only a human reviewer can approve or reject; AI scores never do."
              source={snapshot.reviewDecisions.total > 0 ? snapshot.reviewDecisions.source : 'none'}
            >
              <DistributionChart
                label="Review decision distribution"
                distribution={snapshot.reviewDecisions}
                orientation="vertical"
                colorFor={(key) => REVIEW_COLOURS[key] ?? '--chart-1'}
                unit="reviews"
                empty={{ title: 'No review records in this period', description: 'Review counts appear once content reaches human review.' }}
              />
            </ChartCard>
          </div>

          <InsightsPanel insights={snapshot.insights} />
        </div>
      )}
    </>
  )
}
