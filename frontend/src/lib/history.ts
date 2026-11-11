/**
 * Content History: builds a timeline of events that the existing stores can genuinely back with a
 * timestamp, then filters, sorts, groups and exports it.
 *
 * What is NOT here, on purpose:
 * - Accepted or rejected correction suggestions: the editor store keeps the current state of each
 *   suggestion but no time it changed, so an event cannot be placed on a timeline without inventing a date.
 * - Manual corrections: not trackable either (only "text differs from the original" is known).
 * - Draft saves, and review items that have never had a decision: no timestamp, so no event.
 * No event is ever created for a record that has no source timestamp.
 */
import { CONTENT_TYPE_LABELS } from '@/lib/submission'
import { isInRange, resolveRange, toTime } from '@/lib/date-range'
import { COMPLIANCE_STATUS_LABELS, getComplianceStatus } from '@/lib/analysis'
import { DECISION_LABELS, REVIEW_STATUS_LABELS } from '@/lib/review'
import { countStatuses } from '@/lib/correction'
import { buildContentRecords, type ContentRecord, type SourceData } from '@/lib/insights-source'
import type { HistoryCategory, HistoryEvent, HistoryEventKind, HistoryFilters } from '@/types/insights'
import type { ReviewDecisionKind, ReviewRecord } from '@/types/review'
import type { ContentType } from '@/types/submission'

export const DEFAULT_HISTORY_FILTERS: HistoryFilters = {
  query: '',
  category: 'all',
  contentType: 'all',
  sort: 'newest',
  range: { preset: 'all', customFrom: '', customTo: '' },
}

export const HISTORY_CATEGORY_LABELS: Record<HistoryCategory, string> = {
  submission: 'Submission',
  analysis: 'Analysis',
  correction: 'Correction',
  review: 'Review',
}

export const HISTORY_CATEGORIES: readonly HistoryCategory[] = ['submission', 'analysis', 'correction', 'review']

const DECISION_EVENT: Record<ReviewDecisionKind, { kind: HistoryEventKind; title: string }> = {
  approve: { kind: 'review_approved', title: 'Review approved' },
  reject: { kind: 'review_rejected', title: 'Review rejected' },
  request_changes: { kind: 'review_changes_requested', title: 'Changes requested' },
  keep_pending: { kind: 'review_kept_pending', title: 'Review kept pending' },
}

const DEMO_ACTION_NOTE = 'Action taken in this browser tab on a demo item. It is not a real decision and resets on refresh.'

/** The store records behind an event, looked up once per submission. */
function recordFor(records: readonly ContentRecord[]): Map<string, ContentRecord> {
  return new Map(records.map((record) => [record.submissionId, record]))
}

