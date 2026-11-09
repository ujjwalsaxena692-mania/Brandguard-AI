import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface StatCardProps {
  label: string
  /** null renders an em dash: there is no data source yet. */
  value: number | null
  caption: string
  icon: LucideIcon
}

export function StatCard({ label, value, caption, icon: Icon }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold tracking-tight">
            {value ?? <span aria-label="No data">—</span>}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{caption}</p>
    </Card>
  )
}
