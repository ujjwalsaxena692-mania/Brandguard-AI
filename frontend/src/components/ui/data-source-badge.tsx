import { Database, FlaskConical, Layers, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SOURCE_LABELS } from '@/lib/insights-source'
import type { DataSource } from '@/types/insights'

const ICONS = { demo: FlaskConical, real: User, mixed: Layers, none: Database } as const

/** Says where a number or record came from. It always includes text, so meaning never depends on the icon. */
export function DataSourceBadge({ source, className }: { source: DataSource; className?: string }) {
  const Icon = ICONS[source]
  return (
    <Badge variant={source === 'real' ? 'neutral' : 'outline'} className={className}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {SOURCE_LABELS[source]}
    </Badge>
  )
}
