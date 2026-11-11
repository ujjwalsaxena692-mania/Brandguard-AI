import { CheckCircle2, ClipboardCheck, FileText, Gauge, ScanSearch, XCircle, type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { DataSourceBadge } from '@/components/ui/data-source-badge'
import type { AnalyticsKpi, KpiKey } from '@/types/insights'

const ICONS: Record<KpiKey, LucideIcon> = {
  total_submissions: FileText,
  analyses_completed: ScanSearch,
  average_score: Gauge,
  pending_reviews: ClipboardCheck,
  approved: CheckCircle2,
  rejected: XCircle,
}

function KpiCard({ kpi }: { kpi: AnalyticsKpi }) {
  const Icon = ICONS[kpi.id]
  return (
    <Card className="flex flex-col p-4" aria-label={kpi.label}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
        <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight">
        {kpi.value === null ? <span aria-label="Unavailable">—</span> : kpi.display}
      </p>
      <p className="mt-2 flex-1 text-xs text-muted-foreground">{kpi.note}</p>
      <div className="mt-2">
        <DataSourceBadge source={kpi.source} />
      </div>
    </Card>
  )
}

export function KpiGrid({ kpis }: { kpis: AnalyticsKpi[] }) {
  return (
    <section aria-label="Key metrics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.id} kpi={kpi} />
      ))}
    </section>
  )
}
