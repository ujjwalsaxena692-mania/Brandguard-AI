import { AlertTriangle, BarChart3, CheckCircle2, ShieldAlert, type LucideIcon } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { ComplianceTrendChart } from '@/components/compliance-trend-chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { cssColor } from '@/lib/css-color'
import type { CompliancePoint } from '@/types'
import type { ComplianceBreakdown } from '@/types/dashboard'

interface Segment {
  key: keyof ComplianceBreakdown
  label: string
  rule: string
  colorVar: string
  dotClass: string
  icon: LucideIcon
}

const SEGMENTS: readonly Segment[] = [
  { key: 'compliant', label: 'Compliant', rule: 'Score 85 or above', colorVar: '--success', dotClass: 'bg-success', icon: CheckCircle2 },
  { key: 'needsReview', label: 'Needs review', rule: 'Score 60 to 84', colorVar: '--warning', dotClass: 'bg-warning', icon: AlertTriangle },
  { key: 'critical', label: 'Critical', rule: 'Score below 60', colorVar: '--primary', dotClass: 'bg-primary', icon: ShieldAlert },
]

interface ComplianceOverviewProps {
  averageScore: number
  breakdown: ComplianceBreakdown
  trend: CompliancePoint[]
  className?: string
}

export function ComplianceOverview({ averageScore, breakdown, trend, className }: ComplianceOverviewProps) {
  const total = breakdown.compliant + breakdown.needsReview + breakdown.critical
  const rows = SEGMENTS.map((segment) => ({
    ...segment,
    value: breakdown[segment.key],
    percent: total > 0 ? Math.round((breakdown[segment.key] / total) * 100) : 0,
  }))
  const summary = `Average compliance score ${averageScore} out of 100. ${rows
    .map((row) => `${row.label}: ${row.value}`)
    .join(', ')}.`

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Compliance overview</CardTitle>
        <CardDescription>Average brand compliance score and how checked content is distributed.</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyState
            compact
            icon={BarChart3}
            title="No compliance data yet"
            description="The score breakdown will appear here once content has been checked."
          />
        ) : (
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <div className="relative mx-auto h-44 w-44" role="img" aria-label={summary}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={rows}
                      dataKey="value"
                      nameKey="label"
                      innerRadius="68%"
                      outerRadius="100%"
                      paddingAngle={2}
                      startAngle={90}
                      endAngle={-270}
                      stroke="none"
                    >
                      {rows.map((row) => (
                        <Cell key={row.key} fill={cssColor(row.colorVar)} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-semibold tracking-tight">{averageScore}</span>
                  <span className="text-xs text-muted-foreground">avg. score / 100</span>
                </div>
              </div>

              <ul className="mt-6 space-y-3">
                {rows.map((row) => {
                  const Icon = row.icon
                  return (
                    <li key={row.key} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${row.dotClass}`} aria-hidden="true" />
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="font-medium">{row.label}</span>
                        <span className="hidden text-xs text-muted-foreground sm:inline">{row.rule}</span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        <span className="font-semibold">{row.value}</span>
                        <span className="ml-1 text-xs text-muted-foreground">({row.percent}%)</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">Weekly average score</h3>
              <ComplianceTrendChart data={trend} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
