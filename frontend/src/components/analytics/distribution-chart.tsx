import { BarChart3, type LucideIcon } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/ui/empty-state'
import { cssColor } from '@/lib/css-color'
import type { Distribution } from '@/types/insights'

interface DistributionChartProps {
  /** Names the chart for screen readers and the hidden data table. */
  label: string
  distribution: Distribution
  orientation?: 'horizontal' | 'vertical'
  /** CSS token for each bar, by datum key. Falls back to the primary colour. */
  colorFor?: (key: string) => string
  /** Shown when there is nothing to chart. */
  empty: { title: string; description: string; icon?: LucideIcon }
  /** Unit in the tooltip, e.g. "submissions". */
  unit: string
}

/**
 * A bar chart of real counts. The data is also written to a visually hidden table, so the numbers
 * are available to screen readers and do not depend on the chart's colours.
 */
export function DistributionChart({ label, distribution, orientation = 'horizontal', colorFor, empty, unit }: DistributionChartProps) {
  const { data, total } = distribution

  if (total === 0) {
    return <EmptyState compact icon={empty.icon ?? BarChart3} title={empty.title} description={empty.description} />
  }

  const grid = cssColor('--border')
  const axis = cssColor('--muted-foreground')
  const fallback = cssColor('--chart-1')
  const colour = (key: string) => (colorFor ? cssColor(colorFor(key)) : fallback)
  const horizontalBars = orientation === 'horizontal'
  const height = horizontalBars ? Math.max(180, data.length * 44 + 24) : 224

  return (
    <div>
      <div className="w-full" style={{ height }} role="img" aria-label={`${label}. Values are listed in the table below the chart.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={horizontalBars ? 'vertical' : 'horizontal'}
            margin={{ top: 4, right: 16, bottom: 0, left: horizontalBars ? 4 : -16 }}
          >
            <CartesianGrid stroke={grid} strokeDasharray="3 3" horizontal={!horizontalBars} vertical={horizontalBars} />
            {horizontalBars ? (
              <>
                <XAxis type="number" allowDecimals={false} stroke={axis} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis type="category" dataKey="label" width={120} stroke={axis} tickLine={false} axisLine={false} fontSize={12} />
              </>
            ) : (
              <>
                <XAxis type="category" dataKey="label" stroke={axis} tickLine={false} fontSize={12} />
                <YAxis type="number" allowDecimals={false} stroke={axis} tickLine={false} axisLine={false} fontSize={12} />
              </>
            )}
            <Tooltip
              cursor={{ fill: grid, opacity: 0.4 }}
              formatter={(value) => {
                const count = Number(value)
                return [`${count} ${unit} (${Math.round((count / total) * 100)}% of ${total})`, 'Count']
              }}
            />
            <Bar dataKey="value" radius={[3, 3, 3, 3]} maxBarSize={horizontalBars ? 22 : 48} isAnimationActive={false}>
              {data.map((datum) => (
                <Cell key={datum.key} fill={colour(datum.key)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Count</th>
            </tr>
          </thead>
          <tbody>
            {data.map((datum) => (
              <tr key={datum.key}>
                <th scope="row">{datum.label}</th>
                <td>{datum.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
