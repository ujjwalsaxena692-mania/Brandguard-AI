/**
 * Read-only joins over the existing stores, shared by Content History and Brand Analytics.
 *
 * Nothing here changes a store. Every function is pure, so it can be tested without React.
 */
import { toTime } from '@/lib/date-range'
import type { AnalysisReport } from '@/types/analysis'
import type { CorrectionCase, EditorSession } from '@/types/correction'
import type { ContentStage, DataOrigin, DataSource } from '@/types/insights'
import type { ReviewRecord, ReviewStatus } from '@/types/review'
import type { ContentSubmission, ContentType } from '@/types/submission'

/** Everything the two modules read. All of it comes from existing stores. */
export interface SourceData {
  submissions: readonly ContentSubmission[]
  /** IDs of the sample submissions that ship with the demo data. Any other store record was created in this tab. */
  demoSubmissionIds: ReadonlySet<string>
  reports: readonly AnalysisReport[]
  cases: readonly CorrectionCase[]
  sessions: Readonly<Record<string, EditorSession>>
  reviews: readonly ReviewRecord[]
}

/** One piece of content, joined from the submission, analysis and review stores by submission ID. */
export interface ContentRecord {
  submissionId: string
  title: string
  contentType: ContentType | null
  /** ISO timestamp used to place the record inside a date range, or null when no usable date exists. */
  date: string | null
  stage: ContentStage
  origin: DataOrigin
  report: AnalysisReport | null
  review: ReviewRecord | null
}

export const STAGE_LABELS: Record<ContentStage, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  rejected: 'Rejected',
}

/** Display order for the status chart. */
export const STAGE_ORDER: readonly ContentStage[] = [
  'draft',
  'submitted',
  'under_review',
  'changes_requested',
  'approved',
  'rejected',
]

const REVIEW_TO_STAGE: Record<ReviewStatus, ContentStage> = {
  pending: 'under_review',
  changes_requested: 'changes_requested',
  approved: 'approved',
  rejected: 'rejected',
}

function validDate(iso: string | null | undefined): string | null {
  return toTime(iso) === null ? null : (iso as string)
}

/**
 * Joins the stores into one record per submission ID.
 *
 * - A submission in the submission store is the base record (drafts included).
 * - An analysis report with no matching store submission becomes its own record (the demo reports).
 * - A review record with neither becomes a bare record, so it is still counted but has no title or date.
 * - Review state, when it exists, decides the stage: an AI score never does.
 */
export function buildContentRecords(data: SourceData): ContentRecord[] {
  const reportById = new Map(data.reports.map((report) => [report.submissionId, report]))
  const reviewById = new Map(data.reviews.map((review) => [review.submissionId, review]))
  const records: ContentRecord[] = []
  const seen = new Set<string>()

  const stageFor = (base: ContentStage, review: ReviewRecord | null): ContentStage => (review ? REVIEW_TO_STAGE[review.status] : base)

  for (const submission of data.submissions) {
    const report = reportById.get(submission.id) ?? null
    const review = reviewById.get(submission.id) ?? null
    seen.add(submission.id)
    records.push({
      submissionId: submission.id,
      title: submission.title || submission.id,
      contentType: submission.contentType,
      date: validDate(submission.submittedAt) ?? validDate(submission.createdAt),
      stage: stageFor(submission.status === 'draft' ? 'draft' : 'submitted', review),
      origin: data.demoSubmissionIds.has(submission.id) ? 'demo' : 'real',
      report,
      review,
    })
  }

  for (const report of data.reports) {
    if (seen.has(report.submissionId)) continue
    seen.add(report.submissionId)
    const review = reviewById.get(report.submissionId) ?? null
    records.push({
      submissionId: report.submissionId,
      title: report.title,
      contentType: report.contentType,
      date: validDate(report.submittedAt),
      stage: stageFor('submitted', review),
      origin: report.isDemo ? 'demo' : 'real',
      report,
      review,
    })
  }

  for (const review of data.reviews) {
    if (seen.has(review.submissionId)) continue
    seen.add(review.submissionId)
    records.push({
      submissionId: review.submissionId,
      title: review.submissionId,
      contentType: null,
      date: null,
      stage: stageFor('submitted', review),
      origin: review.isDemo ? 'demo' : 'real',
      report: null,
      review,
    })
  }

  return records
}

/** `none` for no inputs, `mixed` when both kinds contributed. */
export function combineOrigins(origins: Iterable<DataOrigin>): DataSource {
  let demo = false
  let real = false
  for (const origin of origins) {
    if (origin === 'demo') demo = true
    else real = true
  }
  if (demo && real) return 'mixed'
  if (demo) return 'demo'
  if (real) return 'real'
  return 'none'
}

export const SOURCE_LABELS: Record<DataSource, string> = {
  demo: 'Demo data',
  real: 'Real (this session)',
  mixed: 'Demo + real',
  none: 'No data',
}
