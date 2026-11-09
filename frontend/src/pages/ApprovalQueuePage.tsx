import { ClipboardCheck } from 'lucide-react'
import { FeaturePlaceholder } from '@/components/feature-placeholder'

export function ApprovalQueuePage() {
  return (
    <FeaturePlaceholder
      icon={ClipboardCheck}
      title="Approval Queue"
      description="Human reviewers make the final approval decision on analysed content."
      plannedItems={[
        'A queue of submissions awaiting review',
        'Approve, request changes or reject, with comments',
        'Assign reviewers and track turnaround',
      ]}
    />
  )
}
