import { BarChart3 } from 'lucide-react'
import { FeaturePlaceholder } from '@/components/feature-placeholder'

export function AnalyticsPage() {
  return (
    <FeaturePlaceholder
      icon={BarChart3}
      title="Analytics"
      description="Trends in brand compliance across teams, channels and time."
      plannedItems={[
        'Compliance score trends',
        'Most frequent guideline issues',
        'Review turnaround times',
      ]}
    />
  )
}
