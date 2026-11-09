/**
 * Provisional workflow statuses, used only for badge rendering.
 * They will be aligned with the database enum when submissions are implemented.
 */
export type SubmissionStatus =
  | 'draft'
  | 'analyzing'
  | 'needs_review'
  | 'changes_requested'
  | 'approved'
  | 'rejected'

export interface CompliancePoint {
  label: string
  score: number
}
