import { Badge, type BadgeProps } from '@/components/ui/badge'
import type { SubmissionStatus } from '@/types'

const STATUS_CONFIG: Record<SubmissionStatus, { label: string; variant: BadgeProps['variant'] }> = {
  draft: { label: 'Draft', variant: 'neutral' },
  analyzing: { label: 'Analyzing', variant: 'outline' },
  needs_review: { label: 'Needs review', variant: 'warning' },
  changes_requested: { label: 'Changes requested', variant: 'primary' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
}

/** Always shows a text label, so meaning never depends on colour alone. */
export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const { label, variant } = STATUS_CONFIG[status]
  return <Badge variant={variant}>{label}</Badge>
}
