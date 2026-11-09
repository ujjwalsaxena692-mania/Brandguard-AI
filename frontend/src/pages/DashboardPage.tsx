import { Activity, CheckCircle2, ClipboardCheck, Clock, FileText } from 'lucide-react'
import { ComplianceTrendChart } from '@/components/compliance-trend-chart'
import { StatCard } from '@/components/stat-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableEmptyRow, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/hooks/use-auth'
import { getDisplayName } from '@/lib/user'
import type { CompliancePoint } from '@/types'

// No data source exists yet, so these are intentionally empty (never mock data).
const NO_COMPLIANCE_DATA: CompliancePoint[] = []

const PENDING_COLUMNS = ['Content', 'Submitted by', 'Submitted', 'Status']

export function DashboardPage() {
  const { user } = useAuth()
  const name = getDisplayName(user)

  return (
    <>
      <PageHeader
        title={name ? `Welcome back, ${name}` : 'Welcome to BrandGuard AI'}
        description="One Brand. Every Voice. Zero Compromise."
      />

      <section aria-label="Submission overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total submissions" value={null} caption="No data yet" icon={FileText} />
        <StatCard label="Awaiting analysis" value={null} caption="No data yet" icon={Clock} />
        <StatCard label="Pending approval" value={null} caption="No data yet" icon={ClipboardCheck} />
        <StatCard label="Approved" value={null} caption="No data yet" icon={CheckCircle2} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Pending approvals</CardTitle>
            <CardDescription>Content waiting for a human reviewer's decision.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-2 sm:px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {PENDING_COLUMNS.map((column) => (
                    <TableHead key={column}>{column}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableEmptyRow
                  colSpan={PENDING_COLUMNS.length}
                  title="No pending approvals"
                  description="Items awaiting review will appear here once content submission is available."
                />
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest submissions, analyses and decisions.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              compact
              icon={Activity}
              title="No activity yet"
              description="Activity will be listed here as your team starts using BrandGuard AI."
            />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Compliance overview</CardTitle>
          <CardDescription>Brand compliance scores over time.</CardDescription>
        </CardHeader>
        <CardContent>
          <ComplianceTrendChart data={NO_COMPLIANCE_DATA} />
        </CardContent>
      </Card>
    </>
  )
}
