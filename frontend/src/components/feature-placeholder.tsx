import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'

interface FeaturePlaceholderProps {
  icon: LucideIcon
  title: string
  description: string
  plannedItems: string[]
}

/** Page for a module that is designed but not yet built. It implements nothing. */
export function FeaturePlaceholder({ icon, title, description, plannedItems }: FeaturePlaceholderProps) {
  return (
    <>
      <PageHeader title={title} description={description} badge="Coming soon" />
      <Card>
        <EmptyState
          icon={icon}
          badge="Not yet available"
          title={`${title} is under development`}
          description="This module has no backend yet, so there is nothing to show here."
        />
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Planned capabilities</CardTitle>
          <CardDescription>What this module is intended to cover. Subject to change.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            {plannedItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  )
}
