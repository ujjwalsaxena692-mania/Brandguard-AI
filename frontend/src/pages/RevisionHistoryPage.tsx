import { History } from 'lucide-react'
import { FeaturePlaceholder } from '@/components/feature-placeholder'

export function RevisionHistoryPage() {
  return (
    <FeaturePlaceholder
      icon={History}
      title="Revision History"
      description="An audit trail of changes to submissions and the decisions made on them."
      plannedItems={[
        'Version history for each submission',
        'Who changed what, and when',
        'Side-by-side comparison of revisions',
      ]}
    />
  )
}
