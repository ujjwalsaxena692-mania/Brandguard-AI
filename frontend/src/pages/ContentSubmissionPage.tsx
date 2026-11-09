import { FileUp } from 'lucide-react'
import { FeaturePlaceholder } from '@/components/feature-placeholder'

export function ContentSubmissionPage() {
  return (
    <FeaturePlaceholder
      icon={FileUp}
      title="Content Submission"
      description="Submit draft content for analysis against your brand knowledge before it is published."
      plannedItems={[
        'Paste text or upload documents',
        'Choose the channel and audience for each piece of content',
        'Track each submission through analysis and review',
      ]}
    />
  )
}
