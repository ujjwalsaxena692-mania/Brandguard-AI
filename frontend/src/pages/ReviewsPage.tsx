import { RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { NotReadySubmissions } from '@/components/review/not-ready-submissions'
import { RecentDecisions } from '@/components/review/recent-decisions'
import { ReviewActivity } from '@/components/review/review-activity'
import { ReviewQueue } from '@/components/review/review-queue'
import { ReviewStatsGrid } from '@/components/review/review-stats'
import { ConfirmDialog } from '@/components/submission/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { PageHeader } from '@/components/ui/page-header'
import { useAnalysisReports } from '@/hooks/use-analysis-store'
import { useCorrectionCases } from '@/hooks/use-correction-cases'
import { useCorrectionSessions } from '@/hooks/use-correction-store'
import { resetReviewDemoState, useReviewRecords } from '@/hooks/use-review-store'
import { useSubmissions } from '@/hooks/use-submission-store'
import { activityLog, buildReviewItem, computeStats, isReviewReady, recentDecisions, DEMO_STATE_NOTICE } from '@/lib/review'

const RECENT_LIMIT = 5

/**
 * Review & Approval dashboard (route: /reviews).
 *
 * Only items with an analysis result AND correction data are queued. Real submissions have neither,
 * so they are listed separately as "not ready" rather than being scored, queued or approved.
 */
export function ReviewsPage() {
  const records = useReviewRecords()
  const reports = useAnalysisReports()
  const cases = useCorrectionCases()
  const sessions = useCorrectionSessions()
  const submissions = useSubmissions()
  const [resetOpen, setResetOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const items = useMemo(() => records.map((record) => buildReviewItem(record, reports, cases, sessions)), [records, reports, cases, sessions])
  const ready = useMemo(() => items.filter(isReviewReady), [items])
  const readyRecords = useMemo(() => ready.map((item) => item.record), [ready])

  const stats = computeStats(readyRecords)
  const log = activityLog(readyRecords)
  const recent = recentDecisions(readyRecords, RECENT_LIMIT)

  const queuedSubmissionIds = new Set(ready.map((item) => item.record.submissionId))
  const notReady = submissions.filter((item) => item.status === 'submitted' && !queuedSubmissionIds.has(item.id))

  const firstOpen = ready.find((item) => item.record.status === 'pending') ?? ready[0]
  const hasSessionDecisions = log.some(({ entry }) => entry.source === 'session')

  const reset = () => {
    resetReviewDemoState()
    setResetOpen(false)
    setFeedback('Demo decisions were reset. The demo review records are back to their starting state.')
  }

  return (
    <>
      <PageHeader
        title="Review & Approval"
        description="A human reviewer makes the final decision on analysed content. The AI can recommend corrections, but it never approves anything."
        badge="Demo data"
        actions={
          <>
            <Button variant="outline" onClick={() => setResetOpen(true)} disabled={!hasSessionDecisions}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reset demo decisions
            </Button>
            {firstOpen && (
              <Button asChild>
                <Link to={`/reviews/${encodeURIComponent(firstOpen.record.id)}`}>Open a demo review record</Link>
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-6">
        <Notice tone="info">
          Demo data: the review records, analysis results and correction suggestions are fictional examples, and the sample history is not
          from a real person. {DEMO_STATE_NOTICE}
        </Notice>

        {feedback && <Notice tone="success">{feedback}</Notice>}

        <ReviewStatsGrid stats={stats} />

        <ReviewQueue items={ready} />

        <div className="grid gap-6 lg:grid-cols-2">
          <RecentDecisions entries={recent} items={ready} />
          <ReviewActivity stats={stats} log={log} />
        </div>

        <NotReadySubmissions submissions={notReady} />
      </div>

      <ConfirmDialog
        open={resetOpen}
        title="Reset demo decisions?"
        description="This discards every decision recorded in this browser tab and restores the demo review records to their starting state. Nothing is stored anywhere else."
        confirmLabel="Reset demo decisions"
        onConfirm={reset}
        onClose={() => setResetOpen(false)}
      />
    </>
  )
}
