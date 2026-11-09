import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  /** Optional pill shown above the title, e.g. "Coming soon". */
  badge?: string
  action?: ReactNode
  compact?: boolean
  className?: string
}

export function EmptyState({ icon: Icon, title, description, badge, action, compact, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14',
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      {badge && <Badge variant="primary">{badge}</Badge>}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
