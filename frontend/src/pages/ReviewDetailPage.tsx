import { ArrowLeft, FileSearch, PenLine } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnalysisFindings } from '@/components/review/analysis-findings'
import { ContentInformation } from '@/components/review/content-information'
import { CorrectionProgressPanel } from '@/components/review/correction-progress-panel'
import { DecisionDialog } from '@/components/review/decision-dialog'
import { DecisionHistory } from '@/components/review/decision-history'
import { DecisionPanel } from '@/components/review/decision-panel'
import { DemoRecordBadge, ReviewStatusBadge } from '@/components/review/review-badges'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Notice } from '@/components/ui/notice'
import { useAnalysisReports } from '@/hooks/use-analysis-store'
import { useAuth } from '@/hooks/use-auth'
import { useCorrectionCases } from '@/hooks/use-correction-cases'
import { useCorrectionSessions } from '@/hooks/use-correction-store'
import { recordDecision, useReviewRecords } from '@/hooks/use-review-store'
import { DECISION_LABELS, DEMO_STATE_NOTICE, buildReviewItem, correctionProgress, isReviewReady, itemTitle } from '@/lib/review'
import { getDisplayName } from '@/lib/user'
import type { ReviewDecisionKind } from '@/types/review'

const FALLBACK_REVIEWER = 'Reviewer (this session)'

function ReviewNotFound({ id }: { id: string }) {
  return (
    <Card>
      <EmptyState
        icon={FileSearch}
        title="Review record not found"
        description={`No review record matches “${id}”. It may not exist, or the demo records were reset by refreshing the page.`}
        action={
          <Button asChild size="sm">
            <Link to="/reviews">Back to Review & Approval</Link>
          </Button>
        }
      />
    </Card>
  )
}

/** A record that exists but lacks analysis or correction data. Nothing is invented to fill the gap. */
function NotReviewReady({ title }: { title: string }) {
  return (
    <Card>
      <EmptyState
        icon={FileSearch}
        title="This item is not ready for review"
        description={`“${title}” has no analysis result or correction data yet. A human review needs both, and none is generated automatically.`}
        action={
          <Button asChild size="sm">
            <Link to="/reviews">Back to Review & Approval</Link>
          </Button>
        }
      />
    </Card>
  )
}

interface Feedback {
  tone: 'success' | 'info'
  message: string
}

/** Review detail (route: /reviews/:reviewId). */
export function ReviewDetailPage() {
  const { reviewId = '' } = useParams<{ reviewId: string }>()
  const { user } = useAuth()
  const records = useReviewRecords()
  const reports = useAnalysisReports()
  const cases = useCorrectionCases()
  const sessions = useCorrectionSessions()
  const [decision, setDecision] = useState<ReviewDecisionKind | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const record = records.find((item) => item.id === reviewId)
  const item = useMemo(() => (record ? buildReviewItem(record, reports, cases, sessions) : null), [record, reports, cases, sessions])

  const reviewer = getDisplayName(user) ?? FALLBACK_REVIEWER

  const back = (
    <Button asChild variant="outline" size="sm">
      <Link to="/reviews">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Review & Approval
      </Link>
    </Button>
  )

  if (!record || !item) {
    return (
      <>
        <div className="mb-6">{back}</div>
        <ReviewNotFound id={reviewId} />
      </>
    )
  }

  if (!isReviewReady(item) || !item.report) {
    return (
      <>
        <div className="mb-6">{back}</div>
        <NotReviewReady title={itemTitle(item)} />
      </>
    )
  }

  const { report } = item
  const progress = correctionProgress(item)
  const title = itemTitle(item)
  const lastDecision = record.history[record.history.length - 1]

  const cautions: string[] = []
  if (progress && progress.unresolved > 0) {
    cautions.push(`${progress.unresolved} correction ${progress.unresolved === 1 ? 'suggestion is' : 'suggestions are'} still unresolved.`)
  }
  const contradicted = report.claims.filter((claim) => claim.classification === 'contradicted').length
  if (contradicted > 0) {
    cautions.push(
      `The analysis found ${contradicted} contradicted ${contradicted === 1 ? 'claim' : 'claims'} in the original content. It is not re-run on the corrected version.`,
    )
  }

  // Returns an error for the dialog to show, or null when the decision was recorded.
  const confirm = (comment: string): string | null => {
    if (!decision) return 'No decision is selected.'
    const result = recordDecision({ reviewId: record.id, decision, comment, reviewer, expectedStatus: record.status })
    if (!result.ok) return result.message
    setDecision(null)
    setFeedback({
      tone: 'success',
      message:
        decision === 'keep_pending'
          ? 'Kept pending: the status did not change, and a note was added to the history.'
          : `Decision recorded: ${DECISION_LABELS[decision].toLowerCase()}. ${DEMO_STATE_NOTICE}`,
    })
    return null
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-words text-2xl font-semibold tracking-tight">{title}</h1>
            {record.isDemo && <DemoRecordBadge />}
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono text-xs">{record.id}</span> · Submission <span className="font-mono text-xs">{record.submissionId}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Review status</span>
            <ReviewStatusBadge status={record.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {back}
          <Button asChild variant="outline" size="sm">
            <Link to={`/reports?submission=${encodeURIComponent(record.submissionId)}`}>
              <FileSearch className="h-4 w-4" aria-hidden="true" />
              Analysis Results
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={`/corrections?submission=${encodeURIComponent(record.submissionId)}`}>
              <PenLine className="h-4 w-4" aria-hidden="true" />
              Correction Editor
            </Link>
          </Button>
        </div>
      </header>

      <Notice tone="info">
        {record.isDemo && 'Demo record: the content, analysis and suggestions are fictional examples. '}
        Items labelled “AI-generated” are findings and suggestions. Everything under “Your decision” and “Decision history” is a human decision.{' '}
        {DEMO_STATE_NOTICE}
      </Notice>

      {feedback && <Notice tone={feedback.tone}>{feedback.message}</Notice>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ContentInformation item={item} />
          <AnalysisFindings report={report} />
          <CorrectionProgressPanel progress={progress} submissionId={record.submissionId} />
        </div>
        <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <DecisionPanel
            status={record.status}
            reviewer={reviewer}
            lastDecisionAt={lastDecision ? lastDecision.at : null}
            onDecide={(next) => {
              setFeedback(null)
              setDecision(next)
            }}
          />
          <DecisionHistory history={record.history} />
        </div>
      </div>

      {decision && (
        <DecisionDialog key={decision} decision={decision} contentTitle={title} cautions={cautions} onConfirm={confirm} onClose={() => setDecision(null)} />
      )}
    </div>
  )
}
