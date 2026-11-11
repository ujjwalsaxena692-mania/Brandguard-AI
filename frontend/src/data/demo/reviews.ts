/**
 * DEMO DATA LAYER for Review & Approval.
 *
 * Fictional review records for the demonstration analysis reports and correction cases
 * (SUB-DEMO-0101 to 0103). They carry no content of their own: the content, scores and findings
 * come from those modules. The sample history entries below are NOT decisions by a real person: the
 * reviewer is a labelled placeholder, and every entry is marked `demo_seed` so the UI shows it as a sample.
 *
 * Real submissions (SUB-YYYY-NNNN) are never added here, because none has an analysis or correction.
 */
import type { ReviewRecord } from '@/types/review'

const HOUR = 60 * 60 * 1000
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

export const DEMO_SUBMITTER = 'Demo submitter (sample)'
export const DEMO_REVIEWER = 'Sample reviewer (demo)'

export function getDemoReviewRecords(): ReviewRecord[] {
  return [
    {
      id: 'REV-DEMO-0101',
      isDemo: true,
      submissionId: 'SUB-DEMO-0101',
      submittedBy: DEMO_SUBMITTER,
      status: 'pending',
      history: [],
    },
    {
      id: 'REV-DEMO-0102',
      isDemo: true,
      submissionId: 'SUB-DEMO-0102',
      submittedBy: DEMO_SUBMITTER,
      status: 'pending',
      history: [
        {
          id: 'REV-DEMO-0102-H01',
          decision: 'keep_pending',
          previousStatus: 'pending',
          newStatus: 'pending',
          reviewer: DEMO_REVIEWER,
          at: ago(20 * HOUR),
          comment: 'Sample entry: waiting for the product owner to confirm the API rate limits before deciding.',
          source: 'demo_seed',
        },
      ],
    },
    {
      id: 'REV-DEMO-0103',
      isDemo: true,
      submissionId: 'SUB-DEMO-0103',
      submittedBy: DEMO_SUBMITTER,
      status: 'changes_requested',
      history: [
        {
          id: 'REV-DEMO-0103-H01',
          decision: 'request_changes',
          previousStatus: 'pending',
          newStatus: 'changes_requested',
          reviewer: DEMO_REVIEWER,
          at: ago(2 * HOUR),
          comment: 'Sample entry: remove the price guarantee and the superlative wording, then send the content back for a new check.',
          source: 'demo_seed',
        },
      ],
    },
  ]
}
