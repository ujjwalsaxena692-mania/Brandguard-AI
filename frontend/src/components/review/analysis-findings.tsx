import { Link } from 'react-router-dom'
import { ClassificationBadge, ComplianceStatusBadge, SeverityBadge } from '@/components/analysis/analysis-badges'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CLASSIFICATION_LABELS, CLASSIFICATIONS, SEVERITIES, SEVERITY_LABELS, countClaims, getComplianceStatus, sortBySeverity } from '@/lib/analysis'
import type { AnalysisReport } from '@/types/analysis'
import { AiGeneratedTag } from './review-badges'

const MAX_FINDINGS = 6

/** B. Analysis summary. Everything here is AI-generated (demo) output and is labelled so. */
export function AnalysisFindings({ report }: { report: AnalysisReport }) {
  const counts = countClaims(report.claims)
  const issues = report.claims.filter((claim) => claim.classification !== 'supported')
  const keyFindings = sortBySeverity(
    issues.filter((claim) => claim.classification === 'contradicted' || claim.severity === 'critical' || claim.severity === 'high'),
  ).slice(0, MAX_FINDINGS)

  return (
    <Card>
      <CardHeader className="sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Analysis summary</CardTitle>
          <CardDescription>
            {report.isDemo ? 'Demo analysis: hand-written sample findings, not AI output.' : 'Produced by the analysis step.'} A reviewer weighs these; they do not decide.
          </CardDescription>
        </div>
        <AiGeneratedTag />
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI compliance score</p>
            <p className="text-2xl font-semibold tabular-nums">
              {report.overallScore}
              <span className="text-sm font-normal text-muted-foreground">/100</span>
            </p>
          </div>
          <ComplianceStatusBadge status={getComplianceStatus(report)} />
          <p className="max-w-md text-xs text-muted-foreground">
            This score is informational. It is not an approval, and a high score does not replace the reviewer’s decision.
          </p>
        </div>

        <section aria-labelledby="claim-counts-heading" className="space-y-2">
          <h3 id="claim-counts-heading" className="text-sm font-semibold">
            Claims
          </h3>
          <ul className="grid grid-cols-3 gap-3">
            {CLASSIFICATIONS.map((classification) => (
              <li key={classification} className="rounded-md border border-border p-3">
                <p className="text-2xl font-semibold tabular-nums">{counts[classification]}</p>
                <p className="text-xs text-muted-foreground">{CLASSIFICATION_LABELS[classification]}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="severity-heading" className="space-y-2">
          <h3 id="severity-heading" className="text-sm font-semibold">
            Severity of issues
          </h3>
          <p className="text-xs text-muted-foreground">Contradicted and unsupported claims only.</p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SEVERITIES.map((severity) => (
              <li key={severity} className="rounded-md border border-border p-3">
                <p className="text-xl font-semibold tabular-nums">{issues.filter((claim) => claim.severity === severity).length}</p>
                <p className="text-xs text-muted-foreground">{SEVERITY_LABELS[severity]}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="findings-heading" className="space-y-2">
          <h3 id="findings-heading" className="text-sm font-semibold">
            Important findings and guideline violations
          </h3>
          {keyFindings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contradicted claims and no high-severity issues were found.</p>
          ) : (
            <ul className="space-y-3">
              {keyFindings.map((claim) => (
                <li key={claim.id} className="space-y-1.5 rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <ClassificationBadge classification={claim.classification} />
                    <SeverityBadge severity={claim.severity} />
                  </div>
                  <p className="break-words text-sm font-medium">“{claim.text}”</p>
                  <p className="text-sm text-muted-foreground">{claim.explanation}</p>
                  {claim.matched && (
                    <p className="text-xs text-muted-foreground">
                      Guideline or knowledge: {claim.matched.title} ({claim.matched.category})
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link
            to={`/reports?submission=${encodeURIComponent(report.submissionId)}`}
            className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Open the full Analysis Results
          </Link>
        </section>
      </CardContent>
    </Card>
  )
}
