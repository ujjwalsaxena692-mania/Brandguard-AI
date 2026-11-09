import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, UserCheck, type LucideIcon } from 'lucide-react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import type { ContentCheckStatus, ReviewStatus } from '@/types/dashboard'

interface StatusConfig {
  label: string
  variant: BadgeProps['variant']
  icon: LucideIcon
}

const CONTENT_STATUS: Record<ContentCheckStatus, StatusConfig> = {
  compliant: { label: 'Compliant', variant: 'success', icon: CheckCircle2 },
  needs_review: { label: 'Needs review', variant: 'warning', icon: AlertTriangle },
  critical: { label: 'Critical', variant: 'danger', icon: ShieldAlert },
}

const REVIEW_STATUS: Record<ReviewStatus, StatusConfig> = {
  awaiting_review: { label: 'Awaiting review', variant: 'outline', icon: Clock },
  in_review: { label: 'In review', variant: 'primary', icon: UserCheck },
  changes_requested: { label: 'Changes requested', variant: 'warning', icon: AlertTriangle },
}

function StatusPill({ config }: { config: StatusConfig }) {
  const Icon = config.icon
  return (
    <Badge variant={config.variant}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </Badge>
  )
}

/** Icon plus text label, so status never depends on colour alone. */
export function ContentStatusBadge({ status }: { status: ContentCheckStatus }) {
  return <StatusPill config={CONTENT_STATUS[status]} />
}

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return <StatusPill config={REVIEW_STATUS[status]} />
}

export const CONTENT_STATUS_LABELS: Record<ContentCheckStatus, string> = {
  compliant: CONTENT_STATUS.compliant.label,
  needs_review: CONTENT_STATUS.needs_review.label,
  critical: CONTENT_STATUS.critical.label,
}

export function scoreBarClass(status: ContentCheckStatus): string {
  if (status === 'compliant') return 'bg-success'
  if (status === 'needs_review') return 'bg-warning'
  return 'bg-primary'
}
