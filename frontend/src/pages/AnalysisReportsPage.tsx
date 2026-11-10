import { FileSearch } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnalysisOverview } from '@/components/analysis/analysis-overview'
import { AnalysisSummary } from '@/components/analysis/analysis-summary'
import { ClaimsBrowser } from '@/components/analysis/claims-browser'
import { AwaitingAnalysisState, ReportNotFoundState } from '@/components/analysis/no-analysis-state'
import { ReportSelector } from '@/components/analysis/report-selector'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Notice } from '@/components/ui/notice'
import { PageHeader } from '@/components/ui/page-header'
import { useAnalysisReports } from '@/hooks/use-analysis-store'
import { useSubmissions } from '@/hooks/use-submission-store'

/**
 * Analysis Results (route: /reports).
 *
 * `?submission=<id>` selects what to show. With no parameter the first demo report is shown.
 * Demo reports are fictional; a real submission never gets generated results.
 */
export function AnalysisReportsPage() {
  const [params] = useSearchParams()
  const reports = useAnalysisReports()
  const submissions = useSubmissions()

  const selectedId = params.get('submission')
  const report = selectedId ? reports.find((item) => item.submissionId === selectedId) : reports[0]
  const submission = selectedId && !report ? submissions.find((item) => item.id === selectedId) : undefined
  const activeId = report?.submissionId ?? selectedId

  let content: ReactNode
  if (report) {
    content = (
      <>
        <AnalysisOverview report={report} />
        {/* Keyed so filters reset when a different report is opened. */}
        <ClaimsBrowser key={report.id} claims={report.claims} isDemo={report.isDemo} />
        <AnalysisSummary report={report} />
      </>
    )
  } else if (submission) {
    content = <AwaitingAnalysisState submission={submission} />
  } else if (selectedId) {
    content = <ReportNotFoundState id={selectedId} />
  } else {
    content = (
      <Card>
        <EmptyState
          icon={FileSearch}
          title="No analysis results yet"
          description="Results appear here once content has been analysed. Submit content to get started."
          action={
            <Button asChild size="sm">
              <Link to="/submit">Submit Content</Link>
            </Button>
          }
        />
      </Card>
    )
  }

  return (
    <>
      <PageHeader
        title="Analysis Results"
        description="See how content measures up against approved brand knowledge: which claims are supported, which contradict it, and which lack evidence."
        badge="Demo data"
      />

      <div className="space-y-6">
        <Notice tone="info">
          Demo data: no analysis engine is connected. The reports below are fictional examples with sample references, not AI
          output. Your own submissions show their status only until analysis is available.
        </Notice>

        <ReportSelector reports={reports} submissions={submissions} activeId={activeId} />

        {content}
      </div>
    </>
  )
}
