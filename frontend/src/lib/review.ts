import { countStatuses, hasManualEdits } from '@/lib/correction'
import { CONTENT_TYPE_LABELS } from '@/lib/submission'
import type { AnalysisReport } from '@/types/analysis'
import type { CorrectionCase, EditorSession } from '@/types/correction'
import type {
  DecisionInput,
  DecisionResult,
  QueueFilters,
  ReviewDecisionKind,
  ReviewHistoryEntry,
  ReviewRecord,
  ReviewStatus,
} from '@/types/review'

export const REVIEW_STATUSES: readonly ReviewStatus[] = ['pending', 'changes_requested', 'approved', 'rejected']

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: 'Pending review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  rejected: 'Rejected',
}

export const DECISION_LABELS: Record<ReviewDecisionKind, string> = {
  approve: 'Approved',
  reject: 'Rejected',
  request_changes: 'Changes requested',
  keep_pending: 'Kept pending',
}

/** Button and dialog wording for each decision. */
export const DECISION_ACTION_LABELS: Record<ReviewDecisionKind, string> = {
  approve: 'Approve',
  reject: 'Reject',
  request_changes: 'Request changes',
  keep_pending: 'Keep pending',
}

export const COMMENT_LIMITS = {
  /** Reject and request-changes need a real explanation, not a single word. */
  requiredMin: 10,
  max: 1000,
} as const

export const DEMO_STATE_NOTICE =
  'Decisions are temporary demo state: they are kept in memory in this browser tab only, are not saved to any database, and reset when you refresh the page.'

// ---------------------------------------------------------------------------
// Decision rules
// ---------------------------------------------------------------------------

const ALLOWED: Record<ReviewStatus, readonly ReviewDecisionKind[]> = {
  pending: ['approve', 'reject', 'request_changes', 'keep_pending'],
  // Awaiting a revised version, which this frontend cannot receive. A reviewer may still make a final call.
  changes_requested: ['approve', 'reject'],
  // Final in this module: reopening belongs to a later, persisted workflow.
  approved: [],
  rejected: [],
}

export function allowedDecisions(status: ReviewStatus): readonly ReviewDecisionKind[] {
  return ALLOWED[status]
}

/** Why a decision is unavailable, or null when it can be made. */
export function decisionBlockedReason(status: ReviewStatus, decision: ReviewDecisionKind): string | null {
  if (ALLOWED[status].includes(decision)) return null
  if (status === 'approved' || status === 'rejected') {
    return `A final decision (${REVIEW_STATUS_LABELS[status].toLowerCase()}) has been recorded. Reopening is not part of this demo.`
  }
  if (decision === 'keep_pending') return 'Only items that are pending review can be kept pending.'
  if (decision === 'request_changes') return 'Changes have already been requested for this item.'
  return 'This decision is not available for the current status.'
}

export function requiresComment(decision: ReviewDecisionKind): boolean {
  return decision === 'reject' || decision === 'request_changes'
}

export function statusAfter(decision: ReviewDecisionKind, current: ReviewStatus): ReviewStatus {
  switch (decision) {
    case 'approve':
      return 'approved'
    case 'reject':
      return 'rejected'
    case 'request_changes':
      return 'changes_requested'
    case 'keep_pending':
      return current
  }
}

/** Returns an error message, or null when the comment is acceptable for this decision. */
export function validateComment(decision: ReviewDecisionKind, comment: string): string | null {
  const trimmed = comment.trim()
  if (trimmed.length > COMMENT_LIMITS.max) return `Keep the comment under ${COMMENT_LIMITS.max.toLocaleString()} characters.`
  if (!requiresComment(decision)) return null
  const noun = decision === 'reject' ? 'a reason for rejecting this content' : 'an explanation of the changes that are required'
  if (trimmed === '') return `Enter ${noun}.`
  if (trimmed.length < COMMENT_LIMITS.requiredMin) {
    return `Please give a little more detail (at least ${COMMENT_LIMITS.requiredMin} characters) so the submitter knows what to do.`
  }
  return null
}

/**
 * Applies one human decision to a record, without mutating it. Pure, so it is easy to test.
 * It refuses a decision that is not allowed for the current status, which also stops a duplicate
 * submission (a second "approve" finds the record already approved).
 */
export function applyDecision(record: ReviewRecord, input: DecisionInput, nowIso: string): DecisionResult {
  if (record.id !== input.reviewId) return { ok: false, message: 'This decision does not match the review record.' }
  if (record.status !== input.expectedStatus) {
    return {
      ok: false,
      message: `This item is now “${REVIEW_STATUS_LABELS[record.status]}”, so your decision was not recorded. Review the latest state and try again.`,
    }
  }
  const blocked = decisionBlockedReason(record.status, input.decision)
  if (blocked) return { ok: false, message: blocked }
  const reviewer = input.reviewer.trim()
  if (reviewer === '') return { ok: false, message: 'A reviewer name is required to record a decision.' }
  const commentError = validateComment(input.decision, input.comment)
  if (commentError) return { ok: false, message: commentError }

  const entry: ReviewHistoryEntry = {
    id: `${record.id}-H${String(record.history.length + 1).padStart(2, '0')}`,
    decision: input.decision,
    previousStatus: record.status,
    newStatus: statusAfter(input.decision, record.status),
    reviewer,
    at: nowIso,
    comment: input.comment.trim(),
    source: 'session',
  }
  return { ok: true, entry, record: { ...record, status: entry.newStatus, history: [...record.history, entry] } }
}

// ---------------------------------------------------------------------------
// Joining review state with analysis and correction data
// ---------------------------------------------------------------------------

