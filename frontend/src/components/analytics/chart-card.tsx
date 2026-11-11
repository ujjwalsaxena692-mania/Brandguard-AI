import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataSourceBadge } from '@/components/ui/data-source-badge'
import { cn } from '@/lib/utils'
import type { DataSource } from '@/types/insights'

interface ChartCardProps {
  title: string
  description: string
  source: DataSource
  children: ReactNode
  className?: string
}

/** Frame shared by every chart: title, one-line explanation of what is counted, and the data origin. */
export function ChartCard({ title, description, source, children, className }: ChartCardProps) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="pb-2 sm:pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          <DataSourceBadge source={source} />
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">{children}</CardContent>
    </Card>
  )
}
