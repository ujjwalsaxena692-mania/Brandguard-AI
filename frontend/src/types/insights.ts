/**
 * Types for the Content History and Brand Analytics modules.
 *
 * Both modules are read-only views derived from the existing in-memory stores. Nothing here is
 * persisted, and nothing is an audit log: everything resets when the page is refreshed.
 */
import type { ClaimSeverity } from '@/types/analysis'
import type { SuggestionCategory } from '@/types/correction'
import type { ContentType } from '@/types/submission'

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/** `demo`: fabricated sample data. `real`: created by the person using this browser tab. */
export type DataOrigin = 'demo' | 'real'

/** Where a metric's inputs came from. `none` means no record contributed to it. */
export type DataSource = DataOrigin | 'mixed' | 'none'

export type DateRangePreset = 'last_7' | 'last_30' | 'last_90' | 'all' | 'custom'

export interface DateRangeFilter {
  preset: DateRangePreset
  /** YYYY-MM-DD, only used by the custom preset. */
  customFrom: string
  customTo: string
}

/** A range ready to apply. A null bound is open-ended. */
export interface ResolvedRange {
  preset: DateRangePreset
  /** Inclusive epoch milliseconds, or null for no lower bound. */
  from: number | null
  /** Inclusive epoch milliseconds, or null for no upper bound. */
  to: number | null
  /** Human-readable label, also written to CSV exports. */
  label: string
  /** Set when a custom range is incomplete or reversed. The range is then not applied. */
  error: string | null
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export type HistoryCategory = 'submission' | 'analysis' | 'correction' | 'review'

export type HistoryEventKind =
  | 'content_submitted'
  | 'analysis_completed'
  | 'ready_for_review'
  | 'review_approved'
  | 'review_rejected'
  | 'review_changes_requested'
  | 'review_kept_pending'

export interface HistoryLink {
  to: string
  label: string
}

export interface HistoryEvent {
  /** Stable and unique, derived from the source record. */
  id: string
  kind: HistoryEventKind
  category: HistoryCategory
  title: string
  contentTitle: string
  submissionId: string
  contentType: ContentType | null
  /** ISO timestamp of when the event happened, taken from the source record. */
  at: string
  /** Who did it, or null when the source record does not say. */
  user: string | null
  /** Status label shown on the event. */
  status: string
  origin: DataOrigin
  /** Extra context about the origin, e.g. a session action on a demo item. */
  originNote: string | null
  /** Plain-language detail lines for the detail dialog. */
  details: string[]
  /** The reviewer's comment, when there is one. */
  comment: string | null
  link: HistoryLink | null
}

export interface HistoryFilters {
  query: string
  category: 'all' | HistoryCategory
  contentType: 'all' | 'unspecified' | ContentType
  sort: 'newest' | 'oldest'
  range: DateRangeFilter
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export type ContentStage = 'draft' | 'submitted' | 'under_review' | 'changes_requested' | 'approved' | 'rejected'

export type KpiKey =
  | 'total_submissions'
  | 'analyses_completed'
  | 'average_score'
  | 'pending_reviews'
  | 'approved'
  | 'rejected'

export interface AnalyticsKpi {
  id: KpiKey
  label: string
  /** null means the metric cannot be calculated from the available records. */
  value: number | null
  /** Formatted for display, or an em dash when unavailable. */
  display: string
  source: DataSource
  /** How it is calculated, or why it is unavailable. */
  note: string
}

export interface TrendPoint {
  id: string
  title: string
  /** ISO timestamp of the analysis. */
  at: string
  time: number
  score: number
  source: DataOrigin
}

export interface DistributionDatum {
  key: string
  label: string
  value: number
}

export interface Distribution {
  data: DistributionDatum[]
  total: number
  source: DataSource
}

export interface AnalyticsInsight {
  id: string
  title: string
  /** null when the data is insufficient. */
  text: string | null
  /** Why there is no insight, shown when `text` is null. */
  unavailableReason: string | null
  source: DataSource
}

export interface AnalyticsCoverage {
  /** Records with no usable date, which cannot be placed inside a date range. */
  undatedExcluded: number
  /** Analysed claims that were not classified as supported (the basis of the severity chart). */
  issueCount: number
}

export interface AnalyticsSnapshot {
  range: ResolvedRange
  kpis: AnalyticsKpi[]
  trend: { points: TrendPoint[]; source: DataSource }
  status: Distribution
  severity: Distribution
  contentType: Distribution
  reviewDecisions: Distribution
  insights: AnalyticsInsight[]
  coverage: AnalyticsCoverage
  /** True when the stores hold no records at all (before any filter). */
  noRecords: boolean
}

export type IssueCategoryCounts = Partial<Record<SuggestionCategory, number>>
export type SeverityCounts = Record<ClaimSeverity, number>