/** A review record together with the data it is about. `report` and `correctionCase` are null when none exists. */
export interface ReviewItem {
  record: ReviewRecord
  report: AnalysisReport | null
  correctionCase: CorrectionCase | null
  /** The editor session, or null when the Correction Editor has not been used for this item. */
  session: EditorSession | null
}

export function buildReviewItem(
  record: ReviewRecord,
  reports: readonly AnalysisReport[],
  cases: readonly CorrectionCase[],
  sessions: Readonly<Record<string, EditorSession>>,
): ReviewItem {
  const report = reports.find((item) => item.submissionId === record.submissionId) ?? null
  const correctionCase = cases.find((item) => item.submissionId === record.submissionId) ?? null
  return { record, report, correctionCase, session: correctionCase ? (sessions[correctionCase.id] ?? null) : null }
}

/**
 * A review item is only listed when real analysis data exists for it. Without it there is nothing
 * trustworthy to review, so it is shown as "not ready" instead of being queued.
 */
export function isReviewReady(item: ReviewItem): boolean {
  return item.report !== null && item.correctionCase !== null
}

export function itemTitle(item: ReviewItem): string {
  return item.report?.title ?? item.correctionCase?.title ?? item.record.submissionId
}

export function itemContentType(item: ReviewItem) {
  return item.report?.contentType ?? item.correctionCase?.contentType ?? null
}

export function itemSubmittedAt(item: ReviewItem): string | null {
  return item.report?.submittedAt ?? null
}

/** The AI score, or null when no analysis exists. It informs a reviewer and is never a decision. */
export function itemScore(item: ReviewItem): number | null {
  return item.report ? item.report.overallScore : null
}

export interface CorrectionProgress {
  accepted: number
  rejected: number
  /** Suggestions nobody has accepted or rejected yet. */
  unresolved: number
  total: number
  /** True when the editor has been used for this item. */
  started: boolean
  /** Null when there is no editor session to compare, so it is unknown. */
  manualEdits: boolean | null
  /** The corrected text, or null when no corrected version exists. */
  correctedText: string | null
}

export function correctionProgress(item: ReviewItem): CorrectionProgress | null {
  const { correctionCase, session } = item
  if (!correctionCase) return null
  const total = correctionCase.suggestions.length
  if (!session) {
    return { accepted: 0, rejected: 0, unresolved: total, total, started: false, manualEdits: null, correctedText: null }
  }
  const counts = countStatuses(correctionCase.suggestions, session.statuses)
  const changed = session.text !== correctionCase.originalContent
  return {
    accepted: counts.accepted,
    rejected: counts.rejected,
    unresolved: counts.pending,
    total,
    started: true,
    manualEdits: hasManualEdits(correctionCase, session),
    correctedText: changed ? session.text : null,
  }
}

/** Unresolved correction suggestions, or null when there is no correction data. */
export function itemUnresolved(item: ReviewItem): number | null {
  return correctionProgress(item)?.unresolved ?? null
}

// ---------------------------------------------------------------------------
// Stats, filtering, activity
// ---------------------------------------------------------------------------

export interface ReviewStats {
  total: number
  pending: number
  approved: number
  rejected: number
  changesRequested: number
}

export function computeStats(records: readonly ReviewRecord[]): ReviewStats {
  const stats: ReviewStats = { total: records.length, pending: 0, approved: 0, rejected: 0, changesRequested: 0 }
  for (const record of records) {
    if (record.status === 'pending') stats.pending += 1
    else if (record.status === 'approved') stats.approved += 1
    else if (record.status === 'rejected') stats.rejected += 1
    else stats.changesRequested += 1
  }
  return stats
}

export const DEFAULT_FILTERS: QueueFilters = { query: '', status: 'all', contentType: 'all', sort: 'newest' }

export function hasActiveFilters(filters: QueueFilters): boolean {
  return filters.query.trim() !== '' || filters.status !== 'all' || filters.contentType !== 'all'
}

export function filterAndSortItems(items: readonly ReviewItem[], filters: QueueFilters): ReviewItem[] {
  const term = filters.query.trim().toLowerCase()
  const matches = items.filter((item) => {
    if (filters.status !== 'all' && item.record.status !== filters.status) return false
    const type = itemContentType(item)
    if (filters.contentType !== 'all' && type !== filters.contentType) return false
    if (term === '') return true
    const haystack = [
      itemTitle(item),
      item.record.submissionId,
      item.record.id,
      item.record.submittedBy,
      type ? CONTENT_TYPE_LABELS[type] : '',
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(term)
  })
  const time = (item: ReviewItem) => {
    const value = Date.parse(itemSubmittedAt(item) ?? '')
    return Number.isNaN(value) ? 0 : value
  }
  return matches.sort((a, b) => (filters.sort === 'newest' ? time(b) - time(a) : time(a) - time(b)))
}

export interface DecisionLogEntry {
  record: ReviewRecord
  entry: ReviewHistoryEntry
}

/** Every history entry across records, newest first. */
export function activityLog(records: readonly ReviewRecord[]): DecisionLogEntry[] {
  return records
    .flatMap((record) => record.history.map((entry) => ({ record, entry })))
    .sort((a, b) => Date.parse(b.entry.at) - Date.parse(a.entry.at))
}

/** Decisions that moved an item to a new status (approve, reject, request changes), newest first. */
export function recentDecisions(records: readonly ReviewRecord[], limit: number): DecisionLogEntry[] {
  return activityLog(records)
    .filter(({ entry }) => entry.decision !== 'keep_pending')
    .slice(0, limit)
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}
