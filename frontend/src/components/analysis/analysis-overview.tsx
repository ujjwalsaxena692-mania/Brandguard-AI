import { CheckCircle2, HelpCircle, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { CONTENT_TYPE_LABELS } from '@/lib/submission'
import { countClaims, getComplianceStatus } from '@/lib/analysis'
import type { AnalysisReport } from '@/types/analysis'
import { ComplianceStatusBadge, DemoBadge } from './analysis-badges'
import { ScoreRing } from './score-ring'

const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
const formatDateTime = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : dateTime.format(date)
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm">{children}</dd>
    </div>
  )
}

export function AnalysisOverview({ report }: { report: AnalysisReport }) {
  const status = getComplianceStatus(report)
  const counts = countClaims(report.claims)
  const tiles = [
    { label: 'Supported', value: counts.supported, icon: CheckCircle2, tone: 'text-success' },
    { label: 'Contradicted', value: counts.contradicted, icon: XCircle, tone: 'text-primary' },
    { label: 'Unsupported', value: counts.unsupported, icon: HelpCircle, tone: 'text-warning' },
  ] as const

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-center">
        <div className="flex flex-col items-center gap-3">
          <ScoreRing score={report.overallScore} status={status} />
          <ComplianceStatusBadge status={status} />
        </div>

        <div className="min-w-0 flex-1 space-y-5">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-xl font-semibold tracking-tight">{report.title}</h2>
              {report.isDemo && <DemoBadge />}
            </div>
            {report.isDemo && (
              <p className="text-sm text-muted-foreground">
                Demonstration result with fictional content and sample references. It was not produced by an AI analysis.
              </p>
            )}
          </div>

          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Item label="Submission ID">
              <code className="font-mono text-xs">{report.submissionId}</code>
            </Item>
            <Item label="Content type">{CONTENT_TYPE_LABELS[report.contentType]}</Item>
            <Item label="Submitted">{formatDateTime(report.submittedAt)}</Item>
            <Item label="Analysed">{formatDateTime(report.analysedAt)}</Item>
          </dl>

          <ul className="grid gap-3 sm:grid-cols-3" aria-label="Claim totals">
            {tiles.map(({ label, value, icon: Icon, tone }) => (
              <li key={label} className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5">
                <Icon className={`h-5 w-5 shrink-0 ${tone}`} aria-hidden="true" />
                <span className="text-sm">
                  <span className="font-semibold tabular-nums">{value}</span> {label.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  )
}
