import { BookOpen } from 'lucide-react'
import { FeaturePlaceholder } from '@/components/feature-placeholder'

export function KnowledgeHubPage() {
  return (
    <FeaturePlaceholder
      icon={BookOpen}
      title="Brand Knowledge Hub"
      description="A single source of truth for approved brand guidelines, terminology, facts and visual assets."
      plannedItems={[
        'Upload and organise brand guideline documents',
        'Maintain approved terminology and phrases to avoid',
        'Store verified facts and key messaging',
        'Manage approved visual assets',
      ]}
    />
  )
}
