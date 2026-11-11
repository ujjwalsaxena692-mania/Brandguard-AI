import { LineChart as LineChartIcon } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/ui/empty-state'
import { cssColor } from '@/lib/css-color'
import { formatDateTime } from '@/lib/review'
import type { TrendPoint } from '@/types/insights'

const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

interface TooltipPayloadItem {
  payload?: TrendPoint
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  const point = active ? payload?.[0]?.payload : undefined
  if (!point) return null
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-card">
      <p className="font-semibold">{point.title}</p>
      <p className="text-muted-foreground">{formatDateTime(point.at)}</p>
      <p className="mt-1">
        Compliance score: <span className="font-semibold">{point.score}</span> / 100
      </p>
    </div>
  )
}

/**
 * One point per genuine analysis, on a true time axis (so the gaps between points are honest).
 * Points are never averaged, interpolated or invented. A line needs at least two analyses.
 */
export function ComplianceTrendPanel({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) {
    const only = points[0]
    return (
      <EmptyState
        compact
        icon={LineChartIcon}
        title={points.length === 0 ? 'No analysis results in this period' : 'Not enough analyses to chart a trend'}
        description={
          points.length === 0
            ? 'A trend line appears once at least two analysis results fall inside the selected dates.'
            : `Only one analysis falls in this period (“${only.title}”, score ${only.score}). At least two are needed to draw a trend.`
        }
      />
    )
  }

  const line = cssColor('--chart-1')
  const grid = cssColor('--border')
  const axis = cssColor('--muted-foreground')

  return (
    <div>
      <div className="h-64 w-full" role="img" aria-label="Compliance score for each analysis over time. Values are listed in the table below the chart.">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
            <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value: number) => shortDate.format(new Date(value))}
              stroke={axis}
              tickLine={false}
              fontSize={12}
              padding={{ left: 12, right: 12 }}
            />
            <YAxis domain={[0, 100]} stroke={axis} tickLine={false} axisLine={false} fontSize={12} />
            <Tooltip content={<TrendTooltip />} />
            <Line type="linear" dataKey="score" stroke={line} strokeWidth={2} dot={{ r: 4, fill: line }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="sr-only">
        <table>
          <caption>Compliance score for each analysis</caption>
          <thead>
            <tr>
              <th scope="col">Content</th>
              <th scope="col">Analysed</th>
              <th scope="col">Score</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.id}>
                <th scope="row">{point.title}</th>
                <td>{formatDateTime(point.at)}</td>
                <td>{point.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
