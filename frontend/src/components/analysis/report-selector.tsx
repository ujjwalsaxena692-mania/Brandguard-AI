import { Link } from 'react-router-dom'
import { formatDate } from '@/components/dashboard/format'
import { SubmissionStatusBadge } from '@/components/submission/submission-status'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getComplianceStatus } from '@/lib/analysis'
import { cn } from '@/lib/utils'
import type { AnalysisReport } from '@/types/analysis'
import type { ContentSubmission } from '@/types/submission'
import { ComplianceStatusBadge, DemoBadge } from './analysis-badges'

const MAX_SUBMISSIONS = 6

const reportLink = (submissionId: string) => `/reports?submission=${encodeURIComponent(submissionId)}`

interface ReportSelectorProps {
  reports: AnalysisReport[]
  /** Submitted items from the Content Submission store. They have no analysis results. */
  submissions: ContentSubmission[]
  activeId: string | null
}

const itemClass = (active: boolean) =>
  cn(
    'block rounded-md border p-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active ? 'border-primary bg-primary-soft' : 'border-border',
  )

export function ReportSelector({ reports, submissions, activeId }: ReportSelectorProps) {
  const submitted = submissions
    .filter((item) => item.status === 'submitted')
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))
  const shown = submitted.slice(0, MAX_SUBMISSIONS)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a result</CardTitle>
        <CardDescription>Open a demonstration report, or check what is happening with one of your submissions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section aria-labelledby="demo-reports-heading" className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 id="demo-reports-heading" className="text-sm font-semibold">
              Demonstration reports
            </h3>
            <DemoBadge />
          </div>
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports are available.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {reports.map((report) => (
                <li key={report.id}>
                  <Link
                    to={reportLink(report.submissionId)}
                    aria-current={report.submissionId === activeId ? 'page' : undefined}
                    className={itemClass(report.submissionId === activeId)}
                  >
                    <span className="block break-words text-sm font-medium">{report.title}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm tabular-nums text-muted-foreground">Score {report.overallScore}</span>
                      <ComplianceStatusBadge status={getComplianceStatus(report)} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="your-submissions-heading" className="space-y-3">
          <h3 id="your-submissions-heading" className="text-sm font-semibold">
            Your submissions
          </h3>
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing submitted yet. <Link to="/submit" className="font-medium text-primary underline-offset-4 hover:underline">Submit content</Link> to see it here.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                AI analysis is not available yet, so these have no results. Opening one shows its status only.
              </p>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((item) => (
                  <li key={item.id}>
                    <Link to={reportLink(item.id)} aria-current={item.id === activeId ? 'page' : undefined} className={itemClass(item.id === activeId)}>
                      <span className="block break-words text-sm font-medium">{item.title}</span>
                      <span className="mt-1 block font-mono text-xs text-muted-foreground">
                        {item.id} · {formatDate(item.submittedAt ?? item.updatedAt)}
                      </span>
                      <span className="mt-2 block">
                        <SubmissionStatusBadge status={item.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {submitted.length > shown.length && (
                <p className="text-xs text-muted-foreground">
                  Showing the {shown.length} most recent of {submitted.length} submissions.
                </p>
              )}
            </>
          )}
        </section>
      </CardContent>
    </Card>
  )
}
