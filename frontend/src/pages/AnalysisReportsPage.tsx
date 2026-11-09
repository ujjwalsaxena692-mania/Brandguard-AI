import { FileSearch } from 'lucide-react'
import { FeaturePlaceholder } from '@/components/feature-placeholder'

export function AnalysisReportsPage() {
  return (
    <FeaturePlaceholder
      icon={FileSearch}
      title="Analysis Reports"
      description="Detailed findings for each submission: guideline conflicts, terminology issues and factual concerns."
      plannedItems={[
        'Per-submission findings with explanations',
        'Suggested revisions for reviewers to accept or reject',
        'Links from each finding back to the guideline it is based on',
      ]}
    />
  )
}
