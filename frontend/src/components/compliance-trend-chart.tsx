import { BarChart3 } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/ui/empty-state'
import { cssColor } from '@/lib/css-color'
import type { CompliancePoint } from '@/types'

/** Renders real data when provided; otherwise an honest empty state. */
export function ComplianceTrendChart({ data }: { data: CompliancePoint[] }) {
  if (data.length === 0) {
    return (
      <EmptyState
        compact
        icon={BarChart3}
        title="No compliance data yet"
        description="Scores will be charted here once content has been analysed."
      />
    )
  }

  const line = cssColor('--chart-1')
  const grid = cssColor('--border')
  const axis = cssColor('--muted-foreground')

  return (
    <div className="h-64 w-full" role="img" aria-label="Compliance score trend over time">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" stroke={axis} tickLine={false} fontSize={12} />
          <YAxis domain={[0, 100]} stroke={axis} tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip />
          <Line type="monotone" dataKey="score" stroke={line} strokeWidth={2} dot={{ r: 3, fill: line }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