export function buildHistoryEvents(data: SourceData): HistoryEvent[] {
  const records = buildContentRecords(data)
  const byId = recordFor(records)
  const events: HistoryEvent[] = []

  // Content submitted: one per submitted store record, and one per analysed demo item that has no store record.
  for (const record of records) {
    const submission = data.submissions.find((item) => item.id === record.submissionId)
    const at = submission ? submission.submittedAt : (record.report?.submittedAt ?? null)
    if (submission && submission.status !== 'submitted') continue
    if (!at || toTime(at) === null) continue
    const submitter = record.review?.submittedBy ?? null
    events.push({
      id: `submitted:${record.submissionId}`,
      kind: 'content_submitted',
      category: 'submission',
      title: 'Content submitted',
      contentTitle: record.title,
      submissionId: record.submissionId,
      contentType: record.contentType,
      at,
      user: submitter,
      status: 'Submitted',
      origin: record.origin,
      originNote: record.origin === 'demo' ? 'Sample record from the demo data.' : null,
      details: [
        record.contentType ? `Content type: ${CONTENT_TYPE_LABELS[record.contentType]}.` : 'No content type was recorded.',
        'The submission store does not record who submitted real content, so no user is shown unless a review record names one.',
      ],
      comment: null,
      link: submission ? { to: '/submit', label: 'Open Content Submission' } : null,
    })
  }

  // Analysis completed: one per report with a valid analysis timestamp.
  for (const report of data.reports) {
    if (toTime(report.analysedAt) === null) continue
    const record = byId.get(report.submissionId)
    const status = COMPLIANCE_STATUS_LABELS[getComplianceStatus(report)]
    events.push({
      id: `analysis:${report.id}`,
      kind: 'analysis_completed',
      category: 'analysis',
      title: 'Analysis completed',
      contentTitle: report.title,
      submissionId: report.submissionId,
      contentType: report.contentType,
      at: report.analysedAt,
      user: null,
      status,
      origin: report.isDemo ? 'demo' : 'real',
      originNote: report.isDemo ? 'Sample analysis from the demo data. It was not produced by an analysis engine.' : null,
      details: [
        `Compliance score: ${report.overallScore}/100 (${status}).`,
        `${report.claims.length} ${report.claims.length === 1 ? 'claim' : 'claims'} analysed.`,
        record?.review ? 'The score informs the reviewer. It is not a review decision.' : 'The score is not a review decision.',
      ],
      comment: null,
      link: { to: `/reports?submission=${encodeURIComponent(report.submissionId)}`, label: 'Open Analysis Report' },
    })
  }

  // Ready for human review: the editor records the moment the person marked a case ready.
  for (const correctionCase of data.cases) {
    const session = data.sessions[correctionCase.id]
    if (!session || !session.markedReadyAt || toTime(session.markedReadyAt) === null) continue
    const counts = countStatuses(correctionCase.suggestions, session.statuses)
    events.push({
      id: `ready:${correctionCase.id}`,
      kind: 'ready_for_review',
      category: 'correction',
      title: 'Marked ready for human review',
      contentTitle: correctionCase.title,
      submissionId: correctionCase.submissionId,
      contentType: correctionCase.contentType,
      at: session.markedReadyAt,
      user: null,
      status: 'Ready for review',
      origin: correctionCase.isDemo ? 'demo' : 'real',
      originNote: correctionCase.isDemo ? DEMO_ACTION_NOTE : null,
      details: [
        'Marked ready in the Correction Editor. This is a workflow marker, not an approval.',
        `Suggestion state right now: ${counts.accepted} accepted, ${counts.rejected} rejected, ${counts.pending} unresolved. These counts are current state, not a record of when each choice was made.`,
        'The editor does not record who marked it ready.',
      ],
      comment: null,
      link: { to: `/corrections?submission=${encodeURIComponent(correctionCase.submissionId)}`, label: 'Open Correction Editor' },
    })
  }

  // Review decisions: one per history entry on a review record.
  for (const review of data.reviews) {
    const record = byId.get(review.submissionId)
    for (const entry of review.history) {
      if (toTime(entry.at) === null) continue
      const { kind, title } = DECISION_EVENT[entry.decision]
      const isSample = entry.source === 'demo_seed'
      events.push({
        id: `review:${entry.id}`,
        kind,
        category: 'review',
        title,
        contentTitle: record?.title ?? review.submissionId,
        submissionId: review.submissionId,
        contentType: record?.contentType ?? null,
        at: entry.at,
        user: entry.reviewer,
        status: REVIEW_STATUS_LABELS[entry.newStatus],
        origin: review.isDemo || isSample ? 'demo' : 'real',
        originNote: isSample ? 'Sample history entry from the demo data. It is not a real decision.' : review.isDemo ? DEMO_ACTION_NOTE : null,
        details: [
          `Decision: ${DECISION_LABELS[entry.decision]}.`,
          `Status changed from ${REVIEW_STATUS_LABELS[entry.previousStatus]} to ${REVIEW_STATUS_LABELS[entry.newStatus]}.`,
        ],
        comment: entry.comment.trim() === '' ? null : entry.comment,
        link: reviewLink(review),
      })
    }
  }

  return events
}

function reviewLink(review: ReviewRecord) {
  return { to: `/reviews/${encodeURIComponent(review.id)}`, label: 'Open Review & Approval' }
}

export function hasActiveHistoryFilters(filters: HistoryFilters): boolean {
  return (
    filters.query.trim() !== '' ||
    filters.category !== 'all' ||
    filters.contentType !== 'all' ||
    filters.range.preset !== 'all' ||
    filters.sort !== 'newest'
  )
}

/** Search, category, content type and date range, then sort. Ties keep a stable order by ID. */
export function filterHistoryEvents(events: readonly HistoryEvent[], filters: HistoryFilters, nowMs: number): HistoryEvent[] {
  const term = filters.query.trim().toLowerCase()
  const range = resolveRange(filters.range, nowMs)

  const matches = events.filter((event) => {
    if (filters.category !== 'all' && event.category !== filters.category) return false
    if (filters.contentType === 'unspecified') {
      if (event.contentType !== null) return false
    } else if (filters.contentType !== 'all' && event.contentType !== filters.contentType) return false
    if (!isInRange(event.at, range)) return false
    if (term === '') return true
    return `${event.contentTitle} ${event.submissionId} ${event.title}`.toLowerCase().includes(term)
  })

  const time = (event: HistoryEvent) => toTime(event.at) ?? 0
  const direction = filters.sort === 'newest' ? -1 : 1
  return matches.sort((a, b) => direction * (time(a) - time(b)) || a.id.localeCompare(b.id))
}

export interface DayGroup {
  /** Local calendar day, YYYY-MM-DD. */
  day: string
  events: HistoryEvent[]
}

function localDay(iso: string): string {
  const date = new Date(iso)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const dayOfMonth = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${dayOfMonth}`
}

/** Groups already-sorted events by local day, keeping their order. */
export function groupByDay(events: readonly HistoryEvent[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const event of events) {
    const day = localDay(event.at)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.events.push(event)
    else groups.push({ day, events: [event] })
  }
  return groups
}

/** Content types that actually appear in the events, for the filter. */
export function contentTypesPresent(events: readonly HistoryEvent[]) {
  const present = new Set<ContentType>()
  for (const event of events) if (event.contentType !== null) present.add(event.contentType)
  return { types: [...present].sort(), hasUnspecified: events.some((event) => event.contentType === null) }
}
