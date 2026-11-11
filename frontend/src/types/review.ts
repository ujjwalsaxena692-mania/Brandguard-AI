/**
 * Review & Approval types.
 *
 * A human reviewer makes every decision. Nothing here is produced by an AI model, and an AI
 * compliance score is never a status. Records live in memory only (see hooks/use-review-store.ts).
 */
import type { ContentType } from '@/types/submission'

export type ReviewStatus = 'pending' | 'changes_requested' | 'approved' | 'rejected'

export type ReviewDecisionKind = 'approve' | 'reject' | 'request_changes' | 'keep_pending'

/**
 * Where a history entry came from:
 * - `demo_seed`: a clearly labelled sample entry that ships with the demo data (not a real person's decision).
 * - `session`: recorded by the person using this browser tab. Temporary: it is lost on refresh.
 */
export type HistorySource = 'demo_seed' | 'session'

export interface ReviewHistoryEntry {
  id: string
  decision: ReviewDecisionKind
  previousStatus: ReviewStatus
  newStatus: ReviewStatus
  reviewer: string
  /** ISO timestamp. */
  at: string
  /** The reviewer's comment or reason. Empty when none was given. */
  comment: string
  source: HistorySource
}

/**
 * One item in the review workflow. It stores only review state: the content, analysis and
 * correction data are joined from their own modules by `submissionId`, so there is one source of truth.
 */
export interface ReviewRecord {
  id: string
  isDemo: boolean
  submissionId: string
  /** Who submitted the content. Demo records use a clearly labelled placeholder. */
  submittedBy: string
  status: ReviewStatus
  /** Oldest first. */
  history: ReviewHistoryEntry[]
}

export interface DecisionInput {
  reviewId: string
  decision: ReviewDecisionKind
  comment: string
  reviewer: string
  /** The status the reviewer was looking at. A mismatch means the record changed underneath them. */
  expectedStatus: ReviewStatus
}

export type DecisionResult = { ok: true; record: ReviewRecord; entry: ReviewHistoryEntry } | { ok: false; message: string }

export type ReviewSort = 'newest' | 'oldest'

export interface QueueFilters {
  query: string
  status: 'all' | ReviewStatus
  contentType: 'all' | ContentType
  sort: ReviewSort
}
