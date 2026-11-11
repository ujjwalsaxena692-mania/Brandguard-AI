import { CheckCircle2, CircleDashed, Clock, FilePen, Save, UserCheck, XCircle, type LucideIcon } from 'lucide-react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { CATEGORY_LABELS, STATUS_LABELS } from '@/lib/correction'
import type { SuggestionCategory, SuggestionStatus, WorkflowStatus } from '@/types/correction'

export function CategoryBadge({ category }: { category: SuggestionCategory }) {
  return <Badge variant="neutral">{CATEGORY_LABELS[category]}</Badge>
}

const SUGGESTION_STATUS: Record<SuggestionStatus, { variant: BadgeProps['variant']; icon: LucideIcon }> = {
  pending: { variant: 'outline', icon: Clock },
  accepted: { variant: 'success', icon: CheckCircle2 },
  rejected: { variant: 'neutral', icon: XCircle },
}

export function SuggestionStatusBadge({ status }: { status: SuggestionStatus }) {
  const { variant, icon: Icon } = SUGGESTION_STATUS[status]
  return (
    <Badge variant={variant}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </Badge>
  )
}

const WORKFLOW_ICONS: Record<WorkflowStatus, LucideIcon> = {
  in_progress: FilePen,
  draft_saved: Save,
  ready_for_review: UserCheck,
}

/**
 * The correction status shown in the header. It is a workflow marker only:
 * "Ready for human review" is a hand-off, not an approval, and there is no approved state.
 */
export function CorrectionStatusBadge({ label, workflow, started }: { label: string; workflow: WorkflowStatus; started: boolean }) {
  const Icon = workflow === 'in_progress' && !started ? CircleDashed : WORKFLOW_ICONS[workflow]
  return (
    <Badge variant={workflow === 'ready_for_review' ? 'primary' : 'neutral'}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </Badge>
  )
}
