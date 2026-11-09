import { Clock, FilePen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { submissionStatusLabel } from '@/lib/submission'
import type { ContentSubmissionStatus } from '@/types/submission'

/** Honest labels only: a submission is "awaiting analysis", never analysed or approved. */
export function SubmissionStatusBadge({ status }: { status: ContentSubmissionStatus }) {
  const Icon = status === 'submitted' ? Clock : FilePen
  return (
    <Badge variant={status === 'submitted' ? 'primary' : 'neutral'}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {submissionStatusLabel(status)}
    </Badge>
  )
}
