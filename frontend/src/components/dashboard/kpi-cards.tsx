import { ClipboardCheck, FileText, Gauge, Minus, ShieldAlert, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import type { KpiId, KpiMetric } from '@/types/dashboard'

const KPI_ICONS: Record<KpiId, LucideIcon> = {
  total_checks: FileText,
  average_score: Gauge,
  pending_reviews: ClipboardCheck,
  critical_issues: ShieldAlert,
}

const TREND_ICONS = { up: TrendingUp, down: TrendingDown, flat: Minus } as const

const SENTIMENT_CLASSES: Record<KpiMetric['trend']['sentiment'], string> = {
  positive: 'text-success',
  negative: 'text-primary',
  neutral: 'text-muted-foreground',
}

function KpiCard({ metric }: { metric: KpiMetric }) {
  const Icon = KPI_ICONS[metric.id]
  const TrendIcon = TREND_ICONS[metric.trend.direction]

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
          <p className="text-3xl font-semibold tracking-tight">{metric.value}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{metric.description}</p>
      <p className={cn('mt-1 flex items-center gap-1 text-xs font-medium', SENTIMENT_CLASSES[metric.trend.sentiment])}>
        <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
        {metric.trend.label}
      </p>
    </Card>
  )
}

export function KpiCards({ metrics }: { metrics: KpiMetric[] }) {
  if (metrics.length === 0) {
    return (
      <Card>
        <EmptyState compact icon={FileText} title="No metrics yet" description="Key figures will appear here once content has been checked." />
      </Card>
    )
  }

  return (
    <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <KpiCard key={metric.id} metric={metric} />
      ))}
    </section>
  )
}
