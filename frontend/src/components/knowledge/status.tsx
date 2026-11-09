import { Badge, type BadgeProps } from '@/components/ui/badge'
import { STATUS_LABELS, isExpired } from '@/lib/knowledge'
import type { KnowledgeEntry, KnowledgeStatus } from '@/types/knowledge'

const VARIANTS: Record<KnowledgeStatus, BadgeProps['variant']> = {
  approved: 'success',
  pending_review: 'warning',
  draft: 'neutral',
  archived: 'outline',
}

/** Always a text label, so status never depends on colour alone. */
export function KnowledgeStatusBadge({ status }: { status: KnowledgeStatus }) {
  return <Badge variant={VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
}

/** Status plus an "Expired" marker when the validity date has passed. */
export function KnowledgeStatusCell({ entry }: { entry: KnowledgeEntry }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <KnowledgeStatusBadge status={entry.status} />
      {entry.status !== 'archived' && isExpired(entry) && <Badge variant="danger">Expired</Badge>}
    </span>
  )
}
