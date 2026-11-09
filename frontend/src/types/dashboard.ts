import type { CompliancePoint } from '@/types'

/** Score bands: compliant >= 85, needs review 60-84, critical < 60. */
export type ContentCheckStatus = 'compliant' | 'needs_review' | 'critical'

export type ReviewStatus = 'awaiting_review' | 'in_review' | 'changes_requested'

export type ActivityKind =
  | 'content_submitted'
  | 'guideline_updated'
  | 'review_completed'
  | 'suggestion_accepted'

export type KpiId = 'total_checks' | 'average_score' | 'pending_reviews' | 'critical_issues'

export interface KpiMetric {
  id: KpiId
  label: string
  /** Pre-formatted for display, e.g. "248" or "87%". */
  value: string
  description: string
  trend: {
    label: string
    direction: 'up' | 'down' | 'flat'
    /** Whether the movement is good news, independent of its direction. */
    sentiment: 'positive' | 'negative' | 'neutral'
  }
}

export interface ComplianceBreakdown {
  compliant: number
  needsReview: number
  critical: number
}

export interface ContentCheck {
  id: string
  title: string
  contentType: string
  /** 0-100. */
  score: number
  status: ContentCheckStatus
  /** ISO 8601 timestamp. */
  checkedAt: string
}

export interface PendingApproval {
  id: string
  title: string
  submitter: string
  /** ISO 8601 timestamp. */
  submittedAt: string
  reviewStatus: ReviewStatus
}

export interface ActivityEvent {
  id: string
  kind: ActivityKind
  message: string
  actor: string
  /** ISO 8601 timestamp. */
  occurredAt: string
}

/**
 * Everything the Dashboard renders. A backend endpoint should return this
 * shape (or be mapped to it) so the page needs no changes when real data arrives.
 */
export interface DashboardData {
  /** 'demo' shows a "sample data" notice; a real API source should set 'api'. */
  source: 'demo' | 'api'
  kpis: KpiMetric[]
  averageScore: number
  breakdown: ComplianceBreakdown
  trend: CompliancePoint[]
  recentChecks: ContentCheck[]
  pendingApprovals: PendingApproval[]
  /** Total awaiting review, which can exceed the number of rows listed. */
  pendingTotal: number
  activity: ActivityEvent[]
}
