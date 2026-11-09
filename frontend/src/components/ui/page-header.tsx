import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'

interface PageHeaderProps {
  title: string
  description?: string
  /** Pill next to the title, e.g. "Coming soon". */
  badge?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, badge, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {badge && <Badge variant="primary">{badge}</Badge>}
        </div>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
