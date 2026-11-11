import { ClipboardCheck, FileSearch, FileUp, FlaskConical, PenLine, type LucideIcon } from 'lucide-react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { HISTORY_CATEGORY_LABELS } from '@/lib/history'
import type { HistoryCategory, HistoryEvent, HistoryEventKind } from '@/types/insights'

export const CATEGORY_ICONS: Record<HistoryCategory, LucideIcon> = {
  submission: FileUp,
  analysis: FileSearch,
  correction: PenLine,
  review: ClipboardCheck,
}

const STATUS_VARIANTS: Record<HistoryEventKind, BadgeProps['variant']> = {
  content_submitted: 'neutral',
  analysis_completed: 'outline',
  ready_for_review: 'primary',
  review_approved: 'success',
  review_rejected: 'danger',
  review_changes_requested: 'primary',
  review_kept_pending: 'warning',
}

export function EventStatusBadge({ event }: { event: Pick<HistoryEvent, 'kind' | 'status'> }) {
  return <Badge variant={STATUS_VARIANTS[event.kind]}>{event.status}</Badge>
}

export function CategoryBadge({ category }: { category: HistoryCategory }) {
  const Icon = CATEGORY_ICONS[category]
  return (
    <Badge variant="outline">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {HISTORY_CATEGORY_LABELS[category]}
    </Badge>
  )
}

/** Shown on every demo event, so a sample is never mistaken for real activity. */
export function EventOriginBadge({ origin }: { origin: HistoryEvent['origin'] }) {
  return origin === 'demo' ? (
    <Badge variant="outline">
      <FlaskConical className="h-3 w-3" aria-hidden="true" />
      Demo
    </Badge>
  ) : (
    <Badge variant="neutral">Real (this session)</Badge>
  )
}
