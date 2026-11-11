import { Ban, CheckCircle2, Clock, FlaskConical, MessageSquareWarning, PauseCircle, User, XCircle, type LucideIcon } from 'lucide-react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { DECISION_LABELS, REVIEW_STATUS_LABELS } from '@/lib/review'
import type { HistorySource, ReviewDecisionKind, ReviewStatus } from '@/types/review'

const STATUS: Record<ReviewStatus, { variant: BadgeProps['variant']; icon: LucideIcon }> = {
  pending: { variant: 'warning', icon: Clock },
  changes_requested: { variant: 'primary', icon: MessageSquareWarning },
  approved: { variant: 'success', icon: CheckCircle2 },
  rejected: { variant: 'danger', icon: XCircle },
}

/** Always shows a text label and an icon, so meaning never depends on colour alone. */
export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const { variant, icon: Icon } = STATUS[status]
  return (
    <Badge variant={variant}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {REVIEW_STATUS_LABELS[status]}
    </Badge>
  )
}

const DECISION: Record<ReviewDecisionKind, { variant: BadgeProps['variant']; icon: LucideIcon }> = {
  approve: { variant: 'success', icon: CheckCircle2 },
  reject: { variant: 'danger', icon: XCircle },
  request_changes: { variant: 'primary', icon: MessageSquareWarning },
  keep_pending: { variant: 'outline', icon: PauseCircle },
}

export function DecisionBadge({ decision }: { decision: ReviewDecisionKind }) {
  const { variant, icon: Icon } = DECISION[decision]
  return (
    <Badge variant={variant}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {DECISION_LABELS[decision]}
    </Badge>
  )
}

/** Marks a review record (not just its data) as a demonstration. */
export function DemoRecordBadge() {
  return (
    <Badge variant="outline">
      <FlaskConical className="h-3 w-3" aria-hidden="true" />
      Demo record
    </Badge>
  )
}

/** Tells a sample history entry apart from a decision made in this tab. */
export function HistorySourceTag({ source }: { source: HistorySource }) {
  return source === 'demo_seed' ? (
    <Badge variant="outline">
      <FlaskConical className="h-3 w-3" aria-hidden="true" />
      Demo history (sample, not a real decision)
    </Badge>
  ) : (
    <Badge variant="neutral">
      <User className="h-3 w-3" aria-hidden="true" />
      Recorded in this session · not saved
    </Badge>
  )
}

/** Labels content that an AI produced, so it is never mistaken for a human decision. */
export function AiGeneratedTag() {
  return (
    <Badge variant="outline">
      <Ban className="h-3 w-3" aria-hidden="true" />
      AI-generated · not a decision
    </Badge>
  )
}
