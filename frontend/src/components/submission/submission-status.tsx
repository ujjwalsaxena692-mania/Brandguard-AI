import { AlertTriangle, Ban, CheckCircle2, Clock, FilePen, Loader2, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { STATUS_META } from '@/lib/content-submission'
import type { SubmissionStatus } from '@/types/content-submission'

const ICONS: Record<SubmissionStatus, LucideIcon> = {
  draft: FilePen,
  submitted: Clock,
  processing: Loader2,
  ready_for_analysis: CheckCircle2,
  failed: AlertTriangle,
  cancelled: Ban,
}

/** Honest labels only: the furthest a submission goes is "Ready for analysis", never analysed or approved. */
export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  const Icon = ICONS[status]
  const meta = STATUS_META[status]
  return (
    <Badge variant={meta.tone} title={meta.description}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {meta.label}
    </Badge>
  )
}
