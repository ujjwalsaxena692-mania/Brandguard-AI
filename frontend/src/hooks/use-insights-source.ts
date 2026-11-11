import { useMemo } from 'react'
import { getDemoSubmissions } from '@/data/demo/submissions'
import { useAnalysisReports } from '@/hooks/use-analysis-store'
import { useCorrectionCases } from '@/hooks/use-correction-cases'
import { useCorrectionSessions } from '@/hooks/use-correction-store'
import { useReviewRecords } from '@/hooks/use-review-store'
import { useSubmissions } from '@/hooks/use-submission-store'
import { buildHistoryEvents } from '@/lib/history'
import type { SourceData } from '@/lib/insights-source'
import type { HistoryEvent } from '@/types/insights'

// The sample submissions that ship with the demo data. A store record with any other ID was created in this tab.
// Read once: the IDs are fixed, and this only reads the demo layer, never the live store.
const DEMO_SUBMISSION_IDS: ReadonlySet<string> = new Set(getDemoSubmissions().map((submission) => submission.id))

/**
 * Subscribes to the existing in-memory stores (read-only) and returns them as one object.
 * It re-renders whenever a store changes, so History and Analytics stay current without a refresh.
 */
export function useInsightsSource(): SourceData {
  const submissions = useSubmissions()
  const reports = useAnalysisReports()
  const cases = useCorrectionCases()
  const sessions = useCorrectionSessions()
  const reviews = useReviewRecords()

  return useMemo(
    () => ({ submissions, demoSubmissionIds: DEMO_SUBMISSION_IDS, reports, cases, sessions, reviews }),
    [submissions, reports, cases, sessions, reviews],
  )
}

/** Every history event the stores can back with a timestamp, newest first. */
export function useHistoryEvents(): { source: SourceData; events: HistoryEvent[] } {
  const source = useInsightsSource()
  const events = useMemo(() => buildHistoryEvents(source), [source])
  return { source, events }
}
